# @space/protocol

Контракт сообщений между клиентом и сервером: схемы Valibot и их типы.

## Структура

```text
src/
  index.ts             публичный API пакета
  messages/
    heartbeat.ts        HEARTBEAT (PING/PONG), схемы
    command.ts           CommandSchema - зеркало Command из @space/engine, parseCommand
    client.ts            CLIENT_MESSAGE, ClientMessageSchema, parseClientMessage (клиент -> сервер)
    server.ts             SERVER_MESSAGE, MATCH_ERROR, типы сообщений сервер -> клиент
```

Строковые значения сообщений объявляются `as const` объектами (как `HEARTBEAT`, `CLIENT_MESSAGE`, `SERVER_MESSAGE`),
по тем же правилам, что и в [@space/engine](../engine/README.md).

## Клиент -> сервер: `client.ts` + `command.ts`

Всё, что приходит от клиента, - непроверенные сетевые данные, поэтому у каждого сообщения есть схема Valibot.
`parseClientMessage(raw: string)` разбирает сырой текст WS-фрейма и возвращает `ClientMessage | null`.

| `type` | Поля | Назначение |
| --- | --- | --- |
| `create-match` | `name` | создать матч, сервер отвечает `joined` с кодом для второго игрока |
| `join-match` | `code`, `name` | войти в матч по коду |
| `find-match` | `name` | встать в очередь быстрого поиска |
| `cancel-search` | - | выйти из очереди |
| `reconnect` | `matchId`, `token` | вернуться на своё место после разрыва соединения |
| `leave-match` | - | покинуть матч (в идущей партии - сдача); сокет остаётся открытым |
| `rematch` | - | предложить реванш после конца партии или принять предложение соперника |
| `command` | `commandId`, `command` | игровая команда; `commandId` - для идемпотентности и связки с `ack`/`reject` |
| `sync` | - | запросить полный снимок состояния без анимаций |

Имя игрока (`PlayerNameSchema`): строка без пробелов по краям (обрезаются), 1-`PLAYER_NAME_MAX_LENGTH` (20) символов, без управляющих и невидимых
символов (`\p{C}`). Сообщение с некорректным именем отбрасывается как невалидное. Константа экспортируется для `maxlength` в клиенте.

`command` внутри `command`-сообщения проверяется `CommandSchema` из `command.ts` - она зеркалит union `Command` из
`@space/engine` по каждому из 12 вариантов (включая `CONCEDE` и `CHOOSE_CARDS`). При добавлении нового варианта в `engine` эту схему
нужно обновить руками - типы её не свяжут автоматически.

## Сервер -> клиент: `server.ts`

Типы (`JoinedMessage`, `UpdateMessage`, `OpponentStatusMessage`, `SearchStatusMessage`, `RematchStatusMessage`, `AckMessage`, `RejectMessage`, `ErrorMessage`) есть, но схем Valibot для них
**нет**: сервер - доверенный источник, его собственную форму сообщений уже гарантирует TypeScript в момент отправки.
Если понадобится защита от багов на стороне клиента (например, при парсинге `update`), это можно добавить позже.

`opponent-status` (`connected`, `reconnectTimeLeftMs`) приходит, когда соперник отключился или вернулся, и в ответ на вход/переподключение; `reconnectTimeLeftMs` - сколько осталось до автоматической сдачи отключившегося (`null`, пока он на связи).

`update` кроме снимка несёт `names` (имена по номеру места) и `endReason` (`END_REASON`: `authority`, `concede`, `disconnect`, `idle`; `null`, пока партия идёт).
`search-status { searching }` сообщает о постановке в очередь поиска и выходе из неё. `rematch-status { you, opponent, available }` - кто предложил реванш
и возможен ли он (соперник на месте).

`MATCH_ERROR` - ошибки уровня матча (`not-found`, `full`, `invalid-token`, `not-in-match`, `already-in-match`, `expired` - комната удалена, пока создатель ждал соперника),
отдельно от `CommandError` из `@space/engine` (ошибки конкретной команды, приходят в `reject.reason`).

Логика комнат матчей и таймаутов живёт в `apps/server` (`match-manager.ts`), не здесь.
