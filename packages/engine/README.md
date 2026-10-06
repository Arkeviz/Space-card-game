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
    view.ts       PlayerView (снимок без скрытой информации; свой состав колоды - deckContents, без порядка)
    index.ts      реэкспорт
  data/           данные игры
    cards.ts      каталог карт, getCard
    config.ts     размеры руки и ряда, стартовая колода, состав Торговой колоды
  game/           правила
    setup.ts      createGame (первый игрок случайный из сида, можно задать options.firstPlayer)
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

## CONCEDE (сдаться)

Единственная команда, обходящая обычную проверку хода: `apply` принимает её от любого игрока независимо от того,
чей сейчас ход и открыт ли prompt. Сервер применяет её сам по истечении таймаута отключения (см. `apps/server`);
тем же способом можно завести кнопку «сдаться» в UI - это одна команда на оба случая.
В `legalActions` не входит - это не обычное игровое действие.

## Эффекты карт и запросы выбора

Каталог (`data/cards.ts`) - это 80 карт базового набора плюс стартовые карты и Исследователи; состав Торговой колоды - `TRADE_DECK_COMPOSITION` в `data/config.ts`.
Эффект (`Effect`) либо выполняется сразу (`GAIN`, `DRAW`, `OPPONENT_DISCARD`, `SHIP_TO_DECK_TOP`, `DRAW_IF_BASES`, `DRAW_PER_PLAYED`), либо открывает prompt и ждёт ответа игрока (остаток цепочки хранится в `state.continuation`):

| Эффект | Prompt | Ответ |
| --- | --- | --- |
| `CHOICE` | `CHOICE` | `CHOOSE_OPTION` |
| `SCRAP` (`repeat`, `drawPerScrap`) | `SCRAP` | `CHOOSE_CARD` или `SKIP`, если необязательный; при `repeat` запрос повторяется |
| `DISCARD_DRAW` | `DISCARD` (`optional`, `remaining`, `drawPerDiscard`) | `CHOOSE_CARD` или `SKIP` |
| `DESTROY_BASE` | `DESTROY_BASE` | `CHOOSE_CARD`, `SKIP` если `optional` |
| `ACQUIRE_SHIP` | `ACQUIRE_SHIP` | `CHOOSE_CARD` (корабль ряда или верхний Исследователь) |
| `COPY_SHIP` | `COPY_SHIP` | `CHOOSE_CARD` (другой корабль, сыгранный в этот ход) |

**Сброс у соперника** (`OPPONENT_DISCARD`) не прерывает ход: эффект лишь записывает долг в `GameState.pendingDiscards` и шлёт событие `DISCARD_QUEUED`. В начале своего хода (`endTurn` предыдущего игрока, после `TURN_STARTED`) должник получает обязательный prompt `DISCARD` на столько карт, сколько накопилось (`remaining`, но не больше, чем карт в руке); если рука пуста, долг сгорает.

Сброс нескольких карт можно закрыть одним ответом `CHOOSE_CARDS { promptId, cardIds }`: для обязательного запроса нужно ровно `min(remaining, карт в руке)` разных карт из руки, для необязательного - от одной до этого числа (с добором за каждую, если `drawPerDiscard`). Одиночный `CHOOSE_CARD` по-прежнему работает и повторяет запрос; `CHOOSE_CARDS` в `legalActions` не входит.

**Способности, не требующие выбора, срабатывают сами.** Способность (`BASIC` базы или аванпоста, `ALLY`) автоматическая (`isAutomatic`), если среди её эффектов нет `SCRAP`, `CHOICE`, `DESTROY_BASE`, `ACQUIRE_SHIP`, `DISCARD_DRAW`, `COPY_SHIP`. `triggerAutomatic` запускает такие способности у всех карт игрока на столе, пока они не использованы: основную способность баз и аванпостов и способность союзника, если условие выполнено. Вызывается при розыгрыше карты (и для неё самой, и для тех, кому она стала союзником), при копировании корабля (меняется фракция) и в начале хода игрока (для баз с прошлых ходов). Событие то же, `ABILITY_ACTIVATED`, флаг `used` ставится сразу, так что `ACTIVATE` для такой способности недоступна. Способности с выбором, сбросом или утилизацией (например, Мозгомир, Свалка металлолома) и утилизация самой карты остаются ручными (`ACTIVATE`).

Постоянные свойства (`Card.passives`) не активируются: `ALL_FACTIONS` (Mech World считается союзником всех фракций) и `SHIP_COMBAT_BONUS` (Fleet HQ: каждый корабль, сыгранный после него, даёт +1 атаки; уже сыгранные корабли бонус не получают).

**Исследователи** (`EXPLORER_COUNT = 20`) лежат отдельной стопкой `explorers`. Утилизированный Исследователь не попадает в `scrapHeap`: `sendToScrap` кладёт его обратно в низ стопки (событие всё равно `CARD_SCRAPPED`, клиент по `EXPLORER_CARD_ID` увеличивает `explorersCount`).

Упрощения: «положите следующий корабль на верх колоды» (`nextShipToDeckTop`) срабатывает автоматически, без вопроса «можете»; «возьмите карту за каждую утилизированную/сброшенную» берётся сразу после каждой карты, а не пачкой в конце. Stealth Needle запоминает скопированную карту в `PlayedCard.copyOf`: способности и фракции считаются по ней (`effectiveCard`).
