# @space/client

Клиент игры «Звёздные империи»: Vue 3 + Vite + Pinia + VueUse + GSAP.

## Архитектура: FEOD

Структура `src` следует [FEOD](https://feod.zede169778.workers.dev/) (Fractal Entity Oriented Design).
Ниже зафиксирована **выбранная вариация**. Где официальная и альтернативная документации расходятся, действует этот файл.

```text
src/
  app/       запуск и настройка: entry.ts, router.ts, app-config.ts, layouts/, integrations/
  pages/     страницы по URL; тонкая композиция модулей
  modules/   бизнес-логика: модули с public API через index.ts
  common/    мелкие нейтральные сущности без бизнес-смысла
  global/    декларации окружения (*.d.ts); не импортируется в коде
```

Цепочка импортов: **common → modules → pages → app**.

### Соглашения

| Тема | Решение |
| --- | --- |
| Имена папок модулей и страниц | `kebab-case` (`animation-director`, `player-panel`) |
| Имена файлов Vue-компонентов | `PascalCase.vue` (`CardView.vue`); layouts - `kebab-case` |
| Имя верхнего уровня | `global` (в единственном числе) |
| Public API модуля | только `index.ts`; экспорты явные, без `export *` |
| Подмодули | `modules/<module>/modules/<sub>/` со своим `index.ts` |
| Сегменты внутри модуля | `components/`, `composables/`, `store/`, `api/`, `types/`, по необходимости |
| `common` | без index/barrel-файлов, импорт по прямому пути (`@/common/ui/Button.vue`) |
| Алиас | `@/` → `src/`; межуровневые импорты только через алиас, внутри модуля - относительные |
| Связи между модулями | сводить к минимуму; зависимости передавать параметром (IoC), а не импортировать |
| Роуты | страницы подгружаются лениво: `() => import('@/pages/lobby/LobbyPage.vue')` |
| Пакеты `@space/engine`, `@space/protocol` | внешние пакеты: импортируются с любого уровня |

Пример: страница импортирует модуль только через public API.

```ts
// хорошо
import { Board } from '@/modules/match'
// плохо: deep import
import { Board } from '@/modules/match/modules/board/Board.vue'
```

### Как это проверяется

Официальный ESLint-плагин FEOD (`@feod/eslint-structure-plugin`) в npm не опубликован. Границы проверяет
`no-restricted-imports` в корневом [eslint.config.js](../../eslint.config.js):

- слой не может импортировать вышестоящий слой (`common` → `modules`/`pages`/`app` и т. д.);
- deep imports в модули (`@/modules/x/y`) запрещены;
- `global` не импортируется.

Чего линтер не видит: бизнес-логика в `common`, раздутый public API, модуль без единой ответственности.
Это проверяется на ревью. Для формального аудита есть скрипт из скилла `feod` (`feod-check.mjs`).

## Команды

```bash
pnpm --filter @space/client dev        # dev-сервер Vite
pnpm --filter @space/client build      # vue-tsc + vite build
pnpm --filter @space/client typecheck  # vue-tsc --noEmit
```

URL WebSocket-сервера задаётся переменной `VITE_WS_URL` (по умолчанию `ws://localhost:3001/ws`).
