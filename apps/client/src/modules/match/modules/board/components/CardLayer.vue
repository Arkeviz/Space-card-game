<script setup lang="ts">
import type { FxContext } from '../lib/card-fx'
import type { Pose } from '../lib/layout'
/*
 * Единый слой всех видимых карт стола. Зоны (рука, ряд, поле, стопки) - только разметка и геометрия; сами карты
 * лежат здесь плоским списком с ключом по id экземпляра. Когда карта меняет зону, компонент не пересоздаётся:
 * меняется её целевая поза, и GSAP анимирует transform. Новые карты появляются из точки, которую задаёт Motion
 * (колода, рука соперника), исчезающие - улетают в заданную точку или растворяются.
 *
 * Эффекты (расщепление утиля) - lib/card-fx.ts, ожидание анимаций - lib/tween-tracker.ts, перетаскивание -
 * composables/useCardDrag.ts.
 */
import type { Motion } from '../lib/motion'
import type { CardNode, DragState, NavKey } from '../lib/nodes'
import gsap from 'gsap'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCardDrag } from '../composables/useCardDrag'
import { FADE_DURATION, FLIP_RATIO, flipOf, FLYING_Z, HOVER_DURATION, MOVE_DURATION, poseVars, shatter, spawnScrapped } from '../lib/card-fx'
import { emptyMotion } from '../lib/motion'
import { NODE_ZONE } from '../lib/nodes'
import { TweenTracker } from '../lib/tween-tracker'
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
  focused: [node: CardNode]
  navigate: [node: CardNode, key: NavKey]
  /** Карту начали, тянут или бросили (null). */
  drag: [state: DragState | null]
  /** Карту отпустили над её зоной: нужно выполнить команду. */
  drop: [node: CardNode]
}>()

const root = ref<HTMLElement | null>(null)

interface Applied {
  pose: Pose
  zone: CardNode['zone']
}

const applied = new Map<string, Applied>()
const tracker = new TweenTracker()
let motion: Motion = emptyMotion()
let snapNext = false

function find(key: string): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null
}

function samePose(a: Pose, b: Pose): boolean {
  return a.x === b.x && a.y === b.y && a.rot === b.rot && a.scale === b.scale && a.opacity === b.opacity && a.z === b.z
}

/** Контекст эффектов собирается заново на каждый вызов: speed и слой могут меняться. */
function fxContext(): FxContext | null {
  return root.value ? { host: root.value, speed: props.speed, tracker } : null
}

const drag = useCardDrag({
  root,
  speed: () => props.speed,
  tracker,
  find,
  onDrag: state => emit('drag', state),
  onDrop: node => emit('drop', node),
})

function shatterCard(el: HTMLElement): void {
  const fx = fxContext()
  if (fx)
    shatter(el, fx)
}

function spawn(el: HTMLElement, node: CardNode): void {
  gsap.set(el, { xPercent: -50, yPercent: -50 })
  if (snapNext) {
    gsap.set(el, { ...poseVars(node.pose), zIndex: node.pose.z })
    return
  }

  const hint = motion.spawn.get(node.key)
  if (node.zone === NODE_ZONE.SCRAP) {
    const fx = fxContext()
    if (fx)
      spawnScrapped(el, node.pose, hint, fx)
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
  tracker.track(tween)

  if (flips) {
    const endFlip = (): void => {
      el.classList.remove('node--flipping')
      gsap.set(flip, { clearProps: 'transform' })
    }
    tracker.track(gsap.to(flip, { rotationY: 0, duration: duration * FLIP_RATIO, delay: delay + duration * (1 - FLIP_RATIO) / 2, ease: 'power2.inOut', onComplete: endFlip, onInterrupt: endFlip }))
  }
}

function move(el: HTMLElement, node: CardNode, previous: Applied): void {
  if (snapNext) {
    gsap.set(el, { ...poseVars(node.pose), zIndex: node.pose.z })
    return
  }

  // Карта ушла в утиль: на месте, где она лежала, она распадается, а оригинал сразу переезжает в кучу невидимым.
  if (node.zone === NODE_ZONE.SCRAP && previous.zone !== NODE_ZONE.SCRAP) {
    shatterCard(el)
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
  tracker.track(tween)
}

function onNodeClick(node: CardNode): void {
  if (drag.clickAllowed())
    emit('click', node)
}

function applyNodes(nodes: CardNode[]): void {
  const keys = new Set<string>()
  for (const node of nodes) {
    keys.add(node.key)
    const el = find(node.key)
    if (!el)
      continue
    const previous = applied.get(node.key)
    if (!previous) {
      spawn(el, node)
    }
    else if (drag.isDragging(node.key)) {
      // Карту держат в руке: позиции не трогаем, после броска она вернётся к последней известной.
    }
    else if (!samePose(previous.pose, node.pose)) {
      drag.forgetDrop(node.key)
      move(el, node, previous)
    }
    else {
      // Карту отпустили над зоной, но команду не приняли (ввод снова открыт, поза та же): возвращаем.
      drag.returnRejected(node)
    }
    applied.set(node.key, { pose: node.pose, zone: node.zone })
  }
  for (const key of applied.keys()) {
    if (!keys.has(key))
      applied.delete(key)
  }
  drag.sync(nodes)
  snapNext = false
}

onBeforeUnmount(() => drag.dispose())

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
  tracker.track(tween)
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
  /** Переводит фокус на кнопку карты (навигация стрелками, возврат фокуса после хода). */
  focusNode(key: string): boolean {
    const target = find(key)?.querySelector<HTMLElement>('.node__hit')
    target?.focus()
    return target !== null && target !== undefined
  },
  /** Разрешается, когда завершились все анимации, начатые после последнего изменения списка карт. */
  async settled(): Promise<void> {
    await nextTick()
    await tracker.settled()
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
        @click="onNodeClick"
        @highlight="emit('highlight', $event)"
        @scrap="emit('scrap', $event)"
        @focused="emit('focused', $event)"
        @navigate="(node, key) => emit('navigate', node, key)"
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
