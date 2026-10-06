# Клиент: сборка Vite и раздача через nginx (он же проксирует /ws на сервер).
# Собирать из корня репозитория: docker build -f apps/client/Dockerfile .
FROM node:24-alpine AS build

RUN npm install --global pnpm@11.14.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY packages/protocol packages/protocol
COPY apps/client apps/client
RUN pnpm --filter @space/client build

FROM nginx:alpine
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/client/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
EXPOSE 80
