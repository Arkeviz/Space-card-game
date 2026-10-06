# Сервер матчей. Собирать из корня репозитория: docker build -f apps/server/Dockerfile .
#
# Раскладка монорепозитория сохраняется (packages/engine, packages/protocol, apps/server): Node запускает .ts
# напрямую (снимает типы на лету), а для файлов внутри node_modules он этого не делает. Workspace-пакеты в
# node_modules - символические ссылки на packages/*, и реальный путь у них вне node_modules, поэтому всё работает.
# Копирование пакетов (`pnpm deploy`) здесь не подошло бы.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

# Версия pnpm та же, что в packageManager корневого package.json.
RUN npm install --global pnpm@11.14.0

WORKDIR /app

# Сначала только манифесты: слой с зависимостями пересобирается, только когда они меняются.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile --prod --filter @space/server...

COPY packages/engine/src packages/engine/src
COPY packages/protocol/src packages/protocol/src
COPY apps/server/src apps/server/src
COPY apps/server/drizzle apps/server/drizzle

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
USER node
CMD ["node", "apps/server/src/main.ts"]
