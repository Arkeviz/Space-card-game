<script setup lang="ts">
/*
 * Каталог всех карт: фильтры (набор, фракция, тип, стоимость, защита), сортировка (стоимость, имя) и постраничный
 * вывод. Вся логика отбора - в lib/catalog.ts, здесь только состояние переключателей и разметка.
 */
import type { CardKind, CardSet, Faction } from '@space/engine'
import type { SortDirection, SortKey } from '../lib/catalog'
import type { ChipOption } from '@/common/ui/ChipGroup.vue'
import { CARD_KIND, FACTION } from '@space/engine'
import { computed, ref, watch } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import ChipGroup from '@/common/ui/ChipGroup.vue'
import { ICON } from '@/common/ui/icons'
import { plural } from '@/common/utilities/plural'
import { CardView, FACTION_META } from '@/modules/cards'
import {
  allCards,
  catalogOptions,
  DEFAULT_PAGE_SIZE,
  emptyFilters,
  filterCards,
  hasActiveFilters,
  KIND_ORDER,
  PAGE_SIZES,
  paginate,
  SET_LABEL,
  SORT_DIRECTION,
  SORT_KEY,
  sortCards,
} from '../lib/catalog'

const emit = defineEmits<{ back: [] }>()

const cards = allCards()
const options = catalogOptions(cards)

const filters = ref(emptyFilters())
const sortKey = ref<SortKey[]>([SORT_KEY.COST])
const sortDirection = ref<SortDirection[]>([SORT_DIRECTION.ASC])
const pageSize = ref<number[]>([DEFAULT_PAGE_SIZE])
const requestedPage = ref(1)

const sentence = (text: string): string => text.charAt(0) + text.slice(1).toLowerCase()

const setOptions: ChipOption<CardSet>[] = options.sets.map(value => ({ value, label: SET_LABEL[value] }))
const factionOptions: ChipOption<Faction>[] = Object.values(FACTION).map(value => ({
  value,
  label: sentence(FACTION_META[value].label),
  color: FACTION_META[value].color,
}))
const KIND_TEXT: Record<CardKind, string> = {
  [CARD_KIND.SHIP]: 'Корабль',
  [CARD_KIND.BASE]: 'База',
  [CARD_KIND.OUTPOST]: 'Аванпост',
}
const kindOptions: ChipOption<CardKind>[] = KIND_ORDER.map(value => ({ value, label: KIND_TEXT[value] }))
const costOptions: ChipOption<number>[] = options.costs.map(value => ({ value, label: String(value) }))
const defenseOptions: ChipOption<number>[] = options.defenses.map(value => ({ value, label: String(value) }))
const sortKeyOptions: ChipOption<SortKey>[] = [
  { value: SORT_KEY.COST, label: 'По стоимости' },
  { value: SORT_KEY.NAME, label: 'По имени' },
]
const directionOptions: ChipOption<SortDirection>[] = [
  { value: SORT_DIRECTION.ASC, label: 'По возрастанию' },
  { value: SORT_DIRECTION.DESC, label: 'По убыванию' },
]
const sizeOptions: ChipOption<number>[] = PAGE_SIZES.map(value => ({ value, label: String(value) }))

const filtered = computed(() => filterCards(cards, filters.value))
const sorted = computed(() => sortCards(filtered.value, sortKey.value[0]!, sortDirection.value[0]!))
const page = computed(() => paginate(sorted.value, requestedPage.value, pageSize.value[0]!))
const pageNumbers = computed(() => Array.from({ length: page.value.pages }, (_, index) => index + 1))
const found = computed(() => `${sorted.value.length} ${plural(sorted.value.length, ['карта', 'карты', 'карт'])}`)

// Любое изменение отбора начинает просмотр с первой страницы.
watch([filters, sortKey, sortDirection, pageSize], () => {
  requestedPage.value = 1
}, { deep: true })

function reset(): void {
  filters.value = emptyFilters()
}

function goTo(next: number): void {
  requestedPage.value = next
}
</script>

