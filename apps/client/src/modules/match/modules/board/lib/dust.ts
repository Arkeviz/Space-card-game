/**
 * Пыль для утилизации карты: тысячи мелких частиц на canvas поверх слоя карт. Частицы появляются там, где карта уже
 * «рассыпалась» (фронт распада идёт по карте слева направо), и уносятся ветром вверх и вправо, оседая и угасая.
 * Цвета берутся из самой карты (CardPalette), поэтому пыль у каждой фракции своя.
 */

export interface Rgb {
  r: number
  g: number
  b: number
  a: number
}

/** Разбирает цвет из getComputedStyle: `rgb(r, g, b)` или `rgba(r, g, b, a)`. Другие записи (градиенты, color()) - null. */
export function parseCssColor(value: string): Rgb | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(value.trim())
  if (!match)
    return null
  const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number.parseFloat(match[4])
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha }
}

const luminance = ({ r, g, b }: Rgb): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/**
 * Делает цвет пыли заметным на тёмном столе: тёмный цвет осветляется с сохранением оттенка (тёмно-красный становится
 * ярко-красным, тёмно-синий - голубым), затем к нему подмешивается немного светлого пепла, чтобы пыль выглядела пылью.
 */
export function dustColor(color: Rgb, ash: Rgb = { r: 214, g: 200, b: 184, a: 1 }): string {
  const boost = Math.min(6, Math.max(1, 0.62 / Math.max(luminance(color), 0.01)))
  const channel = (value: number, ashValue: number): number => Math.round(Math.min(255, value * boost) * 0.8 + ashValue * 0.2)
  return `rgb(${channel(color.r, ash.r)}, ${channel(color.g, ash.g)}, ${channel(color.b, ash.b)})`
}

export interface PaletteEntry {
  color: string
  weight: number
}

/**
 * Цвета карты для пыли: фоны, рамки и текст элементов внутри карты с весом по площади и непрозрачности. Тёмные
 * непрозрачные фоны (общее тело карты, одинаковое у всех фракций) пропускаются: пыль должна быть цвета фракции, то есть
 * её рамки, акцентов и значков. Насыщенные цвета весят больше серых. Читает getComputedStyle, поэтому работает
 * только на живом DOM.
 */
export function collectPalette(root: HTMLElement): PaletteEntry[] {
  const totals = new Map<string, number>()
  const add = (value: string, area: number, isBackground: boolean): void => {
    const parsed = parseCssColor(value)
    if (!parsed || parsed.a < 0.1 || area <= 0)
      return
    if (isBackground && parsed.a > 0.99 && luminance(parsed) < 0.12)
      return
    const high = Math.max(parsed.r, parsed.g, parsed.b)
    const saturation = (high - Math.min(parsed.r, parsed.g, parsed.b)) / Math.max(high, 1)
    const key = dustColor(parsed)
    totals.set(key, (totals.get(key) ?? 0) + area * Math.min(parsed.a * 2, 1) * (1 + 2 * saturation))
  }
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    // У SVG-элементов (значки) нет offsetWidth: их площадь считается нулевой, а не NaN, иначе палитра портится.
    const area = (element.offsetWidth || 0) * (element.offsetHeight || 0)
    const style = getComputedStyle(element)
    add(style.backgroundColor, area, true)
    add(style.color, Math.min(area, 400) * 0.5, false)
    if (Number.parseFloat(style.borderTopWidth) > 0)
      add(style.borderTopColor, 300, false)
  }
  return [...totals].map(([color, weight]) => ({ color, weight }))
}

/** Запасной набор, если у карты не нашлось цветов: холодная пыль в цвет интерфейса. */
export const FALLBACK_PALETTE: PaletteEntry[] = [
  { color: 'rgb(160, 190, 230)', weight: 3 },
  { color: 'rgb(214, 200, 184)', weight: 2 },
]

