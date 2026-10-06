import type { InjectionKey, Ref } from 'vue'

/**
 * Включён ли анимированный фон (шейдер) в SpaceBackdrop. Значение приходит из настроек игрока: приложение
 * (app/layouts) передаёт его сюда, а common про настройки ничего не знает. Без значения фон анимированный.
 */
export const BACKDROP_ANIMATED_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('backdrop-animated')
