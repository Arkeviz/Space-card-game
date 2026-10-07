# @space/server

Fastify + `@fastify/websocket`. Маршрут `/ws` (и `/health`), логика матчей - в памяти процесса, партии сохраняются в PostgreSQL.

## Структура

```text
src/
  main.ts             запуск (слушает PORT, по умолчанию 3001)
  app.ts               buildApp(): сборка Fastify-приложения, разбор входящих WS-сообщений, маршрутизация в MatchManager, лимиты
  limits.ts             Limits и DEFAULT_LIMITS, TokenBucket, clientKey (адрес клиента для лимитов)
  socket.ts             sendText: отправка с обрывом соединения, которое не читает ответы
  match-manager.ts      MatchManager: комнаты, вход, быстрый поиск, реванш, таймауты хода и отключения
  room.ts               Room, Seat, токены (хэши), COMMAND_SOURCE и причина конца партии
  config.ts             loadConfig: PORT, DATABASE_URL, MATCH_RETENTION_DAYS, TRUST_PROXY, лимиты по адресу
  storage/              MatchRepository, схема Drizzle, Postgres-реализация, подключение и миграции, срок хранения
  testing.ts            FakeSocket и помощники для тестов
  *.test.ts             тесты рядом с кодом
drizzle/                SQL-миграции (drizzle-kit generate), хранятся в репозитории
```

## Поток матча

Игрок подключается к `/ws` и называет себя: имя (до 20 символов, без управляющих) идёт в `create-match`, `join-match` и
`find-match`. Пустое имя сервер заменяет на имя по умолчанию для места: создатель матча - «Митяй», второй игрок - «Валера». За каждым сокетом `MatchManager` хранит привязку к месту в комнате (`bindings`, `bindingOf`), поэтому
при поиске и реванше место меняется у сокета, который сам ничего не присылал.

1. **По коду.** `create-match`: сервер создаёт `Room`, выдаёт `matchId`, 6-символьный код (без похожих друг на друга
   символов: без `0/O`, `1/I/L`) и секретный `token` для переподключения. Игрок занимает место 0. Партия
   (`GameState`) ещё не создана - ждём второго игрока. `join-match` с кодом занимает место 1.
2. **Быстрый поиск.** `find-match` ставит сокет в очередь (`search-status { searching: true }`); следующий искатель
   сводится с первым ждущим: создаётся комната, оба получают `joined`. `cancel-search` и закрытие сокета убирают из очереди.
3. **Старт партии** (`startRoom`) одинаков для обоих путей: сервер создаёт партию (`createGame` с сидом из
   `crypto.randomInt`, **не** из детерминированного RNG `@space/engine` - тот только для игровой логики) и рассылает
   обоим `opponent-status` и первый `update`.
4. Команды идут через `{ type: 'command', commandId, command }`. Сервер применяет `apply()` из `@space/engine`,
   отправителю - `ack`/`reject`, обоим игрокам - персональный `update` (`redact`/`redactEvents` под конкретного
   зрителя). В `update` же идут имена игроков (`names`, по номеру места) и `endReason`.
5. `sync` отдаёт полный снимок без событий - клиент использует его после переподключения или при рассинхронизации
   версий.
6. `leave-match` отвязывает сокет от комнаты, не закрывая его: ожидающая комната удаляется, из идущей партии игрок
   выходит со сдачей (ушедший больше ничего не получает), законченную оставляет. На оставленное место по токену
   вернуться нельзя. Благодаря этому следующий `create-match` с того же сокета не получает `already-in-match`.

### Токены

Открытый `token` существует только в ответе `joined`; на сервере (`Seat.tokenHash`) хранится sha256 от него, `reconnect`
сравнивает хэши через `timingSafeEqual`.

### Причина конца партии

`endReason` в `update` (`null`, пока партия идёт): `authority` (авторитет обнулён), `concede` (сдача по кнопке или выход),
`disconnect` (не вернулся за `disconnectTimeoutMs`), `idle` (молчал `maxIdleActions` ходов). Её определяет `endReasonOf`
по команде и источнику: `submitCommand(..., source)` принимает `COMMAND_SOURCE` (`player`, `timeout`, `disconnect`, `idle`).

### Реванш

Когда партия окончена, оба игрока получают `rematch-status { you, opponent, available }`. `rematch` ставит свою
отметку; когда отметили оба, старая комната удаляется, создаётся новая с теми же именами и сокетами, оба получают
`joined` с новым `matchId` и токеном, затем первый `update`. `available: false`, если соперник отключился или вышел (его предложение
при этом снимается). Во время партии `rematch` игнорируется.

