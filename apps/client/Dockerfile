# Клиент: сборка Vite и раздача через nginx (он же проксирует /ws на сервер).
# Собирать из корня репозитория: docker build -f apps/client/Dockerfile .
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build

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

FROM nginx:alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/client/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
EXPOSE 80
