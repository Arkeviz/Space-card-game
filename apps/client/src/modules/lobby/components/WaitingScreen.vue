<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useTick } from '@/common/composables/useTick'
import AppIcon from '@/common/ui/AppIcon.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { ICON } from '@/common/ui/icons'
import StageScaler from '@/common/ui/StageScaler.vue'
import { formatElapsed } from '@/common/utilities/clock'
import OrbitDecor from './OrbitDecor.vue'

/**
 * Экран ожидания соперника. С кодом - матч создан, код нужно отправить второму игроку; без кода (null) - идёт
 * быстрый поиск, соперника подберёт сервер.
 */
const props = defineProps<{
  code: string | null
  connected: boolean
}>()

const emit = defineEmits<{ cancel: [] }>()

// legacy: navigator.clipboard есть только в защищённом контексте (HTTPS), а игру открывают и по http://адрес:порт.
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
const chars = computed(() => (props.code ?? '').split(''))

const startedAt = Date.now()
const now = useTick(1000)
const elapsed = computed(() => formatElapsed(now.value.getTime() - startedAt))
</script>

<template>
  <StageScaler>
    <main class="wait space-backdrop">
      <OrbitDecor hollow />

      <p class="wait__brand">
        <AppIcon :name="ICON.LOGO" :size="30" :stroke="1.4" class="wait__logo" />
        <span class="wait__brand-name">ЗВЁЗДНЫЕ ИМПЕРИИ</span>
      </p>

      <div class="wait__column">
        <p class="wait__eyebrow">
          {{ code ? 'МАТЧ СОЗДАН' : 'БЫСТРАЯ ИГРА' }}
        </p>
        <h1 class="wait__title">
          {{ code ? 'Ждём соперника' : 'Ищем соперника' }}
        </h1>
        <p class="wait__lead">
          {{ code ? 'Отправьте код второму игроку. Партия начнётся сама, как только он войдёт.' : 'Партия начнётся сама, как только найдётся второй игрок.' }}
        </p>

        <div v-if="code" class="wait__code-block">
          <p class="wait__label">
            КОД МАТЧА
          </p>
          <div class="wait__code" role="img" :aria-label="`Код матча ${code}`">
            <div v-for="(char, index) in chars" :key="index" class="wait__char">
              {{ char }}
            </div>
          </div>
          <div class="wait__row">
            <GameButton variant="outline" :height="52" @click="copy(code)">
              <AppIcon :name="ICON.COPY" :size="17" />
              <span>{{ copied ? 'Скопировано' : 'Копировать код' }}</span>
            </GameButton>
            <p class="wait__status" role="status">
              <span class="wait__pulse" />
              <span>Ожидание подключения…</span>
            </p>
          </div>
        </div>
        <p v-else class="wait__search" role="status">
          <span class="wait__pulse" />
          <span>Поиск соперника</span>
          <span class="wait__elapsed">{{ elapsed }}</span>
        </p>

        <div class="wait__foot">
          <p v-if="code" class="wait__note">
            <AppIcon :name="ICON.INFO" :size="16" />
            <span>Код перестаёт действовать, как только соперник займёт место.</span>
          </p>
          <button type="button" class="wait__cancel" @click="emit('cancel')">
            <AppIcon :name="ICON.BACK" :size="16" />
            <span>ОТМЕНИТЬ</span>
          </button>
        </div>
      </div>

      <p class="wait__server" :class="{ 'wait__server--off': !connected }">
        <span class="wait__dot" />
        <span>{{ connected ? 'СЕРВЕР · ПОДКЛЮЧЕНО' : 'СЕРВЕР · НЕТ СВЯЗИ' }}</span>
      </p>
    </main>
  </StageScaler>
</template>

<style scoped>
.wait {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: clip;
  color: var(--c-text);
  font-family: var(--font-text);
}

.wait__brand {
  position: absolute;
  top: 64px;
  left: 160px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.wait__logo {
  color: var(--c-me);
}

.wait__brand-name {
  font: 800 18px/1 var(--font-display);
  letter-spacing: 0.02em;
}

.wait__column {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 160px;
  display: flex;
  flex-direction: column;
  gap: 26px;
  justify-content: center;
  width: 760px;
}

.wait__eyebrow {
  color: var(--c-me);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.24em;
}

.wait__title {
  margin: 0;
  font: 800 56px/1.05 var(--font-display);
}

.wait__lead {
  max-width: 560px;
  margin: 0;
  color: var(--c-text-soft);
  font: 400 19px/28px var(--font-text);
}

.wait__code-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 10px;
}

.wait__label {
  color: var(--c-muted);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.wait__code {
  display: flex;
  gap: 10px;
}

.wait__char {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 92px;
  background: var(--c-surface-raised);
  color: var(--c-text-strong);
  font: 800 44px/1 var(--font-display);
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.5);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.wait__row {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 6px;
}

.wait__status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--c-text-soft);
  font: 400 16px/1 var(--font-text);
}

.wait__search {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  color: var(--c-text-soft);
  font: 400 20px/1 var(--font-text);
}

.wait__elapsed {
  color: var(--c-text-strong);
  font: 600 20px/1 var(--font-mono);
  letter-spacing: 0.08em;
}

.wait__pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-trade);
  box-shadow: 0 0 0 5px rgba(255, 194, 61, 0.16), 0 0 14px rgba(255, 194, 61, 0.7);
  animation: wait-pulse 1.6s ease-in-out infinite;
}

@keyframes wait-pulse {
  50% {
    opacity: 0.45;
  }
}

.wait__foot {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 18px;
}

.wait__note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 560px;
  color: var(--c-muted);
  font: 400 14px/20px var(--font-text);
}

.wait__cancel {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  padding: 8px 0;
  border: 0;
  background: none;
  color: var(--c-text-quiet);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.16em;
  cursor: pointer;
}

.wait__cancel:hover {
  color: var(--c-me);
}

.wait__server {
  position: absolute;
  bottom: 56px;
  left: 160px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--c-muted);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.16em;
}

.wait__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-authority);
  box-shadow: 0 0 10px rgba(63, 224, 160, 0.7);
}

.wait__server--off .wait__dot {
  background: var(--c-combat);
  box-shadow: 0 0 10px rgba(255, 90, 79, 0.7);
}

@media (prefers-reduced-motion: reduce) {
  .wait__pulse {
    animation: none;
  }
}
</style>
