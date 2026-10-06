import type { Ref } from 'vue'
import type { CardNode, NavKey, NodeGroup } from '../lib/nodes'
import { computed, nextTick, ref, watch } from 'vue'
import { applyRoving, focusables, navigateTarget } from '../lib/nodes'

interface FocusOptions {
  /** Карты до разметки roving tabindex (buildNodes). */
  baseNodes: Readonly<Ref<CardNode[]>>
  /** Перевести фокус на карту по ключу. */
  focusNode: (key: string) => void
}

/**
 * Клавиатурный фокус на поле: в каждой группе карт в обход Tab входит одна (roving tabindex), стрелки ходят
 * по группе и между группами, а когда сфокусированная карта пропала (её сыграли или купили), фокус возвращается
 * на ту же позицию группы.
 */
export function useBoardFocus(options: FocusOptions) {
  /** Какая карта группы входит в обход Tab: последняя, на которую приходил фокус. */
  const rememberedFocus = ref<Partial<Record<NodeGroup, string>>>({})

  /** Узлы с проставленным tabindex: именно они рисуются. */
  const nodes = computed(() => applyRoving(options.baseNodes.value, rememberedFocus.value))

  /** Куда вернуть фокус, если сфокусированная карта пропала: на ту же позицию группы. */
  const focused = ref<{ key: string, group: NodeGroup | null, index: number } | null>(null)

  function onFocused(node: CardNode): void {
    if (node.group)
      rememberedFocus.value = { ...rememberedFocus.value, [node.group]: node.key }
    focused.value = { key: node.key, group: node.group, index: node.group ? focusables(nodes.value, node.group).findIndex(item => item.key === node.key) : -1 }
  }

  function onNavigate(node: CardNode, key: NavKey): void {
    const target = navigateTarget(nodes.value, node, key)
    if (target)
      options.focusNode(target.key)
  }

  watch(nodes, async () => {
    const last = focused.value
    if (!last?.group)
      return
    await nextTick()
    const active = document.activeElement
    // Фокус остался на странице (например, на кнопке «Конец хода») или внутри окна - его не трогаем.
    if (active && active !== document.body)
      return
    if (document.querySelector('[role="dialog"]'))
      return
    const row = focusables(nodes.value, last.group)
    if (row.some(item => item.key === last.key))
      return
    const next = row[Math.min(Math.max(last.index, 0), row.length - 1)]
    if (next)
      options.focusNode(next.key)
  })

  /** Переводит фокус в группу карт: на запомненную в ней или самую левую (например, в руку, когда открылся запрос на сброс). */
  function focusGroup(group: NodeGroup): void {
    const row = focusables(nodes.value, group)
    const target = row.find(node => node.key === rememberedFocus.value[group]) ?? row[0]
    if (target)
      options.focusNode(target.key)
  }

  return { nodes, onFocused, onNavigate, focusGroup }
}
