import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Версия приложения - из package.json клиента: единственное место, где её нужно менять.
const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { version: string }

// Идентификатор сборки: клиент сравнивает его с version.json на сервере, чтобы заметить выход новой версии (modules/app-update).
const buildId = Date.now().toString(36)

/** Кладёт в сборку version.json с идентификатором сборки. В dev-сервере файла нет: проверка обновлений там отключена. */
function buildIdFile(): Plugin {
  return {
    name: 'space-build-id-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId }) })
    },
  }
}

export default defineConfig({
  // Подпапка, из которой раздаётся сайт. Задаётся только при сборке для GitHub Pages (`/<репозиторий>/`), иначе корень.
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue(), buildIdFile()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
