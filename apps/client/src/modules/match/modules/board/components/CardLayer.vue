<script setup lang="ts">
import type { Pose } from '../lib/layout'
/*
 * Единый слой всех видимых карт стола. Зоны (рука, ряд, поле, стопки) - только разметка и геометрия; сами карты
 * лежат здесь плоским списком с ключом по id экземпляра. Когда карта меняет зону, компонент не пересоздаётся:
 * меняется её целевая поза, и GSAP анимирует transform. Новые карты появляются из точки, которую задаёт Motion
 * (колода, рука соперника), исчезающие - улетают в заданную точку или растворяются.
 */
import type { Motion } from '../lib/motion'
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

function track(tween: gsap.core.Tween): void {
  pending.push(new Promise((resolve) => {
    tween.eventCallback('onComplete', () => resolve())
    // Перезапущенная твином карта (быстрое наведение, новый ход) не должна подвешивать очередь событий.
    tween.eventCallback('onInterrupt', () => resolve())
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

function spawn(el: HTMLElement, node: CardNode): void {
  gsap.set(el, { xPercent: -50, yPercent: -50 })
  if (snapNext) {
    gsap.set(el, { ...poseVars(node.pose), zIndex: node.pose.z })
    return
  }

  const hint = motion.spawn.get(node.key)
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
