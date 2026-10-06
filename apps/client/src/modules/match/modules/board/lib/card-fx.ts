import type { Pose } from './layout'
import type { SpawnHint } from './motion'
import type { TweenTracker } from './tween-tracker'
import gsap from 'gsap'

/** Время перелёта карты между зонами и быстрого отклика на наведение, секунды при speed = 1. */
export const MOVE_DURATION = 0.55
export const HOVER_DURATION = 0.18
export const FADE_DURATION = 0.3
export const FLIP_RATIO = 0.8
/** Во время полёта карта лежит поверх всех остальных. */
export const FLYING_Z = 200
/** При таком множителе скорости (prefers-reduced-motion) эффекты движения не показываются вовсе. */
export const REDUCED_SPEED = 10

const SHARD_COLS = 4
const SHARD_ROWS = 6
const rand = gsap.utils.random

/** Всё, что эффектам нужно от слоя карт. */
export interface FxContext {
  /** Слой карт: сюда добавляются осколки. */
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

/**
 * Карта, уходящая в утиль, распадается на осколки: на месте, где она лежала, появляются копии карты, обрезанные по
 * клеткам сетки, и разлетаются вверх и в стороны, угасая. Оригинал при этом прячется. Вспышка - короткий
 * проблеск по контуру карты. Осколки - обычные DOM-копии, поэтому эффект не зависит от того, чем нарисована карта.
 */
export function shatter(el: HTMLElement, fx: FxContext): void {
  const { host, speed, tracker } = fx
  if (speed >= REDUCED_SPEED)
    return
  const baseScale = Number(gsap.getProperty(el, 'scale'))
  const parts: HTMLElement[] = []

  const copy = (deep: boolean): HTMLElement => {
    const part = el.cloneNode(deep) as HTMLElement
    part.removeAttribute('data-key')
    part.classList.remove('node--flipping')
    part.querySelectorAll('.node__hit, .node__scrap').forEach(button => button.remove())
    host.appendChild(part)
    parts.push(part)
    return part
  }

  const cleanup = (): void => {
    for (const part of parts)
      part.remove()
  }

  const timeline = gsap.timeline({ onComplete: cleanup, onInterrupt: cleanup })

  const flash = copy(false)
  flash.classList.add('node--flash')
  timeline.fromTo(flash, { opacity: 0.95, scale: baseScale }, { opacity: 0, scale: baseScale * 1.1, duration: 0.3 / speed, ease: 'power2.out' }, 0)

  const stepX = 100 / SHARD_COLS
  const stepY = 100 / SHARD_ROWS
  for (let row = 0; row < SHARD_ROWS; row++) {
    for (let col = 0; col < SHARD_COLS; col++) {
      const shard = copy(true)
      shard.classList.add('node--shard')
      shard.style.clipPath = `inset(${row * stepY}% ${100 - (col + 1) * stepX}% ${100 - (row + 1) * stepY}% ${col * stepX}%)`
      gsap.set(shard, { transformOrigin: `${(col + 0.5) * stepX}% ${(row + 0.5) * stepY}%`, opacity: 1 })
      const spreadX = (col + 0.5) / SHARD_COLS - 0.5
      const spreadY = (row + 0.5) / SHARD_ROWS - 0.5
      timeline.to(shard, {
        x: `+=${spreadX * 120 + rand(-20, 20)}`,
        y: `+=${spreadY * 60 - rand(20, 90)}`,
        rotation: `+=${rand(-50, 50)}`,
        scale: baseScale * rand(0.5, 0.9),
        opacity: 0,
        duration: rand(0.35, 0.5) / speed,
        ease: 'power2.in',
      }, (row * 0.015 + rand(0, 0.08)) / speed)
    }
  }

  // Следующее событие не ждёт, пока осколки долетят: шаг очереди заканчивается, когда распад уже заметен.
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
    shatter(el, fx)
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
