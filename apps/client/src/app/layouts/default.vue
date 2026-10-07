<script setup lang="ts">
import { DEFAULT_PLAYER_NAMES } from '@space/protocol'
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onBeforeUnmount, provide, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppTooltip from '@/common/ui/AppTooltip.vue'
import AppVersion from '@/common/ui/AppVersion.vue'
import { BACKDROP_ANIMATED_KEY } from '@/common/ui/backdrop-animation'
import PortalOverlay from '@/common/ui/PortalOverlay.vue'
import { collapsePage, openPortal, resetPage, showPortal } from '@/common/utilities/portal-transition'
import { useGameConnection } from '@/modules/connection'
import { isReducedMotion, useSettings } from '@/modules/settings'

// Версию показываем на главном экране и на экране матча.
const route = useRoute()
const showVersion = computed(() => route.name === 'lobby' || route.name === 'match')

// Фон экранов зависит от настройки игрока: common его про настройки не знает, поэтому значение передаётся через provide.
const settings = useSettings()
provide(BACKDROP_ANIMATED_KEY, computed(() => settings.value.animatedBackground))

/*
 * Переход в матч (из ожидания соперника или при входе по коду): страница схлопывается в точку на чёрном фоне, из точки
 * вырастает портал с именами игроков в центре, держится несколько секунд, потом схлопывается и раскрывается,
 * открывая матч (portal-transition.ts). Уход из матча и остальные переходы - без анимации.
 * Без WebGL 2 и при сокращённых анимациях (в настройках или в системе) переход тоже пропускается.
 */
const router = useRouter()
const connection = useGameConnection()
const reducedBySystem = usePreferredReducedMotion()
const portal = useTemplateRef<InstanceType<typeof PortalOverlay>>('portal')
const portalActive = ref(false)
const blackUnder = ref(false)
const portalBroken = ref(false)
const names = ref<{ self: string, opponent: string }>({ self: DEFAULT_PLAYER_NAMES[0], opponent: DEFAULT_PLAYER_NAMES[1] })

/*
 * Нужен ли портал для навигации, которая сейчас идёт: выставляется до смены экрана и съедается первым же уходом
 * (wantsPortal). Одноразовость важна: внутри самой страницы тоже меняется корневой элемент (MatchPage показывает
 * «Загрузка…» вместо экрана матча после выхода), и Vue вызывает те же хуки Transition - они не должны запускать портал заново.
 */
let pendingPortal = false
const removeBeforeGuard = router.beforeEach((to, from) => {
  pendingPortal = to.name === 'match' && from.name !== 'match'
})
const removeAfterHook = router.afterEach((_to, _from, failure) => {
  if (failure)
    pendingPortal = false
})
onBeforeUnmount(() => {
  removeBeforeGuard()
  removeAfterHook()
})

/** Идёт ли сейчас переход с порталом: выбирается при уходе со старого экрана и действует до конца появления нового. */
let running = false

function wantsPortal(): boolean {
  // При прямом заходе на /match/… уходить с экрана нечему: ухода (leave) не будет, портал не нужен.
  const wanted = pendingPortal
  pendingPortal = false
  return wanted && !portalBroken.value && !isReducedMotion(settings.value, reducedBySystem.value === 'reduce')
}

/** Имена для подписи: свои и соперника по номеру места (как в MatchPage). */
function captureNames(): void {
  const { names: all, you } = connection.state
  const self = you ?? 0
  const opponent = self === 0 ? 1 : 0
  names.value = { self: all[self] || DEFAULT_PLAYER_NAMES[self], opponent: all[opponent] || DEFAULT_PLAYER_NAMES[opponent] }
}

async function onLeave(el: Element, done: () => void): Promise<void> {
  const state = portal.value?.state
  running = wantsPortal() && state !== undefined
  if (!running || !state) {
    // Синхронный done() посреди ухода (режим out-in) ломает смену экранов в Vue: завершаем после текущего патча.
    queueMicrotask(done)
    return
  }
  const speed = settings.value.animationSpeed
  captureNames()
  blackUnder.value = true
  await collapsePage(el as HTMLElement, speed)
  portalActive.value = true
  await showPortal(state, speed)
  done()
}

async function onEnter(el: Element, done: () => void): Promise<void> {
  const state = portal.value?.state
  if (!running || !state) {
    done()
    return
  }
  resetPage(el as HTMLElement)
  await openPortal(state, settings.value.animationSpeed)
  portalActive.value = false
  blackUnder.value = false
  running = false
  done()
}
</script>

<template>
  <!-- Чёрный фон под страницей: виден вокруг схлопывающейся в точку страницы. -->
  <div v-show="blackUnder" class="black-under" />
  <!-- key по имени маршрута: смена параметра (реванш: /match/<новый id>) не считается новым экраном и переходом. -->
  <RouterView v-slot="{ Component, route: current }">
    <Transition :css="false" mode="out-in" @leave="onLeave" @enter="onEnter">
      <component :is="Component" :key="String(current.name)" />
    </Transition>
  </RouterView>
  <PortalOverlay ref="portal" :active="portalActive" :names="names" @error="portalBroken = true" />
  <AppTooltip />
  <AppVersion v-if="showVersion" />
</template>

<style scoped>
.black-under {
  position: fixed;
  inset: 0;
  background: #000;
}
</style>
