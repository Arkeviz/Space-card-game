#!/bin/sh
# Роль игрового сервера: владелец базы space без прав суперпользователя. Ей хватает прав на свои таблицы и миграции,
# но она не может читать файлы и запускать программы на сервере БД (COPY ... PROGRAM и т. п.).
# Образ postgres выполняет скрипт один раз, при первой инициализации пустого тома с данными.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE space LOGIN PASSWORD :'app_password';
ALTER DATABASE space OWNER TO space;
SQL
