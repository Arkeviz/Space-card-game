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

- `lib/connection-state.ts` - класс `ConnectionState`: применяет входящие сообщения сервера (JOINED/UPDATE/ACK/REJECT/ERROR,
  OPPONENT_STATUS, SEARCH_STATUS, REMATCH_STATUS), отслеживает команды, ждущие ack/reject; хранит имена игроков, причину конца
  партии, состояние поиска и реванша. JOINED с другим `matchId` (реванш) забывает прошлую партию, не трогая подписчиков. Не знает ни о WebSocket, ни о Vue - юнит-тестируется напрямую (как
  `MatchManager` в `apps/server`), без моков сети и без jsdom.
- `composables/useGameConnection.ts` - тонкая обвязка: `useWebSocket` (heartbeat, автопереподключение),
  `reactive(new ConnectionState())`, переподключение по токену из `sessionStorage` (не `localStorage` - он общий
  на все вкладки одного источника, и вторая вкладка увела бы место первой при локальном тестировании).

wsUrl передаётся параметром (`createGameConnection(wsUrl)`), а не читается из `app/app-config.ts` напрямую - это
нарушило бы границы FEOD (`modules` не импортирует `app`). Собирает всё воедино `app/entry.ts`:
`provideGameConnection(app, appConfig.wsUrl)` один раз при старте, дальше подключение получают через
`useGameConnection()` (Vue `provide`/`inject`).

Имя игрока (`createMatch(name)`, `joinMatch(code, name)`, `findMatch(name)`) берётся страницей лобби из настроек; `leaveMatch()` шлёт
серверу `leave-match`, иначе следующий `create-match` с того же сокета получил бы `already-in-match`.

## Модули `settings` и `help`

- `modules/settings` - настройки игрока: чистая логика в `lib/settings.ts` (`parseSettings` проверяет каждое поле отдельно и откатывает
  испорченное к значению по умолчанию, `motionFactor` считает множитель скорости анимаций), одно общее реактивное хранилище в
  `composables/useSettings.ts` (`useStorage`, localStorage, ключ `space-card-game:settings`), окно `SettingsDialog`. Имя игрока
  вводится в лобби (поле «Ваше имя»), в окне настроек его нет.
- `modules/help` - окно справки `HelpDialog`; содержимое (правила и таблица управления) - данными в `lib/help-content.ts`.

Окна на `AppDialog` рисуются внутри сцены (масштабируются вместе с ней): лобби отдаёт им слот, экран матча - свою разметку.
Открываются кнопками «Настройки» и «Справка» в лобби, пунктами меню матча и клавишами `?` / F1.

## Экран матча

Архитектура экрана (слой карт, очередь событий, `TableState`, интерфейс `MatchTransport`) описана в [AGENTS.md](../../AGENTS.md), раздел «Клиент: экран матча». Геометрия сцены (позиции зон и карт) лежит в `src/modules/match/lib/rects.ts` и `src/modules/match/modules/board/lib/layout.ts`: числа перенесены из дизайна, при правке сетки менять их там, а не в разметке.

## Фон лобби: шейдер

