import type { Ref } from 'vue'
import type { CardNode, DragState } from '../lib/nodes'
import type { TweenTracker } from '../lib/tween-tracker'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { HOVER_DURATION, MOVE_DURATION, poseVars } from '../lib/card-fx'
import { insideAny } from '../lib/layout'

/** Сразу после перетаскивания браузер присылает click: он не должен играть карту второй раз. */
const CLICK_AFTER_DRAG_MS = 250
const MIN_DRAG_PX = 8
const DRAG_Z = 400

interface DragOptions {
  /** Слой карт: относительно него считаются координаты указателя. */
  root: Ref<HTMLElement | null>
  /** Множитель скорости анимаций (меняется во время работы, поэтому функцией). */
  speed: () => number
  tracker: TweenTracker
  /** DOM-элемент карты по ключу. */
  find: (key: string) => HTMLElement | null
  /** Карту начали, тянут или бросили (null). */
  onDrag: (state: DragState | null) => void
  /** Карту отпустили над её зоной: нужно выполнить команду. */
  onDrop: (node: CardNode) => void
}

/**
 * Перетаскивание карт (GSAP Draggable): у узла есть node.drag с командой и зонами броска. Карта, брошенная мимо
 * зоны или отклонённая сервером, возвращается на место, а click сразу после броска игнорируется.
 */
export function useCardDrag(options: DragOptions) {
  const { root, tracker, find } = options

  /** Последняя известная модель каждой карты: колбэки Draggable живут дольше одного рендера. */
  const latest = new Map<string, CardNode>()
  const draggables = new Map<string, Draggable>()
  /** Карты, которые отпустили над зоной: ждём ответа сервера, чтобы вернуть на место, если команду не приняли. */
  const dropped = new Set<string>()
  let draggingKey: string | null = null
  let lastDragEnd = 0

  /** Координаты указателя в логических пикселях сцены (сцена масштабируется целиком, StageScaler). */
  function stagePoint(event: PointerEvent | MouseEvent): { x: number, y: number } | null {
    const layerEl = root.value
    if (!layerEl)
      return null
    const rect = layerEl.getBoundingClientRect()
    const k = rect.width / layerEl.offsetWidth
    return { x: (event.clientX - rect.left) / k, y: (event.clientY - rect.top) / k }
  }

  function isInside(node: CardNode, event: PointerEvent | MouseEvent): boolean {
    const point = stagePoint(event)
    return !!point && !!node.drag && insideAny(node.drag.rects, point.x, point.y)
  }

  function returnToPose(key: string): void {
    const el = find(key)
    const node = latest.get(key)
    if (!el || !node)
      return
    tracker.track(gsap.to(el, { ...poseVars(node.pose), zIndex: node.pose.z, duration: MOVE_DURATION / 2 / options.speed(), ease: 'power3.out', overwrite: 'auto' }))
  }

  function startDrag(key: string, el: HTMLElement): Draggable | undefined {
    const trigger = el.querySelector<HTMLElement>('.node__hit')
    if (!trigger)
      return undefined
    const [instance] = Draggable.create(el, {
      type: 'x,y',
      trigger,
      minimumMovement: MIN_DRAG_PX,
      zIndexBoost: false,
      onPress() {
        // Карта в полёте или в руке: перехватываем, чтобы твин не вырывал её из-под пальца.
        gsap.killTweensOf(el, 'x,y')
      },
      onDragStart() {
        const node = latest.get(key)
        if (!node?.drag)
          return
        draggingKey = key
        gsap.set(el, { zIndex: DRAG_Z })
        // Карта руки выпрямляется и чуть вырастает: так видно, что её держат.
        gsap.to(el, { rotation: 0, scale: node.pose.scale * 1.06, duration: HOVER_DURATION, overwrite: 'auto' })
        options.onDrag({ key, zone: node.drag.zone, rects: node.drag.rects, inside: false })
      },
      onDrag(event: PointerEvent) {
        const node = latest.get(key)
        if (node?.drag)
          options.onDrag({ key, zone: node.drag.zone, rects: node.drag.rects, inside: isInside(node, event) })
      },
      onDragEnd(event: PointerEvent) {
        const node = latest.get(key)
        draggingKey = null
        lastDragEnd = performance.now()
        options.onDrag(null)
        if (node?.drag && isInside(node, event)) {
          dropped.add(key)
          options.onDrop(node)
        }
        else {
          returnToPose(key)
        }
      },
    })
    return instance
  }

  /** Включает и выключает перетаскивание у карт в соответствии с их моделью (node.drag). */
  function sync(nodes: CardNode[]): void {
    const keys = new Set<string>()
    for (const node of nodes) {
      keys.add(node.key)
      latest.set(node.key, node)
      const existing = draggables.get(node.key)
      if (node.drag && !existing) {
        const el = find(node.key)
        const instance = el ? startDrag(node.key, el) : undefined
        if (instance)
          draggables.set(node.key, instance)
      }
      else if (!node.drag && existing) {
        existing.kill()
        draggables.delete(node.key)
      }
    }
    for (const [key, instance] of draggables) {
      if (!keys.has(key)) {
        instance.kill()
        draggables.delete(key)
      }
    }
    for (const key of latest.keys()) {
      if (!keys.has(key)) {
        latest.delete(key)
        dropped.delete(key)
      }
    }
  }

  /** Click сразу после броска - не настоящий: он пришёл от того же нажатия. */
  function clickAllowed(): boolean {
    return performance.now() - lastDragEnd >= CLICK_AFTER_DRAG_MS
  }

  /** Карту сейчас держат в руке: позиции ей не трогаем. */
  function isDragging(key: string): boolean {
    return key === draggingKey
  }

  /** Карта поменяла позицию сама: брошенной она больше не считается. */
  function forgetDrop(key: string): void {
    dropped.delete(key)
  }

  /**
   * Карту отпустили над зоной, но команду не приняли (ввод снова открыт, поза та же): возвращаем.
   * true, если возврат запущен.
   */
  function returnRejected(node: CardNode): boolean {
    if (!dropped.has(node.key) || !node.drag)
      return false
    dropped.delete(node.key)
    returnToPose(node.key)
    return true
  }

  function dispose(): void {
    for (const instance of draggables.values())
      instance.kill()
    draggables.clear()
  }

  return { sync, clickAllowed, isDragging, forgetDrop, returnRejected, dispose }
}
