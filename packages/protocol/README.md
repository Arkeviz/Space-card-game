# @space/protocol

Контракт сообщений между клиентом и сервером: схемы Valibot и их типы.

## Структура

```text
src/
  index.ts             публичный API пакета
  messages/            сообщения по протоколу
    heartbeat.ts       HEARTBEAT (PING/PONG) и схемы
```

Дальше сюда добавятся сообщения игры: `messages/client.ts` (команды игрока и SYNC), `messages/server.ts`
(`update`, `ack`, `reject`) и схема входящих команд на основе типов `@space/engine`.

Строковые значения сообщений объявляются `as const` объектами (как `HEARTBEAT`), по тем же правилам, что и в
[@space/engine](../engine/README.md).
