/// <reference types="vite/client" />

/** Версия приложения из apps/client/package.json; подставляется Vite при сборке (`define` в vite.config.ts). */
declare const __APP_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}