/** Выбирает цвет с вероятностью, пропорциональной весу (r - случайное число 0..1). */
export function pickColor(palette: readonly PaletteEntry[], r: number): string {
  const total = palette.reduce((sum, entry) => sum + entry.weight, 0)
  let left = r * total
  for (const entry of palette) {
    left -= entry.weight
    if (left <= 0)
      return entry.color
  }
  return palette.at(-1)?.color ?? FALLBACK_PALETTE[0]!.color
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  /** Сколько секунд живёт частица после появления. */
  life: number
  /** Возраст в секундах; пока он отрицателен, частица ещё не появилась (ждёт фронта распада). */
  age: number
  phase: number
  color: string
}

const MAX_STEP = 0.05
const DRAG = 1.1

/** Один холст на слой карт: все эффекты пыли рисуются в нём, холст создаётся при первой частице и убирается, когда они кончились. */
export class DustField {
  private readonly host: HTMLElement
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private particles: Particle[] = []
  private frame = 0
  private last = 0
  private timeScale = 1

  constructor(host: HTMLElement) {
    this.host = host
  }

  /** Добавляет частицы; timeScale - множитель скорости анимаций (быстрее - короче жизнь пыли). */
  add(particles: Particle[], timeScale: number): void {
    if (particles.length === 0)
      return
    this.timeScale = timeScale
    // Частицы одного цвета подряд: меньше переключений fillStyle при рисовании.
    this.particles.push(...particles.toSorted((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : 0)))
    if (!this.canvas)
      this.createCanvas()
    if (!this.frame) {
      this.last = performance.now()
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  private createCanvas(): void {
    const canvas = document.createElement('canvas')
    const width = this.host.clientWidth
    const height = this.host.clientHeight
    // Слой лежит внутри масштабируемой сцены: разрешение холста подгоняем под экранный размер, чтобы пыль не была мыльной.
    const shown = this.host.getBoundingClientRect().width / Math.max(width, 1)
    const ratio = Math.min(2, Math.max(0.75, shown * (window.devicePixelRatio || 1)))
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '300' })
    canvas.setAttribute('aria-hidden', 'true')
    this.host.appendChild(canvas)
    this.canvas = canvas
    this.context = canvas.getContext('2d')
    this.context?.scale(ratio, ratio)
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min((now - this.last) / 1000, MAX_STEP)
    this.last = now
    const context = this.context
    const canvas = this.canvas
    if (!context || !canvas)
      return
    context.clearRect(0, 0, this.host.clientWidth, this.host.clientHeight)
    let color = ''
    const alive: Particle[] = []
    for (const particle of this.particles) {
      particle.age += dt * this.timeScale
      if (particle.age < 0) {
        alive.push(particle)
        continue
      }
      const t = particle.age / particle.life
      if (t >= 1)
        continue
      alive.push(particle)
      const damp = Math.max(0, 1 - DRAG * dt * this.timeScale)
      particle.vx *= damp
      particle.vy *= damp
      particle.x += particle.vx * dt * this.timeScale
      // Лёгкое колебание поперёк ветра: пыль плывёт, а не летит по прямой.
      particle.y += (particle.vy + Math.sin(particle.age * 7 + particle.phase) * 26) * dt * this.timeScale
      const alpha = (1 - t) ** 1.4
      const size = particle.size * (1 - 0.55 * t)
      if (particle.color !== color) {
        color = particle.color
        context.fillStyle = color
      }
      context.globalAlpha = alpha
      context.fillRect(particle.x - size / 2, particle.y - size / 2, size, size)
    }
    context.globalAlpha = 1
    this.particles = alive
    if (alive.length > 0) {
      this.frame = requestAnimationFrame(this.tick)
      return
    }
    this.frame = 0
    canvas.remove()
    this.canvas = null
    this.context = null
  }
}

const fields = new WeakMap<HTMLElement, DustField>()

export function dustFieldOf(host: HTMLElement): DustField {
  let field = fields.get(host)
  if (!field) {
    field = new DustField(host)
    fields.set(host, field)
  }
  return field
}
