<script setup lang="ts">
import { computed } from 'vue'
import { useTick } from '@/common/composables/useTick'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'

/** Сколько осталось до автоматического ответа сервера (таймаут бездействия). */
const props = defineProps<{ deadline: number | null }>()

const now = useTick()
const clock = computed(() => {
  if (props.deadline === null)
    return ''
  const total = Math.max(0, Math.ceil((props.deadline - now.value.getTime()) / 1000))
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
})
</script>

<template>
  <p v-if="deadline !== null" class="timer">
    <AppIcon :name="ICON.CLOCK" :size="14" />
    <span>{{ clock }}</span>
  </p>
</template>

<style scoped>
.timer {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--c-text-quiet);
  font: 600 14px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1em;
}
</style>
