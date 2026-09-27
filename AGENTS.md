# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Проект

Веб-карточная игра (Vue 3 + Node), аналог настольной игры «Звёздные империи» (Star Realms), только мультиплеер 1 на 1. pnpm-монорепозиторий:

- `packages/engine` - чистые правила игры (TypeScript, без ввода-вывода). Работает на сервере.
- `packages/protocol` - схемы сообщений клиент/сервер (Valibot).
- `apps/server` - Fastify + `@fastify/websocket`.
- `apps/client` - Vue 3 + Vite, структура по [FEOD](https://feod.zede169778.workers.dev/).

У каждого пакета/приложения свой README с деталями конкретно по нему: [apps/client/README.md](apps/client/README.md), [apps/server/README.md](apps/server/README.md), [packages/engine/README.md](packages/engine/README.md), [packages/protocol/README.md](packages/protocol/README.md).

## Команды

Запускать из корня репозитория, если не сказано иное.

```bash
pnpm install                              # установка
pnpm lint                                 # eslint . (весь репозиторий)
pnpm lint:fix                             # eslint . --fix
pnpm typecheck                            # tsc/vue-tsc в каждом пакете (pnpm -r typecheck)
pnpm test                                 # vitest run в каждом пакете (pnpm -r test)
pnpm dev:server                           # apps/server dev (node --watch)
pnpm dev:client                           # apps/client dev (vite)
```

Один пакет / один файл теста:

```bash
pnpm --filter @space/engine test                    # все тесты одного пакета
pnpm --filter @space/engine test rules.test          # один файл (фильтр vitest по имени; без `--` перед аргументом)
pnpm --filter @space/engine typecheck
pnpm --filter @space/client build                    # vue-tsc --noEmit && vite build
```

Имена пакетов: `@space/engine`, `@space/protocol`, `@space/server`, `@space/client`.

## Настройка TypeScript (неочевидный момент)

В проекте намеренно установлены две версии TypeScript:

- `typescript` (5.9) - использует `vue-tsc` и `typescript-eslint`, они пока не поддерживают TypeScript 7.
- `typescript-7` (npm-алиас на `typescript@^7`) - им реально проверяются типы в `engine`/`protocol`/`server` (`node ../../node_modules/typescript-7/bin/tsc -p tsconfig.json` в скрипте `typecheck` каждого пакета).

В `tsconfig.base.json` включены `erasableSyntaxOnly` и `allowImportingTsExtensions`: `apps/server` запускается напрямую через Node (`node --watch src/main.ts`, без `tsx`/сборщика), поэтому относительные импорты внутри `packages/engine` и `packages/protocol` **обязаны** сохранять явное расширение `.ts` (например, `from '../types/index.ts'`, а не `from '../types'`). Без расширения `vue-tsc`/тулинг редактора проверку типов пройдут, но в рантайме будет `ERR_UNSUPPORTED_DIR_IMPORT` - редакторы иногда сами стирают расширение при сохранении, за этим нужно следить.

## Политика доверия в `pnpm-workspace.yaml`

`trustPolicyExclude` пропускает `why-is-node-running@3.2.2` (транзитивная зависимость `vitest`) мимо проверки `trustPolicy: no-downgrade` - у этой версии нет provenance-аттестации, которая была у предыдущей, от того же мейнтейнера. Не убирать исключение, не проверив, что `pnpm install` всё ещё проходит.

## Архитектура

### Игровой движок (`packages/engine`)

`apply(state, player, command) -> { ok: true, state, events } | { ok: false, error }` - единая точка входа для всей игровой логики: чистая функция, неизменяемая (клонирует состояние через `JSON.parse(JSON.stringify(state))`, никогда не мутирует вход), детерминированная при одном и том же сиде. Всё остальное в `engine` обслуживает эту функцию:

- `game/setup.ts` (`createGame`) строит начальный `GameState` по сиду.
- `game/effects.ts` разрешает `Effect` карт; когда эффекту нужен выбор игрока (сброс, утилизация, вариант), он открывает `Prompt` в `state.prompt` и останавливается - остаток цепочки эффектов сохраняется в `state.continuation` до ответа командой `CHOOSE_*`/`SKIP`. Пока запрос открыт, `apply` принимает только команды-ответы на него, и только от `state.prompt.player`.
- `game/legal.ts` (`legalActions`) перечисляет кандидатов команд для игрока и оставляет только те, что реально принимает `apply` - источник истины именно `apply`, а не отдельная копия правил.
- `game/redact.ts` (`redact`, `redactEvents`) убирает скрытую информацию (содержимое руки соперника, порядок колоды, `rngState`) перед отправкой `GameState`/событий конкретному игроку. **Никогда не отправлять клиенту необрезанный `GameState` или события.**
- `data/cards.ts` - каталог карт (`CARDS`, `getCard`); значения записаны по памяти и пока не сверены с физической игрой.

Отдельно от обычных игровых команд есть `CONCEDE` (сдаться): единственная команда, которую `apply` принимает независимо от того, чей сейчас ход и открыт ли prompt. Сервер применяет её сам по таймауту отключения; той же командой заводится и кнопка «сдаться» в UI. В `legalActions` не входит - не обычное игровое действие.

Все строковые «перечисления» (`COMMAND_TYPE`, `EVENT_TYPE`, `COMMAND_ERROR`, `FACTION`, `CARD_KIND`, `ABILITY_KIND`, `RESOURCE`, `SCRAP_ZONE`, `EFFECT_TYPE`, `PROMPT_KIND`) - объекты `as const` в `types/constants.ts`, используются как `typeof COMMAND_TYPE.PLAY_CARD` в дискриминированных union-типах и как значения везде в рантайме - никогда не голые строковые литералы. Настоящий `enum` намеренно не используется (`erasableSyntaxOnly`). Полное соглашение и то, какие поля пока остаются литералами, - в [packages/engine/README.md](packages/engine/README.md).

### Клиент (`apps/client`)

Структура по FEOD: `app` (запуск/роутер/интеграции) → `pages` (тонкие, по одной на маршрут) → `modules` (бизнес-логика, доступ только через public API модуля - `index.ts`) → `common` (нейтральные мелкие сущности без barrel-файлов) → `global` (декларации окружения, никогда не импортируются напрямую). Импорт однонаправленный (`common → modules → pages → app`), проверяется правилами `no-restricted-imports` в корневом [eslint.config.js](eslint.config.js), которые генерируются по слоям из объекта `forbiddenByLayer`. Папки модулей и страниц - `kebab-case`; файлы Vue-компонентов - `PascalCase.vue`. Полное обоснование и примеры - в [apps/client/README.md](apps/client/README.md).

### Сервер и матчи (`apps/server`)

Fastify + `@fastify/websocket`, один маршрут `/ws`. `match-manager.ts` (`Room`, `MatchManager`) хранит комнаты в памяти процесса: код приглашения на 6 символов, токен для переподключения, таймаут хода (автодействие: `SKIP`, если открыт prompt, иначе `END_TURN`) и таймаут отключения (сдача через `CONCEDE`). Разбор входящих WS-сообщений и маршрутизация в `MatchManager` - в `app.ts`. Полный протокол сообщений, поток матча и известные ограничения (нет персистентности, нет сборки мусора для заброшенных комнат) - в [apps/server/README.md](apps/server/README.md).

Сервер авторитетен: клиент шлёт только команды-намерения (`{ type: 'command', commandId, command }`), сервер отвечает отправителю `ack`/`reject` и рассылает обоим игрокам персональный `update` (`version`, `events`, `view`, `legalActions`) через `redact`/`redactEvents`. `sync` отдаёт полный снимок без событий - для восстановления после переподключения. Схемы входящих сообщений - в `@space/protocol` (`parseClientMessage`, `parseCommand`); исходящие типизированы, но не проверяются в рантайме - сервер доверенный.

Клиентская часть синхронизации (модуль `connection` на `useWebSocket`, `serverView`/`renderedView`, очередь анимаций) пока не реализована - это следующий этап.
