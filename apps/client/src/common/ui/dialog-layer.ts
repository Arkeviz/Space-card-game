import type { InjectionKey, Ref } from 'vue'

/**
 * Слой поверх содержимого окна (AppDialog), не обрезаемый прокруткой тела окна: сюда телепортируются всплывающие
 * подсказки вроде увеличенной карты. Совпадает с областью сцены, поэтому координаты в нём - логические пиксели сцены.
 */
export const DIALOG_LAYER_KEY: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol('dialog-layer')
