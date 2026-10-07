import { gsap } from 'gsap'

/** Что шейдер портала (portal.glsl) и подпись читают как параметры, 0-1. */
export interface PortalState {
  /** Рост портала от точки до полного размера. */
  appear: number
  /** Раскрытие: внутренность прозрачна, кайма разлетается за края окна. */
  open: number
  /** Непрозрачный чёрный фон вокруг портала. */
  black: number
  /** Прозрачность подписи «Имя VS Имя». */
  names: number
}

/** Сколько секунд в центре портала видны имена игроков (при скорости 1). */
export const NAMES_SECONDS = 3

function play(build: (timeline: gsap.core.Timeline) => void, speed: number): Promise<void> {
  return new Promise((resolve) => {
    const timeline = gsap.timeline({ onComplete: resolve })
    build(timeline)
    timeline.timeScale(speed)
  })
}

/** Страница равномерно сжимается со всех сторон в точку в центре окна, вокруг остаётся чёрный фон. ~0.6 с. */
export function collapsePage(el: HTMLElement, speed = 1): Promise<void> {
  gsap.set(el, { transformOrigin: '50% 50%', willChange: 'transform' })
  return play((tl) => {
    tl.to(el, { scale: 0, duration: 0.6, ease: 'power2.in' }, 0)
  }, speed)
}

/**
 * Из точки вырастает портал, в его центре проявляются имена и держатся NAMES_SECONDS. Чёрный фон вокруг включается
 * сразу: страница уже схлопнулась и невидима.
 */
export function showPortal(state: PortalState, speed = 1): Promise<void> {
  state.black = 1
  return play((tl) => {
    tl.to(state, { appear: 1, duration: 0.9, ease: 'back.out(1.3)' }, 0)
    tl.to(state, { names: 1, duration: 0.5, ease: 'power2.out' }, 0.6)
    // Имена полностью видны NAMES_SECONDS: пауза после их появления.
    tl.to({}, { duration: NAMES_SECONDS }, 1.1)
  }, speed)
}

/**
 * Портал схлопывается (пружина вовнутрь) и раскрывается: подпись гаснет, внутренность становится прозрачной, кайма
 * разлетается за края окна и открывает новую страницу. Потом всё сбрасывается в исходное состояние. ~1.3 с.
 */
export function openPortal(state: PortalState, speed = 1): Promise<void> {
  return play((tl) => {
    tl.to(state, { names: 0, duration: 0.25, ease: 'power2.in' }, 0)
    tl.to(state, { appear: 0.82, duration: 0.3, ease: 'power2.inOut' }, 0)
    tl.to(state, { open: 1, duration: 1.0, ease: 'power3.in' }, 0.3)
  }, speed).then(() => {
    state.appear = 0
    state.open = 0
    state.black = 0
    state.names = 0
  })
}

/** Убирает следы анимации со страницы (после схлопывания старая страница удаляется, но на всякий случай). */
export function resetPage(el: HTMLElement): void {
  gsap.set(el, { clearProps: 'transform,borderRadius,willChange,transformOrigin,opacity' })
}
