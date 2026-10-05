<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { nextTick, ref, useTemplateRef } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'

const emit = defineEmits<{ concede: [] }>()

const open = ref(false)
const confirming = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const concedeButton = useTemplateRef<HTMLButtonElement>('concedeButton')

onClickOutside(root, () => close())
onKeyStroke('Escape', () => close())

function close(): void {
  open.value = false
  confirming.value = false
}

async function toggle(): Promise<void> {
  open.value = !open.value
  confirming.value = false
  if (open.value) {
    await nextTick()
    concedeButton.value?.focus()
  }
}

function confirm(): void {
  close()
  emit('concede')
}
</script>

<template>
  <div ref="root" class="menu">
    <button type="button" class="menu__toggle" aria-label="Меню матча" :aria-expanded="open" @click="toggle">
      <AppIcon :name="ICON.MENU" :size="18" :stroke="1.8" />
    </button>

    <div v-if="open" class="menu__popover" role="menu">
      <template v-if="!confirming">
        <button ref="concedeButton" type="button" class="menu__item menu__item--danger" role="menuitem" @click="confirming = true">
          <AppIcon :name="ICON.FLAG" :size="16" />
          <span>Сдаться</span>
        </button>
      </template>
      <template v-else>
        <p class="menu__question" role="alertdialog" aria-label="Подтверждение">
          Сдаться? Партия будет засчитана как поражение.
        </p>
        <div class="menu__actions">
          <button type="button" class="menu__item menu__item--danger" @click="confirm">
            Да, сдаться
          </button>
          <button type="button" class="menu__item" @click="close">
            Отмена
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
  pointer-events: auto;
}

.menu__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  background: rgba(10, 16, 32, 0.92);
  color: var(--c-text-quiet);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.3);
  cursor: pointer;
}

.menu__toggle:hover {
  box-shadow: inset 0 0 0 1px var(--c-me);
  color: var(--c-me);
}

.menu__popover {
  position: absolute;
  top: 48px;
  right: 0;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 232px;
  padding: 10px;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.4), 0 20px 50px rgba(0, 0, 0, 0.6);
}

.menu__question {
  padding: 4px 4px 0;
  color: var(--c-text-soft);
  font: 400 16px/21px var(--font-text);
}

.menu__actions {
  display: flex;
  gap: 8px;
}

.menu__item {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  font: 600 15px/1 var(--font-mono);
  letter-spacing: 0.06em;
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.4);
  cursor: pointer;
}

.menu__item:hover {
  background: rgba(201, 214, 240, 0.08);
}

.menu__item--danger {
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px var(--c-combat);
}

.menu__item--danger:hover {
  background: rgba(255, 90, 79, 0.14);
}
</style>
