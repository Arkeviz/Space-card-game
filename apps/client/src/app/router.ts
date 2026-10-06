import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  // BASE_URL - из `base` в vite.config.ts: «/» везде, кроме GitHub Pages, где сайт лежит в подпапке /<репозиторий>/.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'lobby', component: () => import('@/pages/lobby/LobbyPage.vue') },
    { path: '/cards', name: 'cards', component: () => import('@/pages/catalog/CatalogPage.vue') },
    { path: '/match/:id', name: 'match', component: () => import('@/pages/match/MatchPage.vue') },
  ],
})
