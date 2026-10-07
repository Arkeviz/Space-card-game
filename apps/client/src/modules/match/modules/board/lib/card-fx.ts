import type { Particle } from './dust'
import type { Pose } from './layout'
import type { SpawnHint } from './motion'
import type { TweenTracker } from './tween-tracker'
import gsap from 'gsap'
import { collectPalette, dustFieldOf, FALLBACK_PALETTE, pickColor } from './dust'

/** Время перелёта карты между зонами и быстрого отклика на наведение, секунды при speed = 1. */
export const MOVE_DURATION = 0.55
export const HOVER_DURATION = 0.18
export const FADE_DURATION = 0.3
export const FLIP_RATIO = 0.8
/** Во время полёта карта лежит поверх всех остальных. */
export const FLYING_Z = 200
/** При таком множителе скорости (prefers-reduced-motion) эффекты движения не показываются вовсе. */
export const REDUCED_SPEED = 10

/** Всё, что эффектам нужно от слоя карт. */
export interface FxContext {
  /** Слой карт: сюда добавляются копии карт и холст с пылью. */
  host: HTMLElement
  /** Множитель скорости анимаций. */
  speed: number
  tracker: TweenTracker
}

export function poseVars(pose: Pose): gsap.TweenVars {
  return { x: pose.x, y: pose.y, rotation: pose.rot, scale: pose.scale, opacity: pose.opacity }
}

/** Элемент карты, который переворачивается (рубашка и лицо). */
export function flipOf(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-flip]')
}

const rand = gsap.utils.random

/** Сколько секунд фронт распада проходит карту слева направо (при speed = 1 и без замедления). */
const DUST_SWEEP = 0.75
/** Во сколько раз эффект пыли замедлен: 1 - обычная скорость (~2.5 с), 4 - около 10 секунд, чтобы рассмотреть при подгонке. */
const DUST_SLOWDOWN = 1
/** Одна частица пыли на столько квадратных px карты (чем меньше, тем плотнее пыль). */
const DUST_AREA_PER_PARTICLE = 90
const DUST_MIN_PARTICLES = 300
const DUST_MAX_PARTICLES = 1200
/** Полоса фронта распада в долях ширины карты: внутри неё карта уже полупрозрачна. */
const DUST_EDGE = 0.14

/** Маска карты, у которой левее фронта (p в долях ширины, от -EDGE до 1 + EDGE) ничего не осталось. */
function dustMask(p: number): string {
  const from = (p - DUST_EDGE) * 100
  const to = (p + DUST_EDGE) * 100
  return `linear-gradient(to right, transparent ${from}%, #000 ${to}%)`
}

/**
 * Карта, уходящая в утиль, рассыпается в пыль на месте: её копия растворяется слева направо (по ней идёт фронт распада), а
 * вдоль фронта появляются мелкие частицы цветов карты, которые медленно поднимаются над ней и угасают на лету.
 * Оригинал при этом сразу прячется. Копия - обычная DOM-копия, поэтому эффект не зависит от того, чем нарисована карта.
 */