## Таймауты

- **Таймаут хода** (`turnTimeoutMs`, по умолчанию 120 000 мс): если игрок, чей ход (или кто должен ответить на
  открытый prompt), не действует вовремя, сервер сам выбирает и применяет действие - `SKIP`, если он доступен и
  есть открытый prompt, иначе `END_TURN`. Оба варианта всегда допустимы по правилам движка. Таймер перезапускается
  после каждой принятой команды (это таймаут бездействия, а не лимит на весь ход). Сколько осталось, сервер
  сообщает в каждом `update` и в ответе на `sync` полем `turnTimeLeftMs` (относительное значение, не зависит от
  разницы часов); `null` - партия окончена.
- **Таймаут отключения** (`disconnectTimeoutMs`, по умолчанию 90 000 мс): если сокет закрылся и игрок не
  переподключился по `reconnect` (с `matchId` + `token`) до истечения таймера, за него автоматически применяется
  команда `CONCEDE`, и соперник побеждает. Переподключение сбрасывает таймер. Если к концу таймера соперник тоже не на связи
  (оба закрыли вкладки), победителя нет: партия считается брошенной, комната удаляется.

Оба таймаута настраиваются через `buildApp(options)` / `new MatchManager(options)` - в тестах используются короткие
значения через `vi.useFakeTimers()`, чтобы не ждать реальное время.

## Удаление комнат

Комната удаляется (`MatchManager.deleteRoom`: таймеры остановлены, сокеты закрыты, код перестаёт действовать):

- **не дождалась соперника** - через `waitingTimeoutMs` (по умолчанию 15 минут) после создания; создатель получает `error: expired`.
  Если создатель закрыл вкладку, не дождавшись, комната живёт ещё `disconnectTimeoutMs`; возвращение по токену продлевает ожидание заново;
- **партия окончена** - через `finishedTtlMs` (10 минут): до этого к ней можно переподключиться и увидеть итог.

Партия не может идти вечно: если сервер ходил за одного и того же игрока по таймауту `maxIdleActions` раз подряд (по умолчанию 3) и тот ни разу не
подал команду, ему засчитывается сдача (`CONCEDE`). Первая же команда игрока обнуляет счётчик. Остановка приложения (`app.close`) вызывает `dispose()`.

## Статус соперника

При отключении сокета соперник получает `opponent-status { connected: false, reconnectTimeLeftMs }` (отсчёт до автоматической сдачи), при возвращении -
`connected: true`. Вернувшийся игрок и вошедший второй игрок тоже сразу узнают текущий статус соперника.

## Защита от перегрузки

Один клиент не должен останавливать сервер для всех. Пределы - `Limits` в `limits.ts` (значения по умолчанию - `DEFAULT_LIMITS`,
в тестах - через `buildApp({ limits })`), применяет их `app.ts`:

- **Размер сообщения** - не больше `maxMessageBytes` (4 КБ, самое длинное настоящее - меньше килобайта). Больше - `ws` закрывает
  соединение с кодом 1009, не собирая сообщение целиком. Строки в схемах `@space/protocol` тоже ограничены по длине.
- **Частота сообщений** - ведро токенов на сокет (`TokenBucket`): в среднем `messagesPerSecond` (20 в секунду), подряд до
  `messageBurst` (40). Чаще - соединение закрывается с кодом 1008. Ответ на `sync` стоит процессорного времени (`legalActions`
  проверяет каждую команду через `apply`), и без предела один сокет занимал бы весь event loop.
- **Медленный читатель** - `sendText` (`socket.ts`) рвёт соединение, если в нём ждёт отправки больше 1 МБ: клиент, который шлёт
  запросы и не читает ответы, иначе исчерпал бы память сервера.
- **Соединения** - не больше `maxConnections` (2000) всего и `maxConnectionsPerIp` (20) с одного адреса; лишние закрываются с кодом 1013.
- **Новые матчи** - `create-match`, `join-match`, `find-match` и `rematch` с одного адреса не чаще `matchStartsPerHour` (60) в час,
  подряд до `matchStartBurst` (20): каждая партия - записи в базе. Сверх лимита - `error: rate-limited` (у `find-match` перед ним
  `search-status { searching: false }`).
- **Мёртвые соединения** - раз в `heartbeatIntervalMs` (30 с) сервер шлёт ping и закрывает сокет, не ответивший на предыдущий
  (браузер отвечает сам). Иначе вкладка, пропавшая без закрытия соединения, считалась бы на связи бесконечно.
