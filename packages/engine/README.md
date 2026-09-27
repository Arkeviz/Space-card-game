# @space/engine

Правила игры «Звёздные империи»: чистая логика без ввода-вывода. Работает на сервере, типы и данные карт использует клиент.

## Структура

```text
src/
  index.ts        публичный API пакета
  types/          типы и константы (только объявления, без логики)
    constants.ts  все "перечисления" (FACTION, CARD_KIND, COMMAND_TYPE, COMMAND_ERROR, EVENT_TYPE ...)
    card.ts       Card, CardInstance, Effect
    state.ts      GameState, PlayerState, Prompt ...
    command.ts    Command, ApplyResult
    event.ts      GameEvent
    view.ts       PlayerView (снимок без скрытой информации)
    index.ts      реэкспорт
  data/           данные игры
    cards.ts      каталог карт, getCard
    config.ts     размеры руки и ряда, стартовая колода, состав Торговой колоды
  game/           правила
    setup.ts      createGame
    apply.ts      apply: обработка команд
    effects.ts    разрешение эффектов, prompt, добор, утилизация
    legal.ts      legalActions
    redact.ts     redact, redactEvents
    *.test.ts     тесты рядом с кодом
  lib/            утилиты общего назначения (rng)
  testing/        помощники для тестов, не экспортируются наружу
```

Зависимости идут сверху вниз: `types` -> `data`/`lib` -> `game`. `testing` используется только тестами.

## Константы вместо строк

Строковые значения (типы команд и событий, виды эффектов, фракции и т. п.) объявлены в [types/constants.ts](src/types/constants.ts)
как `as const` объекты. Значение и тип берутся из одного места:

```ts
export const COMMAND_TYPE = { PLAY_CARD: 'PLAY_CARD' /* ... */ } as const
export type CommandType = ValueOf<typeof COMMAND_TYPE>

type Command
  = | { type: typeof COMMAND_TYPE.PLAY_CARD, cardId: string }
    | { type: typeof COMMAND_TYPE.END_TURN }/* и так далее */
```

Правила:

- В коде и тестах используем `COMMAND_TYPE.PLAY_CARD`, а не `'PLAY_CARD'`.
- Enum не используем: включён `erasableSyntaxOnly`, иначе Node не запустит TypeScript без сборки (а также enum - это плохо).
- Объекты с ключами из констант объявляем через вычисляемые ключи (`{ [RESOURCE.TRADE]: 0 }`, `pools[RESOURCE.TRADE]`),
  иначе смена текста константы сломает такой объект.
- Проверка: если поменять значения в `constants.ts` (например, дописать суффикс), тесты и типы должны остаться зелёными.

Пока литералами остаются поля `from` у событий (`'trade-row'`, `'explorers'`, `'hand'`, `'play'`) и id карт.

## FORFEIT (сдача)

Единственная команда, обходящая обычную проверку хода: `apply` принимает её от любого игрока независимо от того,
чей сейчас ход и открыт ли prompt. Нужна серверу для форфита по таймауту отключения (см. `apps/server`).
В `legalActions` не входит - это не обычное игровое действие, UI показывает кнопку «сдаться» отдельно.
