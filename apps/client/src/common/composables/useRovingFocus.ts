import type { Ref } from 'vue'
import type { RovingKey } from '../utilities/roving'
import { ref } from 'vue'
import { ROVING_KEYS, rovingTarget } from '../utilities/roving'

/**
 * Roving tabindex для сетки элементов внутри контейнера (карты в окне, варианты выбора): в обход Tab входит один
 * элемент, остальные доступны стрелками, Home и End. Элементы помечаются атрибутом data-roving с уникальным ключом.
 *
 * Использование: на контейнер - @keydown="onKeydown" и @focusin="onFocusin", на каждый элемент - :data-roving="key"
 * и :tabindex="tabindexFor(key, index)".
 */
export function useRovingFocus(container: Ref<HTMLElement | null>) {
  const activeKey = ref<string | null>(null)

  function items(): HTMLElement[] {
    return [...container.value?.querySelectorAll<HTMLElement>('[data-roving]') ?? []]
  }

  /** 0 у активного элемента (последнего, на который приходил фокус, а по умолчанию - первого), у остальных -1. */
  function tabindexFor(key: string, index: number): 0 | -1 {
    return (activeKey.value === null ? index === 0 : activeKey.value === key) ? 0 : -1
  }

  function onFocusin(event: FocusEvent): void {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-roving]')
    if (element?.dataset.roving)
      activeKey.value = element.dataset.roving
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!ROVING_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey)
      return
    const list = items()
    const from = list.findIndex(element => element === (event.target as HTMLElement).closest('[data-roving]'))
    if (from === -1)
      return
    const target = rovingTarget(list.map(element => element.getBoundingClientRect()), from, event.key as RovingKey)
    event.preventDefault()
    list[target ?? from]?.focus()
  }

  return { tabindexFor, onFocusin, onKeydown }
}