- **Ошибка в обработчике** - обработка сообщения обёрнута в try/catch: исключение пишется в stderr и закрывает только этот сокет
  (код 1011, клиент переподключится и получит снимок), а не роняет процесс со всеми партиями.

Адрес клиента - `request.ip` Fastify, сведённый `clientKey` к ключу: IPv6 - к сети /64. За прокси сервер должен знать, каким
адресам верить в `X-Forwarded-For` (`TRUST_PROXY`), иначе все клиенты получили бы адрес прокси. nginx клиента перезаписывает
`X-Forwarded-For` адресом, который видит сам. Под Docker Desktop (Windows, macOS) контейнеры видят всех клиентов с адреса шлюза
Docker (например, `172.17.0.1`), поэтому в `docker-compose.yml` лимиты по адресу по умолчанию выключены (0).

## Хранение партий (PostgreSQL + Drizzle)

Партии хранятся в PostgreSQL через `drizzle-orm` (`pg`). Игра с базой не связана жёстко (`MatchRepository` в
`storage/repository.ts`): записи идут в фоне, по порядку внутри комнаты (`Room.persisting`), и ошибка записи только логируется,
партия продолжается. Реализации: `PostgresMatchRepository` (боевая), `MemoryMatchRepository` (тесты), `NULL_REPOSITORY`
(без `DATABASE_URL` сервер работает как раньше, только в памяти).

Таблицы (`storage/schema.ts`):

- `matches` - партия: `id`, `code`, `status` (`active`, `finished`, `abandoned`), `seed`, `names`, `token_hashes`, полное `state`
  (jsonb, вместе со скрытым: рука соперника, порядок колод, `rngState`; клиентам отдаётся только через `redact`), `version`,
  `winner`, `end_reason`, время создания, изменения и конца;
- `match_commands` - лог принятых команд (`match_id`, `seq` - версия после команды, `player`, `command`, `source`); удаляется каскадом.

Когда пишется: при старте партии (`createMatch`), после каждой принятой команды (`appendCommand`: лог и снимок одной
транзакцией, а при конце партии - статус, победитель, причина), при брошенной партии (`markAbandoned`).

**Восстановление.** При запуске (`onReady` в `app.ts`) `MatchManager.restore()` поднимает все `active` партии: те же `id` и код,
места заняты, сокетов нет. Клиенты переподключаются сами по токену (в базе только его хэш). Обоим игрокам идёт отсчёт отключения:
вернулся один - второй сдаётся по таймауту (причина `disconnect`), не вернулся никто - партия помечается `abandoned`.
Остановка сервера (`SIGTERM`, `SIGINT`, `app.close`) дожидается очередей записей и оставляет идущие партии `active`.

**Срок хранения.** `storage/retention.ts` при запуске и затем раз в час удаляет партии, не менявшиеся дольше
`MATCH_RETENTION_DAYS` (по умолчанию 14) суток, вместе с логом команд. Внешний cron не нужен: сервер один, а запрос идемпотентный.

**Миграции.** SQL-файлы лежат в `drizzle/` и хранятся в репозитории. Меняете схему - `pnpm db:generate` (drizzle-kit по
`src/storage/schema.ts`), коммитите файлы. Применяются из кода при старте (`storage/database.ts`), поэтому drizzle-kit в боевом
образе не нужен.

