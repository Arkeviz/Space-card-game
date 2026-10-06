import type { Ref } from 'vue'
import type { Settings } from '../lib/settings'
import { useStorage } from '@vueuse/core'
import { DEFAULT_SETTINGS, parseSettings } from '../lib/settings'

const STORAGE_KEY = 'space-card-game:settings'

let shared: Ref<Settings> | undefined

/**
 * Настройки игрока: одно реактивное хранилище на всё приложение (localStorage). Читаются через parseSettings,
 * поэтому испорченное или устаревшее значение не ломает игру. Если localStorage недоступен (приватный режим),
 * настройки живут в памяти до перезагрузки страницы.
 */
export function useSettings(): Ref<Settings> {
  shared ??= useStorage<Settings>(STORAGE_KEY, { ...DEFAULT_SETTINGS }, undefined, {
    serializer: {
      read: (raw) => {
        try {
          return parseSettings(JSON.parse(raw))
        }
        catch {
          return { ...DEFAULT_SETTINGS }
        }
      },
      write: value => JSON.stringify(value),
    },
    onError: () => {},
  })
  return shared
}
