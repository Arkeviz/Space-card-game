<script setup lang="ts">
import type { Pose } from '../lib/layout'
/*
 * Единый слой всех видимых карт стола. Зоны (рука, ряд, поле, стопки) - только разметка и геометрия; сами карты
 * лежат здесь плоским списком с ключом по id экземпляра. Когда карта меняет зону, компонент не пересоздаётся:
 * меняется её целевая поза, и GSAP анимирует transform. Новые карты появляются из точки, которую задаёт Motion
 * (колода, рука соперника), исчезающие - улетают в заданную точку или растворяются.
 */
import type { Motion, SpawnHint } from '../lib/motion'
import type { CardNode } from '../lib/nodes'
import gsap from 'gsap'
import { nextTick, onMounted, ref, watch } from 'vue'
import { emptyMotion } from '../lib/motion'
import { NODE_ZONE } from '../lib/nodes'
import CardNodeView from './CardNodeView.vue'

const props = defineProps<{
  nodes: CardNode[]
  /** Множитель скорости анимаций: больше - быстрее (очередь событий растёт, prefers-reduced-motion). */
  speed: number
}>()

const emit = defineEmits<{
  click: [node: CardNode]
  highlight: [key: string | null]
  scrap: [node: CardNode]
}>()

const root = ref<HTMLElement | null>(null)

/** Время перелёта карты между зонами и быстрого отклика на наведение, секунды при speed = 1. */
const MOVE_DURATION = 0.55
const HOVER_DURATION = 0.18
const FADE_DURATION = 0.3
const FLIP_RATIO = 0.8
/** Во время полёта карта лежит поверх всех остальных. */
const FLYING_Z = 200

interface Applied {
  pose: Pose
  zone: CardNode['zone']
}

const applied = new Map<string, Applied>()
const pending: Promise<void>[] = []
let motion: Motion = emptyMotion()
let snapNext = false

/**
 * Добавляет твин в список ожидаемых. Колбэки, уже заданные у твина (снять z-index, закончить переворот),
 * сохраняются: eventCallback заменяет их, а без них карта навсегда остаётся в «летящем» состоянии
 * с 3D-контекстом, и текст на ней размыт.
 */
function track(tween: gsap.core.Animation): void {
  // Твин, завершившийся при создании (нулевая длительность), своих колбэков уже не вызовет: ждать его нельзя.
  if (tween.duration() === 0)
    return
  const complete = tween.eventCallback('onComplete')
  const interrupt = tween.eventCallback('onInterrupt')
  pending.push(new Promise((resolve) => {
    tween.eventCallback('onComplete', () => {
      complete?.call(tween)
      resolve()
    })
    // Перезапущенная твином карта (быстрое наведение, новый ход) не должна подвешивать очередь событий.
    tween.eventCallback('onInterrupt', () => {
      interrupt?.call(tween)
      resolve()
    })
  }))
}

function poseVars(pose: Pose): gsap.TweenVars {
  return { x: pose.x, y: pose.y, rotation: pose.rot, scale: pose.scale, opacity: pose.opacity }
}

function find(key: string): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null
}

function flipOf(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>('[data-flip]')
}

function samePose(a: Pose, b: Pose): boolean {
  return a.x === b.x && a.y === b.y && a.rot === b.rot && a.scale === b.scale && a.opacity === b.opacity && a.z === b.z
}

/* ---------- Расщепление утилизированной карты ---------- */

const SHARD_COLS = 4
const SHARD_ROWS = 6
/** При таком множителе скорости (prefers-reduced-motion) эффекты движения не показываются вовсе. */
const REDUCED_SPEED = 10
const rand = gsap.utils.random

/**
 * Карта, уходящая в утиль, распадается на осколки: на месте, где она лежала, появляются копии карты, обрезанные по
 * клеткам сетки, и разлетаются вверх и в стороны, угасая. Оригинал при этом прячется. Вспышка - короткий
 * проблеск по контуру карты. Осколки - обычные DOM-копии, поэтому эффект не зависит от того, чем нарисована карта.
 */
function shatter(el: HTMLElement): void {
  const host = root.value
  if (!host || props.speed >= REDUCED_SPEED)
    return
  const { speed } = props
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
  pending.push(new Promise((resolve) => {
    gsap.delayedCall(0.12 / speed, resolve)
  }))
}

