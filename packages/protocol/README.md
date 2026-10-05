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
| `create-match` | - | создать матч, сервер отвечает `joined` с кодом для второго игрока |
| `join-match` | `code` | войти в матч по коду |
| `reconnect` | `matchId`, `token` | вернуться на своё место после разрыва соединения |
| `command` | `commandId`, `command` | игровая команда; `commandId` - для идемпотентности и связки с `ack`/`reject` |
| `sync` | - | запросить полный снимок состояния без анимаций |

`command` внутри `command`-сообщения проверяется `CommandSchema` из `command.ts` - она зеркалит union `Command` из
`@space/engine` по каждому из 12 вариантов (включая `CONCEDE` и `CHOOSE_CARDS`). При добавлении нового варианта в `engine` эту схему
нужно обновить руками - типы её не свяжут автоматически.

## Сервер -> клиент: `server.ts`

Типы (`JoinedMessage`, `UpdateMessage`, `OpponentStatusMessage`, `AckMessage`, `RejectMessage`, `ErrorMessage`) есть, но схем Valibot для них
**нет**: сервер - доверенный источник, его собственную форму сообщений уже гарантирует TypeScript в момент отправки.
Если понадобится защита от багов на стороне клиента (например, при парсинге `update`), это можно добавить позже.

`opponent-status` (`connected`, `reconnectTimeLeftMs`) приходит, когда соперник отключился или вернулся, и в ответ на вход/переподключение; `reconnectTimeLeftMs` - сколько осталось до автоматической сдачи отключившегося (`null`, пока он на связи).

`MATCH_ERROR` - ошибки уровня матча (`not-found`, `full`, `invalid-token`, `not-in-match`, `already-in-match`, `expired` - комната удалена, пока создатель ждал соперника),
отдельно от `CommandError` из `@space/engine` (ошибки конкретной команды, приходят в `reject.reason`).

Логика комнат матчей и таймаутов живёт в `apps/server` (`match-manager.ts`), не здесь.