export function dissolveToDust(el: HTMLElement, fx: FxContext): void {
  const { host, speed, tracker } = fx
  if (speed >= REDUCED_SPEED)
    return
  const width = el.offsetWidth
  const height = el.offsetHeight
  const x0 = Number(gsap.getProperty(el, 'x'))
  const y0 = Number(gsap.getProperty(el, 'y'))
  const scale = Number(gsap.getProperty(el, 'scale'))
  const rotation = (Number(gsap.getProperty(el, 'rotation')) * Math.PI) / 180
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)

  const ghost = el.cloneNode(true) as HTMLElement
  ghost.removeAttribute('data-key')
  ghost.classList.remove('node--flipping')
  ghost.querySelectorAll('.node__hit, .node__scrap').forEach(button => button.remove())
  ghost.style.pointerEvents = 'none'
  host.appendChild(ghost)

  const sweep = (DUST_SWEEP * DUST_SLOWDOWN) / speed
  const front = { p: -DUST_EDGE }
  const applyMask = (): void => {
    const mask = dustMask(front.p)
    ghost.style.maskImage = mask
    ghost.style.webkitMaskImage = mask
  }
  applyMask()
  const timeline = gsap.timeline({ onComplete: () => ghost.remove(), onInterrupt: () => ghost.remove() })
  // Раскалённая вспышка в начале; копия растворяется на месте, никуда не смещаясь.
  timeline.fromTo(ghost, { filter: 'brightness(1.9) saturate(1.3)' }, { filter: 'brightness(1) saturate(1)', duration: (0.25 * DUST_SLOWDOWN) / speed, ease: 'power2.out' }, 0)
  timeline.to(front, { p: 1 + DUST_EDGE, duration: sweep, ease: 'power1.inOut', onUpdate: applyMask }, 0)

  const palette = collectPalette(el)
  const colors = palette.length > 0 ? palette : FALLBACK_PALETTE
  const count = Math.round(Math.min(DUST_MAX_PARTICLES, Math.max(DUST_MIN_PARTICLES, (width * height) / DUST_AREA_PER_PARTICLE)))
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const u = Math.random()
    const v = Math.random()
    const dx = (u - 0.5) * width * scale
    const dy = (v - 0.5) * height * scale
    particles.push({
      x: x0 + dx * cos - dy * sin,
      y: y0 + dx * sin + dy * cos,
      // Пыль не улетает прочь, а расходится облаком над местом карты: слабый снос вправо и подъём вверх.
      vx: rand(-40, 70),
      vy: -rand(15, 90),
      size: rand(1.1, 3.4) * Math.max(scale, 0.6),
      life: rand(0.85, 1.7),
      // Частица появляется, когда до неё доходит фронт распада (с разбросом, чтобы край был рваным). Возраст - во времени
      // пыли (DustField.add идёт с множителем speed / DUST_SLOWDOWN), поэтому задержка считается от DUST_SWEEP, а не от sweep.
      age: -(Math.min(1.3, Math.max(0, u * 0.85 + rand(-0.12, 0.12) + 0.08)) * DUST_SWEEP),
      phase: rand(0, Math.PI * 2),
      color: pickColor(colors, Math.random()),
    })
  }
  dustFieldOf(host).add(particles, speed / DUST_SLOWDOWN)

  // Следующее событие не ждёт, пока пыль развеется: шаг очереди заканчивается, когда распад уже заметен.
  tracker.add(new Promise((resolve) => {
    gsap.delayedCall(0.12 / speed, resolve)
  }))
}

/**
 * Карта появилась уже утилизированной (из руки соперника или из глубины сброса): показывается и тут же распадается.
 * pose - её место в куче утиля (невидимое).
 */
export function spawnScrapped(el: HTMLElement, pose: Pose, hint: SpawnHint | undefined, fx: FxContext): void {
  const toHeap = (): void => {
    gsap.set(el, { ...poseVars(pose), zIndex: pose.z })
  }
  if (!hint || fx.speed >= REDUCED_SPEED) {
    toHeap()
    return
  }

  const flip = flipOf(el)
  const reveal = hint.faceDown && flip
  // Карта из руки соперника сначала спускается из веера и переворачивается, чтобы было видно, что это за карта.
  const at: Pose = reveal ? { ...hint.from, y: hint.from.y + 190, scale: 0.8, rot: 0 } : hint.from
  gsap.set(el, { ...poseVars(at), opacity: 1, zIndex: FLYING_Z })
  const finish = (): void => {
    dissolveToDust(el, fx)
    toHeap()
  }
  if (!reveal) {
    finish()
    return
  }
  el.classList.add('node--flipping')
  gsap.set(flip, { rotationY: 180 })
  const endFlip = (): void => {
    el.classList.remove('node--flipping')
    gsap.set(flip, { clearProps: 'transform' })
  }
  fx.tracker.track(gsap.to(flip, {
    rotationY: 0,
    duration: 0.2 / fx.speed,
    ease: 'power2.inOut',
    onComplete: () => {
      endFlip()
      finish()
    },
    onInterrupt: endFlip,
  }))
}
