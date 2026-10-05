<script setup lang="ts" generic="T extends string | number">
/*
 * Группа переключателей-«чипов»: выбор нескольких значений (фильтры) или ровно одного (размер страницы).
 * Каждый чип - обычная кнопка с aria-pressed, поэтому работает с клавиатуры и читается скринридером.
 */
export interface ChipOption<V> {
  value: V
  label: string
  /** Цвет метки слева (например, цвет фракции). */
  color?: string
}

const props = withDefaults(defineProps<{
  options: readonly ChipOption<T>[]
  /** Можно ли выбрать несколько значений. Иначе выбрано всегда ровно одно и снять его нельзя. */
  multiple?: boolean
  label: string
}>(), {
  multiple: false,
})

const model = defineModel<T[]>({ required: true })

function toggle(value: T): void {
  const chosen = model.value
  if (!props.multiple) {
    model.value = [value]
    return
  }
  model.value = chosen.includes(value) ? chosen.filter(item => item !== value) : [...chosen, value]
}
</script>

<template>
  <div class="chips" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="chip"
      :class="{ 'chip--on': model.includes(option.value) }"
      :aria-pressed="model.includes(option.value)"
      @click="toggle(option.value)"
    >
      <span v-if="option.color" class="chip__dot" :style="{ background: option.color }" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 36px;
  margin: 0;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  font: 500 15px/1 var(--font-text);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.3);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.chip:hover {
  background: rgba(143, 163, 200, 0.1);
}

.chip--on {
  background: rgba(79, 216, 255, 0.14);
  color: var(--c-text-strong);
  box-shadow: inset 0 0 0 1px var(--c-me);
}

.chip__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