## Конфигурация

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PORT` | 3001 | порт HTTP/WS-сервера |
| `DATABASE_URL` | не задана | строка подключения к PostgreSQL; без неё партии только в памяти и пропадают при перезапуске |
| `MATCH_RETENTION_DAYS` | 14 | сколько суток партии хранятся после последнего изменения |
| `TRUST_PROXY` | не задана | каким прокси верить в `X-Forwarded-For`: адреса, подсети и имена `loopback`, `linklocal`, `uniquelocal` через запятую (в Docker - `uniquelocal`) |
| `MAX_CONNECTIONS_PER_IP` | 20 | сколько соединений держится с одного адреса; 0 - без предела |
| `MATCH_STARTS_PER_HOUR` | 60 | сколько матчей в час можно начать с одного адреса; 0 - без предела |

`pnpm dev` и `pnpm start` подхватывают файл `apps/server/.env` (`node --env-file-if-exists`); пример - `.env.example`. Неверное значение
останавливает запуск с понятным сообщением (`config.ts`). `GET /health` отвечает `{ "status": "ok" }` (проверка живости в Docker).

## Docker

В корне репозитория лежит `docker-compose.yml` (PostgreSQL 17, сервер, клиент с nginx) для локального запуска; образы не публикуются.
На боевой сервер он выкладывается вместе с `docker-compose.prod.yml` (см. «Развёртывание на сервере» ниже).

```bash
cp .env.example .env   # пароли базы (POSTGRES_PASSWORD, APP_DB_PASSWORD): без них compose не запускается
pnpm db:up             # только база (порт 5432 на localhost); сервер и клиент - из IDE: DATABASE_URL в apps/server/.env
pnpm docker:up         # весь стек, http://localhost:8181
```

**Роли базы.** Суперпользователь `postgres` (пароль `POSTGRES_PASSWORD`) нужен только для обслуживания и интеграционного
теста. Сервер ходит ролью `space` (пароль `APP_DB_PASSWORD`): владелец базы `space` без прав суперпользователя, её создаёт
`docker/postgres/01-app-role.sh`. Образ postgres выполняет этот скрипт и берёт пароли из окружения только при первой
инициализации пустого тома `pgdata`.

**Том, созданный до появления отдельной роли.** Тогда `space` был суперпользователем, созданным при инициализации тома (с паролем
`space`), и снять с него права нельзя. Проще всего удалить том вместе с партиями: `docker compose down -v`, затем `pnpm docker:up`.
Сохранить партии можно так: создать `.env`, остановить сервер (`docker compose stop server`), открыть
`docker compose exec db psql -U space -d space` и выполнить, подставив свои пароли из `.env`:

```sql
CREATE ROLE migrator SUPERUSER LOGIN;
\c - migrator
ALTER ROLE space RENAME TO postgres;
ALTER ROLE postgres PASSWORD 'POSTGRES_PASSWORD из .env';
CREATE ROLE space LOGIN PASSWORD 'APP_DB_PASSWORD из .env';
ALTER DATABASE space OWNER TO space;
ALTER SCHEMA drizzle OWNER TO space;
ALTER TABLE drizzle.__drizzle_migrations OWNER TO space;
ALTER TABLE matches OWNER TO space;
ALTER TABLE match_commands OWNER TO space;
\c - postgres
DROP ROLE migrator;
```

Бывший `space` становится суперпользователем `postgres`, а сервер получает новую роль `space` и владение таблицами. Затем `pnpm docker:up`.

### Развёртывание на сервере (Ubuntu, HTTPS)

`docker-compose.prod.yml` накладывается на `docker-compose.yml` и добавляет Caddy: он получает и сам продлевает сертификат
Let's Encrypt для `DOMAIN`, редиректит HTTP на HTTPS, отдаёт `/ws` прямо серверу (с настоящим адресом игрока в
`X-Forwarded-For`, поэтому лимиты по адресу работают, если включить их в `.env`), а остальное - клиенту (`deploy/Caddyfile`). Наружу открыты только порты
80 и 443 (и 443/udp для HTTP/3): у `client` и `db` публикация портов снята, иначе Docker открыл бы их мимо UFW.

1. **DNS.** В зоне домена A-запись (например, `star-realms`) на IPv4 сервера; проверка - `dig +short star-realms.arkeviz.ru`.
   AAAA не добавлять: без IPv6 в Docker игроки по IPv6 пришли бы с одного адреса шлюза, и лимиты стали бы общими. Если у
   хостера есть свой файрвол, открыть в нём 22, 80, 443 (tcp) и 443 (udp).
2. **Система.** `sudo apt update && sudo apt upgrade -y`; отдельный пользователь с sudo и SSH-ключом, вход по паролю и root по
   SSH отключить; файрвол:

   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw enable
   ```

   При 2 ГБ памяти и меньше добавить swap: сборка клиента и `pnpm install` внутри `docker build` её съедают.
