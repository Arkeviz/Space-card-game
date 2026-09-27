import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { provideGameConnection } from '@/modules/connection'
import { appConfig } from './app-config'
import { setupGsap } from './integrations/gsap'
import DefaultLayout from './layouts/default.vue'
import { router } from './router'

setupGsap()

const app = createApp(DefaultLayout)

provideGameConnection(app, appConfig.wsUrl)

app
  .use(createPinia())
  .use(router)
  .mount('#app')
