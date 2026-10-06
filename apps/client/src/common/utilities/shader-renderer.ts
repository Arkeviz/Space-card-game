/**
 * Рисует на весь контейнер фрагментный шейдер в формате ShaderToy (`void mainImage(out vec4 fragColor, in vec2 fragCoord)`)
 * на чистом WebGL 2, без зависимостей. Основа - компонент ShaderToy из Inspira UI, но без мыши: `iMouse` всегда нулевой,
 * поэтому картинка не реагирует на курсор и касания.
 *
 * Доступные шейдеру uniform-переменные: iResolution (в пикселях холста), iTime (секунды, уже умноженные на speed),
 * iTimeDelta, iFrame и iMouse (нулевой).
 */

export interface ShaderRendererOptions {
  /** Исходный код `mainImage` (GLSL ES 3.00). */
  shaderCode: string
  /** Множитель яркости: итоговый цвет умножается на него (V в HSV, как в Inspira UI). */
  brightness?: number
  /** Множитель скорости времени шейдера. */
  speed?: number
  /** Размер холста относительно контейнера: больше - чётче и тяжелее. */
  pixelRatio?: number
  /** Потолок частоты кадров. */
  frameRate?: number
}

const MIN_PIXEL_RATIO = 0.25
const MAX_PIXEL_RATIO = 2
const MAX_FRAME_RATE = 60
/** Длинный пропуск (вкладка была скрыта) не должен резко сдвигать время шейдера. */
const MAX_DELTA_SECONDS = 0.1

const VERTEX_SHADER = `#version 300 es
void main() {
  // Один треугольник на весь экран: вершины выбираются по номеру, буферы не нужны.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`

// Заголовок идёт до пользовательского кода: его #define (у ShaderToy-шейдеров они часто называются brightness, speed)
// не могут переименовать эти uniform-переменные.
const FRAGMENT_HEADER = `#version 300 es
precision highp float;
precision highp int;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform float iBrightness;

out vec4 fragColor;

void mainImage(out vec4 color, in vec2 coord);

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  // Яркость меняет V в HSV: самый яркий канал масштабируется и не выходит за 1, оттенок сохраняется.
  float peak = max(color.r, max(color.g, color.b));
  if (peak > 0.0)
    color.rgb *= min(peak * iBrightness, 1.0) / peak;
  fragColor = vec4(color.rgb, 1.0);
}
`

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export function clampPixelRatio(value: number): number {
  return clamp(value, MIN_PIXEL_RATIO, MAX_PIXEL_RATIO)
}

interface Uniforms {
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  timeDelta: WebGLUniformLocation | null
  frame: WebGLUniformLocation | null
  mouse: WebGLUniformLocation | null
  brightness: WebGLUniformLocation | null
}

export class ShaderRenderer {
  private readonly container: HTMLElement
  private readonly options: ShaderRendererOptions
  private readonly canvas = document.createElement('canvas')
  private readonly gl: WebGL2RenderingContext
  private readonly resizeObserver: ResizeObserver
  private program: WebGLProgram | null = null
  private uniforms!: Uniforms

  private brightness: number
  private speed: number
  private pixelRatio: number
  private frameInterval: number

  private playing = false
  private frameId = 0
  private lastTick = 0
  private lastDraw = 0
  private time = 0
  private delta = 0
  private frame = 0

