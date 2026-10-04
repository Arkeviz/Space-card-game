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
| Имена composable-файлов | `camelCase` по имени функции (`useGameConnection.ts`) - соглашение Vue/VueUse |
| Имя верхнего уровня | `global` (в единственном числе) |
| Public API модуля | только `index.ts`; экспорты явные, без `export *` |
| Подмодули | `modules/<module>/modules/<sub>/` со своим `index.ts` |
| Сегменты внутри модуля | `components/`, `composables/`, `store/`, `api/`, `types/`, `lib/` (framework-агностичная логика, см. ниже), по необходимости |
| `common` | без index/barrel-файлов, импорт по прямому пути (`@/common/ui/Button.vue`) |
| Алиас | `@/` → `src/`; межуровневые импорты только через алиас, внутри модуля - относительные, без расширения `.ts` (клиент собирается Vite, в отличие от `engine`/`protocol`/`server`, которые запускаются Node напрямую) |
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

## Модуль `connection`

Подключение к серверу матчей: обёртка над `useWebSocket` из VueUse по протоколу `@space/protocol`.

- `lib/connection-state.ts` - класс `ConnectionState`: применяет входящие сообщения сервера (JOINED/UPDATE/ACK/REJECT/ERROR),
  отслеживает команды, ждущие ack/reject. Не знает ни о WebSocket, ни о Vue - юнит-тестируется напрямую (как
  `MatchManager` в `apps/server`), без моков сети и без jsdom.
- `composables/useGameConnection.ts` - тонкая обвязка: `useWebSocket` (heartbeat, автопереподключение),
  `reactive(new ConnectionState())`, переподключение по токену из `sessionStorage` (не `localStorage` - он общий
  на все вкладки одного источника, и вторая вкладка увела бы место первой при локальном тестировании).

wsUrl передаётся параметром (`createGameConnection(wsUrl)`), а не читается из `app/app-config.ts` напрямую - это
нарушило бы границы FEOD (`modules` не импортирует `app`). Собирает всё воедино `app/entry.ts`:
`provideGameConnection(app, appConfig.wsUrl)` один раз при старте, дальше подключение получают через
`useGameConnection()` (Vue `provide`/`inject`).

## Экран матча

Архитектура экрана (слой карт, очередь событий, `TableState`, интерфейс `MatchTransport`) описана в [AGENTS.md](../../AGENTS.md), раздел «Клиент: экран матча». Геометрия сцены (позиции зон и карт) лежит в `src/modules/match/lib/rects.ts` и `src/modules/match/modules/board/lib/layout.ts`: числа перенесены из дизайна, при правке сетки менять их там, а не в разметке.

## Команды

```bash
pnpm --filter @space/client dev        # dev-сервер Vite
pnpm --filter @space/client build      # vue-tsc + vite build
pnpm --filter @space/client typecheck  # vue-tsc --noEmit
```

URL WebSocket-сервера задаётся переменной `VITE_WS_URL` (по умолчанию `ws://localhost:3001/ws`).
