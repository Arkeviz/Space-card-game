import { useEventListener, useIntervalFn } from '@vueuse/core'
import { ref } from 'vue'
import { fetchServerBuildId, isNewBuild } from '../lib/update-check'

const CHECK_INTERVAL_MS = 60_000

/**
 * Следит, не вышла ли новая версия: раз в минуту и при возврате на вкладку сравнивает сборку на сервере с запущенной.
 * Обнаружив новую, останавливается: `available` обратно не сбрасывается. В dev-сервере version.json нет, проверка отключена.
 */
export function useAppUpdate(enabled: boolean = import.meta.env.PROD) {
  const available = ref(false)
  let checking = false

  async function check(): Promise<void> {
    if (checking || available.value)
      return
    checking = true
    try {
      available.value = isNewBuild(await fetchServerBuildId(import.meta.env.BASE_URL), __BUILD_ID__)
    }
    finally {
      checking = false
    }
  }

  if (enabled) {
    const timer = useIntervalFn(() => {
      void check()
      if (available.value)
        timer.pause()
    }, CHECK_INTERVAL_MS)
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible')
        void check()
    })
  }

  return { available }
}
