<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { ICON } from '@/common/ui/icons'
import StageScaler from '@/common/ui/StageScaler.vue'
import OrbitDecor from './OrbitDecor.vue'

const props = defineProps<{
  /** Есть ли связь с сервером. */
  connected: boolean
  /** Текст ошибки последней попытки (неверный код и т. п.). */
  error: string | null
}>()

const emit = defineEmits<{
  create: []
  join: [code: string]
}>()

const CODE_LENGTH = 6
const code = ref('')
const canJoin = computed(() => props.connected && code.value.trim().length === CODE_LENGTH)

function submit(): void {
  if (canJoin.value)
    emit('join', code.value.trim())
}
</script>

<template>
  <StageScaler>
    <main class="lobby space-backdrop">
      <OrbitDecor />

      <div class="lobby__column">
        <div class="lobby__eyebrow">
          ДУЭЛЬ 1 НА 1 · КОЛОДОСТРОИТЕЛЬНАЯ КАРТОЧНАЯ ИГРА
        </div>
        <h1 class="lobby__title">
          <span>ЗВЁЗДНЫЕ</span>
          <span class="lobby__title-accent">ИМПЕРИИ</span>
        </h1>
        <p class="lobby__lead">
          Покупайте корабли и базы на общем рынке, усиливайте колоду и обнулите авторитет соперника.
        </p>

        <div class="lobby__controls">
          <div class="lobby__create">
            <GameButton class="lobby__create-button" :height="68" :disabled="!connected" @click="emit('create')">
              <AppIcon :name="ICON.PLUS" :size="20" :stroke="2.6" />
              <span>Создать матч</span>
            </GameButton>
            <div class="lobby__hint">
              Вы получите код из 6 символов - отправьте его сопернику.
            </div>
          </div>

          <div class="lobby__or">
            <span class="lobby__or-line" />
            <span>ИЛИ</span>
            <span class="lobby__or-line" />
          </div>

          <form class="lobby__join" @submit.prevent="submit">
            <div class="lobby__join-row">
              <label class="lobby__field" for="join-code">
                <span class="lobby__label">КОД МАТЧА</span>
                <input
                  id="join-code"
                  v-model="code"
                  class="lobby__input"
                  type="text"
                  :maxlength="CODE_LENGTH"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="K7M2QX"
                  :aria-describedby="error ? 'join-error' : undefined"
                  :aria-invalid="error ? true : undefined"
                >
              </label>
              <GameButton class="lobby__join-button" variant="outline" :height="64" type="submit" :disabled="!canJoin">
                Войти
              </GameButton>
            </div>
            <div v-if="error" id="join-error" class="lobby__error" role="alert">
              {{ error }}
            </div>
          </form>
        </div>
      </div>

      <div class="lobby__status" :class="{ 'lobby__status--off': !connected }" role="status">
        <span class="lobby__dot" />
        <span>{{ connected ? 'СЕРВЕР · ПОДКЛЮЧЕНО' : 'СЕРВЕР · НЕТ СВЯЗИ' }}</span>
      </div>
    </main>
  </StageScaler>
</template>

<style scoped>
.lobby {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  color: var(--c-text);
  font-family: var(--font-text);
}

.lobby__column {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 160px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  justify-content: center;
  width: 760px;
}

.lobby__eyebrow {
  color: var(--c-me);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.24em;
}

.lobby__title {
  margin: 0;
  font: 800 100px/0.96 var(--font-display);
  letter-spacing: -0.01em;
}

.lobby__title span {
  display: block;
}

.lobby__title-accent {
  color: var(--c-me);
}

.lobby__lead {
  max-width: 540px;
  margin: 0;
  color: var(--c-text-soft);
  font: 400 19px/28px var(--font-text);
}

.lobby__controls {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 560px;
  margin-top: 20px;
}

.lobby__create {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lobby__create-button {
  width: 100%;
  font-size: 17px;
}

.lobby__hint {
  color: var(--c-muted);
  font: 400 14px/20px var(--font-text);
}

.lobby__or {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--c-dim);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.2em;
}

.lobby__or-line {
  flex: 1;
  height: 1px;
  background: rgba(143, 163, 200, 0.22);
}

.lobby__join {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}

.lobby__label {
  color: var(--c-muted);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.lobby__join-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.lobby__field {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.lobby__input {
  flex: none;
  width: 100%;
  min-width: 0;
  height: 64px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  background: var(--c-surface-raised);
  color: var(--c-text-strong);
  font: 600 28px/1 var(--font-mono);
  letter-spacing: 0.42em;
  text-transform: uppercase;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.4);
  outline: none;
}

.lobby__input:focus-visible {
  box-shadow: inset 0 0 0 2px var(--c-me);
}

.lobby__input::placeholder {
  color: rgba(143, 163, 200, 0.4);
}

.lobby__join-button {
  width: 150px;
  padding: 0;
}

.lobby__error {
  color: var(--c-combat);
  font: 500 15px/20px var(--font-text);
}

.lobby__status {
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

.lobby__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-authority);
  box-shadow: 0 0 10px rgba(63, 224, 160, 0.7);
}

.lobby__status--off .lobby__dot {
  background: var(--c-combat);
  box-shadow: 0 0 10px rgba(255, 90, 79, 0.7);
}
</style>