3. **Docker.** Docker Engine и плагин Compose из официального apt-репозитория
   ([инструкция для Ubuntu](https://docs.docker.com/engine/install/ubuntu/)), не snap и не `docker.io`; затем
   `sudo usermod -aG docker $USER` и перезайти. Нужен Compose 2.24.4 или новее (`docker compose version`). Если `docker pull`
   отвечает 403 (бывает у серверов в РФ), указать зеркало: `{"registry-mirrors": ["https://mirror.gcr.io"]}` в
   `/etc/docker/daemon.json` и `sudo systemctl restart docker`.
4. **Код.**

   ```bash
   git clone git@github.com:Arkeviz/Space-card-game.git ~/space-card-game && cd ~/space-card-game
   ```

   Для приватного репозитория: `ssh-keygen -t ed25519` на сервере, публичный ключ - в GitHub, Settings -> Deploy keys (только чтение).
5. **`.env`.** `cp .env.example .env`, записать `POSTGRES_PASSWORD` и `APP_DB_PASSWORD` (`openssl rand -hex 24`), раскомментировать
   `DOMAIN` и `COMPOSE_FILE`, затем `chmod 600 .env`. Пароли базы применяются только при первой инициализации тома `pgdata`,
   так что задать их нужно до первого запуска.
6. **Запуск.**

   ```bash
   docker compose up -d --build
   docker compose ps                  # всё healthy
   docker compose logs -f caddy       # ждать «certificate obtained successfully»
   ```

   Затем открыть `https://star-realms.arkeviz.ru` и сыграть партию из двух вкладок. Сертификаты лежат в томе `caddy_data`:
   его не удалять (лимиты Let's Encrypt), при `docker compose down` не использовать `-v`.
7. **Обновление.** Автоматически (см. «Автодеплой» ниже) или вручную: `sh deploy/deploy.sh` - подтягивает `origin/main`,
   пересобирает изменившиеся образы и ждёт healthcheck'ов. Идущие партии сервер поднимет из базы сам, игроки переподключатся
   по токену. Зависимости заново не ставятся, пока не изменился lock-файл (кэш слоёв Docker), а при изменении докачиваются
   только новые пакеты (хранилище pnpm в кэше BuildKit). Этот кэш удаляют `docker builder prune` и `docker system prune -a`.
8. **Копия базы** (например, из cron): `docker compose exec -T db pg_dump -U space space | gzip > backup-$(date +%F).sql.gz`.

### Автодеплой (GitHub Actions)

Job `deploy` в `.github/workflows/ci.yml` после зелёного `check` на `main` (push или ручной запуск) заходит на
сервер по SSH и запускает `deploy/deploy.sh` с SHA проверенного коммита. Ключу деплоя на сервере разрешена только эта команда.
Настройка один раз:

1. Ключ без пароля (на любой машине): `ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f deploy_key`.
2. На сервере дописать в `~/.ssh/authorized_keys` пользователя, у которого лежит клон и есть доступ к Docker, одну строку
   (путь - свой, публичный ключ - содержимое `deploy_key.pub`):

   ```text
   command="sh /home/<user>/space-card-game/deploy/deploy.sh",restrict ssh-ed25519 AAAA... github-actions-deploy
   ```

   `restrict` запрещает терминал и проброс портов. Клон должен делать `git fetch` без вопросов (deploy key GitHub или публичный
   репозиторий по HTTPS).
3. Отпечаток сервера: `ssh-keyscan -t ed25519 <ip>` (сверить с `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` на сервере).
4. В GitHub: Settings -> Environments -> `production`, секреты `DEPLOY_HOST` (IP или домен), `DEPLOY_USER`, `DEPLOY_SSH_KEY`
   (содержимое приватного `deploy_key`, после этого файл удалить) и `DEPLOY_KNOWN_HOSTS` (вывод `ssh-keyscan`).

Порт 22 должен быть открыт для всех адресов: у раннеров GitHub нет постоянных IP. На `main` новый запуск CI ждёт предыдущий, а не отменяет его, чтобы не оборвать деплой на середине.

`apps/server/Dockerfile` сохраняет раскладку монорепозитория (`packages/*`, `apps/server`): Node запускает `.ts` напрямую и не
снимает типы с файлов внутри `node_modules`, а workspace-пакеты - ссылки на `packages/*` с реальным путём вне `node_modules`.
CI (`.github/workflows/ci.yml`): lint, типы и тесты (с сервисом postgres для интеграционного теста) и деплой на `main`. Сборка образов в CI закомментирована (их собирает деплой на сервере).

## Известные ограничения

- Один процесс, без горизонтального масштабирования: все матчи должны попадать на один и тот же инстанс. Очередь быстрого
  поиска тоже в памяти процесса.
- Счётчик «молчащих» ходов (`idleActions`) и предложения реванша при перезапуске не сохраняются.

## Команды

```bash
pnpm --filter @space/server dev          # node --watch src/main.ts
pnpm --filter @space/server test
pnpm --filter @space/server typecheck
pnpm db:generate                         # миграция по схеме (drizzle-kit)
```

Интеграционный тест `storage/postgres-repository.test.ts` идёт против настоящего PostgreSQL, если задан `TEST_DATABASE_URL`
(после `pnpm db:up` - суперпользователем: `postgres://postgres:<POSTGRES_PASSWORD>@localhost:5432/space`): он создаёт и удаляет собственную временную базу,
данные разработки не трогает. Без переменной тест пропускается.
