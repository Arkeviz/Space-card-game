import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Версия приложения - из package.json клиента: единственное место, где её нужно менять.
const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { version: string }

export default defineConfig({
  // Подпапка, из которой раздаётся сайт. Задаётся только при сборке для GitHub Pages (`/<репозиторий>/`), иначе корень.
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