Общий фон экранов (главный, ожидание, матч) - шейдер Star Nest (`common/ui/star-nest.glsl`, автор Pablo Roman Andrioli, лицензия MIT, [исходник на ShaderToy](https://www.shadertoy.com/view/XlfGRj)). Его рисует `common/ui/ShaderToy.vue` через `common/utilities/shader-renderer.ts` (чистый WebGL 2, без зависимостей): идея и параметры (`brightness`, `speed`, `pixelRatio`, `frameRate`) взяты из компонента ShaderToy библиотеки Inspira UI, но мышь и касания не обрабатываются (`iMouse` всегда нулевой), а холст не перехватывает клики. Значения заданы в `common/ui/SpaceBackdrop.vue`; на экране матча частота кадров ограничена 30, чтобы шейдер не отнимал кадры у анимаций карт. Фон выводится слотом `backdrop` у `StageScaler`, то есть на всё окно, а не только на сцену. Если WebGL 2 недоступен или игрок выключил «Анимированный фон» в настройках (`animatedBackground`, значение передаётся из `app/layouts/default.vue` через `common/ui/backdrop-animation.ts`), остаётся прежний статичный CSS-фон `space-backdrop` с редкими звёздами; при `prefers-reduced-motion` шейдер рисуется один раз.

## Переход в матч

Когда лобби сменяется матчем (ожидание соперника, созданный матч или вход по коду), играет анимация портала: страница равномерно сжимается в точку на чёрном фоне, из точки вырастает большой портал (круг с крутящейся белой каймой, синими вихрями и мягким ореолом), в его центре три секунды видны имя, VS и имя соперника столбиком, потом портал схлопывается и раскрывается, открывая матч. Эффект включается условием на маршрут назначения (`to.name === 'match'` в `wantsPortal`): выход из матча и остальные экраны меняются сразу, прямой заход на `/match/…` анимации не вызывает.

Переходы оркестрирует `app/layouts/default.vue`: `<Transition mode="out-in">` вокруг `RouterView` с ключом по имени маршрута (смена параметра при реванше переходом не считается), `router.beforeEach` запоминает, откуда и куда идёт навигация, имена берутся из состояния подключения. Кадры считает GSAP (`common/utilities/portal-transition.ts`: `collapsePage`, `showPortal`, `openPortal`, время показа имён - `NAMES_SECONDS`), сам портал рисует прозрачный слой `common/ui/PortalOverlay.vue` шейдером `common/ui/portal.glsl` (через тот же `ShaderRenderer` с `transparent` и дополнительными uniform `uAppear`, `uOpen`, `uBlack`), а подпись - HTML в центре слоя. Радиус портала (`PORTAL_RADIUS` в шейдере) - 36% меньшей стороны окна, размер подписи считается от него в CSS.
Переход пропускается, если нет WebGL 2 или включены сокращённые анимации (настройка игры или система); скорость берётся из настройки «Скорость анимаций» (в том числе время показа имён).

## Версия приложения

Версионируется только клиент (сайт): версия лежит в `version` файла `apps/client/package.json` (семантическое версионирование),
других мест её менять не нужно. Vite подставляет её при сборке как глобальную константу `__APP_VERSION__` (`define` в `vite.config.ts`,
тип - в `src/global/env.d.ts`), а `common/ui/AppVersion.vue` показывает `vX.Y.Z` в правом нижнем углу окна на главном экране и на экране матча
(подключён в `app/layouts/default.vue`). Поднять версию без тега и коммита от npm:

```bash
pnpm --filter @space/client exec npm version patch --no-git-tag-version   # или minor / major
```

Версия читается при запуске Vite: после смены номера dev-сервер нужно перезапустить. Серверные пакеты и релизы на GitHub пока не версионируются.

## Команды

```bash
pnpm --filter @space/client dev        # dev-сервер Vite
pnpm --filter @space/client build      # vue-tsc + vite build
pnpm --filter @space/client typecheck  # vue-tsc --noEmit
```

URL WebSocket-сервера (`app/app-config.ts`): переменная `VITE_WS_URL`, если задана; при разработке - `ws://localhost:3001/ws`;
в собранном приложении - тот же хост, с которого открыта страница (`ws://` или `wss://` по протоколу страницы). В Docker `/ws`
проксирует nginx (`nginx.conf`), поэтому ничего настраивать не нужно. Для GitHub Pages сборка идёт с `VITE_BASE=/<репозиторий>/` (`base` в `vite.config.ts`, роутер берёт `import.meta.env.BASE_URL`) и `VITE_WS_URL` из переменной репозитория `PAGES_WS_URL` (`.github/workflows/pages.yml`). Образ клиента собирает `Dockerfile` (Vite -> nginx).
