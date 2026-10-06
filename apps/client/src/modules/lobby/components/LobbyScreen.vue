<script setup lang="ts">
import { PLAYER_NAME_MAX_LENGTH } from '@space/protocol'
import { computed, ref } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { ICON } from '@/common/ui/icons'
import SpaceBackdrop from '@/common/ui/SpaceBackdrop.vue'
import StageScaler from '@/common/ui/StageScaler.vue'

const props = defineProps<{
  /** Есть ли связь с сервером. */
  connected: boolean
  /** Текст ошибки последней попытки (неверный код и т. п.). */
  error: string | null
  /** Как показывать имя, если игрок его не ввёл (подсказка в поле). */
  defaultName: string
}>()

const emit = defineEmits<{
  quick: []
  create: []
  join: [code: string]
  catalog: []
  settings: []
  help: []
}>()

/** Имя игрока: оно уходит соперникам и показывается в партии. */
const name = defineModel<string>('name', { required: true })

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
    <template #backdrop>
      <SpaceBackdrop />
    </template>
    <main class="lobby">
      <div class="lobby__hero">
        <p class="lobby__eyebrow">
          ДУЭЛЬ 1 НА 1 · КОЛОДОСТРОИТЕЛЬНАЯ КАРТОЧНАЯ ИГРА
        </p>
        <h1 class="lobby__title">
          <span>ЗВЁЗДНЫЕ</span>
          <span class="lobby__title-accent">ИМПЕРИИ</span>
        </h1>
        <p class="lobby__lead">
          Покупайте корабли и базы на общем рынке, усиливайте колоду и обнулите авторитет соперника.
        </p>
      </div>

      <aside class="lobby__console" aria-label="Вход в игру">
        <div class="lobby__controls">
          <label class="lobby__name-field" for="player-name">
            <span class="lobby__label">ВАШЕ ИМЯ</span>
            <input
              id="player-name"
              v-model="name"
              class="lobby__name"
              type="text"
              :maxlength="PLAYER_NAME_MAX_LENGTH"
              autocomplete="nickname"
              spellcheck="false"
              :placeholder="defaultName"
            >
          </label>

          <div class="lobby__create">
            <GameButton class="lobby__create-button" :height="68" :disabled="!connected" @click="emit('quick')">
              <AppIcon :name="ICON.USER" :size="20" :stroke="2.2" />
              <span>Быстрая игра</span>
            </GameButton>
            <p class="lobby__hint">
              Подберём соперника автоматически.
            </p>
          </div>

          <div class="lobby__or">
            <span class="lobby__or-line" />
            <span>ИЛИ С ДРУГОМ</span>
            <span class="lobby__or-line" />
          </div>

          <div class="lobby__create">
            <GameButton class="lobby__create-button" variant="outline" :height="56" :disabled="!connected" @click="emit('create')">
              <AppIcon :name="ICON.PLUS" :size="18" :stroke="2.6" />
              <span>Создать матч</span>
            </GameButton>
            <p class="lobby__hint">
              Вы получите код из 6 символов - отправьте его сопернику.
            </p>
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
            <p v-if="error" id="join-error" class="lobby__error" role="alert">
              {{ error }}
            </p>
          </form>
        </div>

        <div class="lobby__links">
          <button type="button" class="lobby__link" @click="emit('catalog')">
            <AppIcon :name="ICON.COPY" :size="18" :stroke="1.8" />
            <span>КАТАЛОГ КАРТ</span>
          </button>
          <button type="button" class="lobby__link" @click="emit('settings')">
            <AppIcon :name="ICON.MENU" :size="18" :stroke="1.8" />
            <span>НАСТРОЙКИ</span>
          </button>
          <button type="button" class="lobby__link" @click="emit('help')">
            <AppIcon :name="ICON.INFO" :size="18" :stroke="1.8" />
            <span>СПРАВКА</span>
          </button>
        </div>

        <p class="lobby__status" :class="{ 'lobby__status--off': !connected }" role="status">
          <span class="lobby__dot" />
          <span>{{ connected ? 'СЕРВЕР · ПОДКЛЮЧЕНО' : 'СЕРВЕР · НЕТ СВЯЗИ' }}</span>
        </p>
      </aside>

      <!-- Окна (настройки, справка) рисуются внутри сцены, чтобы масштабироваться вместе с ней. -->
      <slot />
    </main>
  </StageScaler>
</template>

<style scoped>
.lobby {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: clip;
  color: var(--c-text);
  font-family: var(--font-text);
}

/* Слева на шейдере - название, справа на всю высоту - консоль с действиями (как правая колонка экрана матча). */
.lobby__hero {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 160px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  justify-content: center;
  width: 900px;
}

.lobby__console {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 620px;
  padding: 72px 56px 48px;
  background: rgba(7, 12, 24, 0.67);
  box-shadow: inset 1px 0 0 rgba(79, 216, 255, 0.22);
}

.lobby__links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 48px;
}

.lobby__link {
  display: flex;
  width: 100%;
  gap: 10px;
  align-items: center;
  height: 44px;
  margin: 0;
  padding: 0 20px 0 16px;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  font: 600 14px/1 var(--font-mono);
  letter-spacing: 0.14em;
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.4);
  cursor: pointer;
}

.lobby__link:hover {
  color: var(--c-me);
  box-shadow: inset 0 0 0 1px var(--c-me);
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
  gap: 18px;
}

.lobby__name-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lobby__name {
  flex: none;
  width: 100%;
  min-width: 0;
  height: 52px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  background: var(--c-surface-raised);
  color: var(--c-text-strong);
  font: 600 20px/1 var(--font-text);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.35);
  outline: none;
}

.lobby__name:focus-visible {
  box-shadow: inset 0 0 0 2px var(--c-me);
}

.lobby__name::placeholder {
  color: rgba(143, 163, 200, 0.45);
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
  bottom: 48px;
  left: 56px;
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