<template>
  <main class="catalog space-backdrop">
    <header class="catalog__head">
      <button type="button" class="catalog__back" @click="emit('back')">
        <AppIcon :name="ICON.BACK" :size="18" :stroke="2" />
        <span>В лобби</span>
      </button>
      <div class="catalog__heading">
        <p class="catalog__eyebrow">
          СПРАВОЧНИК
        </p>
        <h1 class="catalog__title">
          Каталог карт
        </h1>
      </div>
      <p class="catalog__found" role="status">
        Найдено: {{ found }}
      </p>
    </header>

    <div class="catalog__body">
      <aside class="filters" aria-label="Фильтры">
        <section class="filters__group">
          <h2 class="filters__title">
            Набор
          </h2>
          <ChipGroup v-model="filters.sets" label="Набор" :options="setOptions" multiple />
        </section>
        <section class="filters__group">
          <h2 class="filters__title">
            Фракция
          </h2>
          <ChipGroup v-model="filters.factions" label="Фракция" :options="factionOptions" multiple />
        </section>
        <section class="filters__group">
          <h2 class="filters__title">
            Тип
          </h2>
          <ChipGroup v-model="filters.kinds" label="Тип" :options="kindOptions" multiple />
        </section>
        <section class="filters__group">
          <h2 class="filters__title">
            Стоимость
          </h2>
          <ChipGroup v-model="filters.costs" label="Стоимость" :options="costOptions" multiple />
        </section>
        <section class="filters__group">
          <h2 class="filters__title">
            Защита
          </h2>
          <ChipGroup v-model="filters.defenses" label="Защита" :options="defenseOptions" multiple />
          <p class="filters__note">
            Защита есть только у баз и аванпостов.
          </p>
        </section>
        <section class="filters__group">
          <h2 class="filters__title">
            Карт на странице
          </h2>
          <ChipGroup v-model="pageSize" label="Карт на странице" :options="sizeOptions" />
        </section>
        <button type="button" class="filters__reset" :disabled="!hasActiveFilters(filters)" @click="reset">
          Сбросить фильтры
        </button>
      </aside>

      <section class="results" aria-label="Карты">
        <div class="sort">
          <span class="sort__label">СОРТИРОВКА</span>
          <ChipGroup v-model="sortKey" label="Сортировать" :options="sortKeyOptions" />
          <ChipGroup v-model="sortDirection" label="Порядок" :options="directionOptions" />
        </div>

        <p v-if="page.items.length === 0" class="results__empty">
          Под эти фильтры не подходит ни одна карта.
        </p>
        <ul v-else class="grid">
          <li v-for="card in page.items" :key="card.id" class="grid__item">
            <CardView :card-id="card.id" />
          </li>
        </ul>

        <nav v-if="page.pages > 1" class="pager" aria-label="Страницы">
          <button type="button" class="pager__button" :disabled="page.page === 1" aria-label="Предыдущая страница" @click="goTo(page.page - 1)">
            <AppIcon :name="ICON.BACK" :size="16" :stroke="2" />
          </button>
          <button
            v-for="number in pageNumbers"
            :key="number"
            type="button"
            class="pager__button"
            :class="{ 'pager__button--on': number === page.page }"
            :aria-current="number === page.page ? 'page' : undefined"
            @click="goTo(number)"
          >
            {{ number }}
          </button>
          <button type="button" class="pager__button pager__button--next" :disabled="page.page === page.pages" aria-label="Следующая страница" @click="goTo(page.page + 1)">
            <AppIcon :name="ICON.BACK" :size="16" :stroke="2" />
          </button>
        </nav>
      </section>
    </div>
  </main>
</template>

<style scoped>
.catalog {
  position: fixed;
  inset: 0;
  padding: 28px 40px 48px;
  overflow-y: auto;
  /* Место под полосу прокрутки занято всегда: когда фильтры укорачивают список, страница не прыгает вбок. */
  scrollbar-gutter: stable;
}

.catalog__head {
  display: flex;
  gap: 32px;
  align-items: center;
  max-width: 1600px;
  margin: 0 auto 28px;
}

.catalog__back {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 44px;
  margin: 0;
  padding: 0 18px 0 12px;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  font: 600 14px/1 var(--font-mono);
  letter-spacing: 0.1em;
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.4);
  cursor: pointer;
}

.catalog__back:hover {
  color: var(--c-me);
  box-shadow: inset 0 0 0 1px var(--c-me);
}

.catalog__heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.catalog__eyebrow {
  color: var(--c-me);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.2em;
}

.catalog__title {
  margin: 0;
  font: 700 34px/1.1 var(--font-display);
}

.catalog__found {
  color: var(--c-text-quiet);
  font: 600 14px/1 var(--font-mono);
  letter-spacing: 0.1em;
}

.catalog__body {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  max-width: 1600px;
  margin: 0 auto;
}

.filters {
  position: sticky;
  top: 0;
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 22px;
  width: 340px;
  padding: 22px;
  background: rgba(10, 16, 32, 0.92);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.22);
}

.filters__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filters__title {
  margin: 0;
  color: var(--c-muted);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.filters__note {
  color: var(--c-muted);
  font: 400 14px/18px var(--font-text);
}

.filters__reset {
  height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-me);
  font: 600 14px/1 var(--font-mono);
  letter-spacing: 0.1em;
  box-shadow: inset 0 0 0 1px var(--c-me);
  cursor: pointer;
}

.filters__reset:hover:not(:disabled) {
  background: rgba(79, 216, 255, 0.1);
}

.filters__reset:disabled {
  color: var(--c-dim);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
  cursor: default;
}

.results {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.sort {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.sort__label {
  color: var(--c-muted);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.results__empty {
  padding: 48px 0;
  color: var(--c-text-soft);
  font: 400 20px/28px var(--font-text);
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  gap: 28px 24px;
  justify-content: center;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pager {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.pager__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  font: 600 15px/1 var(--font-mono);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.3);
  cursor: pointer;
}

.pager__button:hover:not(:disabled) {
  background: rgba(143, 163, 200, 0.1);
}

.pager__button--on {
  background: rgba(79, 216, 255, 0.14);
  color: var(--c-text-strong);
  box-shadow: inset 0 0 0 1px var(--c-me);
}

.pager__button:disabled {
  color: var(--c-dim);
  opacity: 0.45;
  cursor: default;
}

.pager__button--next :deep(svg) {
  transform: rotate(180deg);
}
</style>