/** Карта появилась уже утилизированной (из руки соперника или из глубины сброса): показывается и тут же распадается. */
function spawnScrapped(el: HTMLElement, node: CardNode, hint: SpawnHint | undefined): void {
  const toHeap = (): void => {
    gsap.set(el, { ...poseVars(node.pose), zIndex: node.pose.z })
  }
  if (!hint || props.speed >= REDUCED_SPEED) {
    toHeap()
    return
  }

  const flip = flipOf(el)
  const reveal = hint.faceDown && flip
  // Карта из руки соперника сначала спускается из веера и переворачивается, чтобы было видно, что это за карта.
  const at: Pose = reveal ? { ...hint.from, y: hint.from.y + 190, scale: 0.8, rot: 0 } : hint.from
  gsap.set(el, { ...poseVars(at), opacity: 1, zIndex: FLYING_Z })
  const finish = (): void => {
    shatter(el)
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
  track(gsap.to(flip, {
    rotationY: 0,
    duration: 0.2 / props.speed,
    ease: 'power2.inOut',
    onComplete: () => {
      endFlip()
      finish()
    },
    onInterrupt: endFlip,
  }))
}

function spawn(el: HTMLElement, node: CardNode): void {
  gsap.set(el, { xPercent: -50, yPercent: -50 })
  if (snapNext) {
    gsap.set(el, { ...poseVars(node.pose), zIndex: node.pose.z })
    return
  }

  const hint = motion.spawn.get(node.key)
  if (node.zone === NODE_ZONE.SCRAP) {
    spawnScrapped(el, node, hint)
    return
  }
  const delay = (motion.delay.get(node.key) ?? 0) / props.speed
  const duration = MOVE_DURATION / props.speed
  const from: Pose = hint ? { ...hint.from } : { ...node.pose, opacity: 0 }
  gsap.set(el, { ...poseVars(from), zIndex: FLYING_Z })

  // Пока карта ждёт своей очереди (раздача по одной), её не видно.
  if (delay > 0)
    gsap.set(el, { opacity: 0 })

  const flip = flipOf(el)
  const flips = hint?.faceDown && node.cardId !== null && flip
  if (flips) {
    el.classList.add('node--flipping')
    gsap.set(flip, { rotationY: 180 })
  }

  const tween = gsap.to(el, {
    ...poseVars(node.pose),
    duration: hint ? duration : FADE_DURATION / props.speed,
    delay,
    ease: 'power3.inOut',
    onComplete: () => {
      gsap.set(el, { zIndex: node.pose.z })
    },
  })
  track(tween)

  if (flips) {
    const endFlip = (): void => {
      el.classList.remove('node--flipping')
      gsap.set(flip, { clearProps: 'transform' })
    }
    track(gsap.to(flip, { rotationY: 0, duration: duration * FLIP_RATIO, delay: delay + duration * (1 - FLIP_RATIO) / 2, ease: 'power2.inOut', onComplete: endFlip, onInterrupt: endFlip }))
  }
}

function move(el: HTMLElement, node: CardNode, previous: Applied): void {
  if (snapNext) {
    gsap.set(el, { ...poseVars(node.pose), zIndex: node.pose.z })
    return
  }

  // Карта ушла в утиль: на месте, где она лежала, она распадается, а оригинал сразу переезжает в кучу невидимым.
  if (node.zone === NODE_ZONE.SCRAP && previous.zone !== NODE_ZONE.SCRAP) {
    shatter(el)
    // Мгновенный переезд: нулевой твин завершается при создании, ждать его в очереди нельзя (шаг завис бы до аварийного таймаута).
    gsap.to(el, { ...poseVars(node.pose), zIndex: node.pose.z, duration: 0, overwrite: 'auto' })
    return
  }

  // Подъём карты под курсором в руке: короткий отклик, не «перелёт».
  const isHoverShift = node.zone === NODE_ZONE.HAND && previous.zone === NODE_ZONE.HAND
  const duration = (isHoverShift ? HOVER_DURATION : MOVE_DURATION) / props.speed
  const delay = isHoverShift ? 0 : (motion.delay.get(node.key) ?? 0) / props.speed

  gsap.set(el, { zIndex: isHoverShift ? node.pose.z : FLYING_Z })
  const tween = gsap.to(el, {
    ...poseVars(node.pose),
    duration,
    delay,
    ease: isHoverShift ? 'power2.out' : 'power3.inOut',
    overwrite: 'auto',
    onComplete: () => {
      gsap.set(el, { zIndex: node.pose.z })
    },
  })
  track(tween)
}

function applyNodes(nodes: CardNode[]): void {
  const keys = new Set<string>()
  for (const node of nodes) {
    keys.add(node.key)
    const el = find(node.key)
    if (!el)
      continue
    const previous = applied.get(node.key)
    if (!previous)
      spawn(el, node)
    else if (!samePose(previous.pose, node.pose))
      move(el, node, previous)
    applied.set(node.key, { pose: node.pose, zone: node.zone })
  }
  for (const key of applied.keys()) {
    if (!keys.has(key))
      applied.delete(key)
  }
  snapNext = false
}

watch(() => props.nodes, applyNodes, { flush: 'post' })

// Карты, уже лежащие на столе к моменту монтирования (вход в идущий матч), ставятся сразу, без анимации.
onMounted(() => {
  snapNext = true
  applyNodes(props.nodes)
})

function onLeave(el: Element, done: () => void): void {
  const key = (el as HTMLElement).dataset.key ?? ''
  const exit = motion.exit.get(key)
  if (snapNext) {
    done()
    return
  }
  const tween = gsap.to(el, {
    ...(exit ? poseVars(exit) : { opacity: 0 }),
    duration: (exit ? MOVE_DURATION : FADE_DURATION) / props.speed,
    ease: 'power2.in',
    onComplete: done,
    onInterrupt: done,
  })
  track(tween)
}

defineExpose({
  /** Подсказки для ближайшего изменения списка карт. */
  setMotion(next: Motion): void {
    motion = next
  },
  /** Ближайшее изменение списка применить мгновенно, без анимации (возврат в игру, сверка состояний). */
  snapNext(): void {
    snapNext = true
  },
  /** Разрешается, когда завершились все анимации, начатые после последнего изменения списка карт. */
  async settled(): Promise<void> {
    await nextTick()
    const running = pending.splice(0)
    await Promise.all(running)
  },
})
</script>

<template>
  <div ref="root" class="card-layer">
    <TransitionGroup tag="div" :css="false" @leave="onLeave">
      <CardNodeView
        v-for="node in nodes"
        :key="node.key"
        :node="node"
        @click="emit('click', $event)"
        @highlight="emit('highlight', $event)"
        @scrap="emit('scrap', $event)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.card-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
