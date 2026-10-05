<script setup lang="ts">
import { useRouter } from 'vue-router'
import { CatalogScreen } from '@/modules/catalog'

const router = useRouter()
</script>

<template>
  <CatalogScreen @back="router.push('/')" />
</template>
