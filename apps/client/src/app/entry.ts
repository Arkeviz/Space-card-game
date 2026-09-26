import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { setupGsap } from './integrations/gsap'
import DefaultLayout from './layouts/default.vue'
import { router } from './router'

setupGsap()

createApp(DefaultLayout)
  .use(createPinia())
  .use(router)
  .mount('#app')