  /** Бросает исключение, если WebGL 2 недоступен или шейдер не компилируется: холст при этом в контейнер не добавляется. */
  constructor(container: HTMLElement, options: ShaderRendererOptions) {
    this.container = container
    this.options = options
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' })
    if (!gl)
      throw new Error('WebGL 2 не поддерживается')
    this.gl = gl

    this.brightness = options.brightness ?? 1
    this.speed = Math.max(0, options.speed ?? 1)
    this.pixelRatio = clampPixelRatio(options.pixelRatio ?? 1)
    this.frameInterval = 1000 / clamp(options.frameRate ?? MAX_FRAME_RATE, 1, MAX_FRAME_RATE)

    this.build()

    Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%' })
    this.container.appendChild(this.canvas)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.resize()

    this.canvas.addEventListener('webglcontextlost', this.onContextLost)
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored)
  }

  private compile(type: number, source: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Шейдер не скомпилирован: ${log}`)
    }
    return shader
  }

  /** Компилирует программу и ищет uniform-переменные (повторно вызывается после потери контекста). */
  private build(): void {
    const { gl } = this
    const vertex = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_HEADER + this.options.shaderCode)
    const program = gl.createProgram()
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`Программа шейдера не собрана: ${log}`)
    }
    this.program = program
    this.uniforms = {
      resolution: gl.getUniformLocation(program, 'iResolution'),
      time: gl.getUniformLocation(program, 'iTime'),
      timeDelta: gl.getUniformLocation(program, 'iTimeDelta'),
      frame: gl.getUniformLocation(program, 'iFrame'),
      mouse: gl.getUniformLocation(program, 'iMouse'),
      brightness: gl.getUniformLocation(program, 'iBrightness'),
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.canvas.width = Math.max(1, Math.round(width * this.pixelRatio))
    this.canvas.height = Math.max(1, Math.round(height * this.pixelRatio))
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    // Смена размера очищает холст: на паузе перерисовываем, иначе останется пустой кадр.
    if (!this.playing)
      this.render()
  }

  /** Рисует один кадр с текущим временем (нужно на паузе и при изменении размера). */
  render(): void {
    const { gl, program, uniforms } = this
    if (!program || gl.isContextLost())
      return
    gl.useProgram(program)
    gl.uniform3f(uniforms.resolution, this.canvas.width, this.canvas.height, this.pixelRatio)
    gl.uniform1f(uniforms.time, this.time)
    gl.uniform1f(uniforms.timeDelta, this.delta)
    gl.uniform1i(uniforms.frame, this.frame)
    gl.uniform4f(uniforms.mouse, 0, 0, 0, 0)
    gl.uniform1f(uniforms.brightness, this.brightness)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private readonly tick = (now: number): void => {
    this.frameId = requestAnimationFrame(this.tick)
    if (now - this.lastDraw < this.frameInterval)
      return
    // Остаток интервала переносится, чтобы частота была ровной, а не округлялась вверх до кратной кадру развёртки.
    this.lastDraw = now - ((now - this.lastDraw) % this.frameInterval)
    this.delta = Math.min((now - this.lastTick) / 1000, MAX_DELTA_SECONDS) * this.speed
    this.lastTick = now
    this.time += this.delta
    this.frame++
    this.render()
  }

  play(): void {
    if (this.playing || this.gl.isContextLost())
      return
    this.playing = true
    this.lastTick = performance.now()
    this.lastDraw = this.lastTick
    this.frameId = requestAnimationFrame(this.tick)
  }

  pause(): void {
    this.playing = false
    cancelAnimationFrame(this.frameId)
    this.frameId = 0
  }

  setBrightness(value: number): void {
    this.brightness = value
    if (!this.playing)
      this.render()
  }

  setSpeed(value: number): void {
    this.speed = Math.max(0, value)
  }

  setPixelRatio(value: number): void {
    this.pixelRatio = clampPixelRatio(value)
    this.resize()
  }

  setFrameRate(value: number): void {
    this.frameInterval = 1000 / clamp(value, 1, MAX_FRAME_RATE)
  }

  // Потеря контекста (драйвер, нехватка памяти): без preventDefault браузер его не вернёт.
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault()
    this.program = null
    cancelAnimationFrame(this.frameId)
  }

  private readonly onContextRestored = (): void => {
    try {
      this.build()
    }
    catch {
      return
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    if (this.playing) {
      this.lastTick = performance.now()
      this.frameId = requestAnimationFrame(this.tick)
    }
    else {
      this.render()
    }
  }

  dispose(): void {
    this.pause()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    if (this.program)
      this.gl.deleteProgram(this.program)
    this.program = null
    this.canvas.remove()
    // Контекстов на странице ограниченное число: освобождаем сразу, не дожидаясь сборщика мусора.
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
