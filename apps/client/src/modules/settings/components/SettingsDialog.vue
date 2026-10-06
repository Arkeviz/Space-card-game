<script setup lang="ts">
import { computed } from 'vue'
import AppDialog from '@/common/ui/AppDialog.vue'
import ChipGroup from '@/common/ui/ChipGroup.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { useSettings } from '../composables/useSettings'
import { ANIMATION_MODE, ANIMATION_SPEEDS, DEFAULT_SETTINGS } from '../lib/settings'

/** Настройки игрока. Применяются сразу и хранятся в браузере (localStorage). Имя вводится в лобби. */
defineEmits<{ close: [] }>()

const settings = useSettings()

const speedOptions = ANIMATION_SPEEDS.map(value => ({ value: value as number, label: `${value}×` }))
const modeOptions = [
  { value: ANIMATION_MODE.SYSTEM, label: 'Как в системе' },
  { value: ANIMATION_MODE.FULL, label: 'Полные' },
  { value: ANIMATION_MODE.REDUCED, label: 'Сокращённые' },
]
const switchOptions = [
  { value: 'on', label: 'Включено' },
  { value: 'off', label: 'Выключено' },
]

const speed = computed({
  get: () => [settings.value.animationSpeed],
  set: ([value]) => {
    if (value !== undefined)
      settings.value.animationSpeed = value
  },
})

const mode = computed({
  get: () => [settings.value.animationMode],
  set: ([value]) => {
    if (value !== undefined)
      settings.value.animationMode = value
  },
})

/** Переключатель «включено/выключено» для булевой настройки: ChipGroup работает со строками. */
function toggle(key: 'endTurnWarning' | 'hotkeys' | 'dragAndDrop' | 'animatedBackground') {
  return computed({
    get: () => [settings.value[key] ? 'on' : 'off'],
    set: ([value]) => {
      if (value !== undefined)
        settings.value[key] = value === 'on'
    },
  })
}

const endTurnWarning = toggle('endTurnWarning')
const hotkeys = toggle('hotkeys')
const dragAndDrop = toggle('dragAndDrop')
const animatedBackground = toggle('animatedBackground')

/** Сбрасывает всё, кроме имени: оно вводится отдельно и в настройках не показывается. */
function reset(): void {
  settings.value = { ...DEFAULT_SETTINGS, playerName: settings.value.playerName }
}
</script>

<template>
  <AppDialog title="Настройки" eyebrow="ИГРА · ПРИМЕНЯЮТСЯ СРАЗУ" :width="860" closable :z-index="580" @close="$emit('close')">
    <section class="row">
      <div class="row__text">
        <h3 class="row__name">
          Скорость анимаций
        </h3>
        <p class="row__hint">
          Во сколько раз быстрее или медленнее летают карты.
        </p>
      </div>
      <ChipGroup v-model="speed" label="Скорость анимаций" :options="speedOptions" />
    </section>

    <section class="row">
      <div class="row__text">
        <h3 class="row__name">
          Анимации
        </h3>
        <p class="row__hint">
          «Сокращённые» почти без движения. «Как в системе» следует настройке уменьшения движения в вашей ОС.
        </p>
      </div>
      <ChipGroup v-model="mode" label="Режим анимаций" :options="modeOptions" />
    </section>

    <section class="row">
      <div class="row__text">
        <h3 class="row__name">
          Предупреждение перед концом хода
        </h3>
        <p class="row__hint">
          Спрашивать, если осталась атака или торговля, которую ещё можно потратить.
        </p>
      </div>
      <ChipGroup v-model="endTurnWarning" label="Предупреждение перед концом хода" :options="switchOptions" />
    </section>

    <section class="row">
      <div class="row__text">
        <h3 class="row__name">
          Горячие клавиши хода
        </h3>
        <p class="row__hint">
          P - разыграть все карты, A - атаковать, E - закончить ход.
        </p>
      </div>
      <ChipGroup v-model="hotkeys" label="Горячие клавиши хода" :options="switchOptions" />
    </section>

    <section class="row">
      <div class="row__text">
        <h3 class="row__name">
          Перетаскивание карт
        </h3>
        <p class="row__hint">
          Играть и покупать, перетаскивая карту мышью. Клик и клавиатура работают всегда.
        </p>
      </div>
      <ChipGroup v-model="dragAndDrop" label="Перетаскивание карт" :options="switchOptions" />
    </section>

    <section class="row">
      <div class="row__text">
        <h3 class="row__name">
          Анимированный фон
        </h3>
        <p class="row__hint">
          Движущийся звёздный фон на всех экранах. Выключите, чтобы вернуть прежний статичный фон: так и нагрузка на видеокарту меньше.
        </p>
      </div>
      <ChipGroup v-model="animatedBackground" label="Анимированный фон" :options="switchOptions" />
    </section>

    <template #footer>
      <GameButton :height="52" @click="$emit('close')">
        Готово
      </GameButton>
      <GameButton variant="ghost" :height="52" @click="reset">
        Сбросить настройки
      </GameButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(143, 163, 200, 0.12);
}

.row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.row__name {
  margin: 0;
  font: 600 18px/1.2 var(--font-text);
}

.row__hint {
  margin: 4px 0 0;
  color: var(--c-muted);
  font: 400 15px/20px var(--font-text);
}
</style>
