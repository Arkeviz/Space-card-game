import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'lobby', component: () => import('@/pages/lobby/LobbyPage.vue') },
    { path: '/cards', name: 'cards', component: () => import('@/pages/catalog/CatalogPage.vue') },
    { path: '/match/:id', name: 'match', component: () => import('@/pages/match/MatchPage.vue') },
  ],
})
