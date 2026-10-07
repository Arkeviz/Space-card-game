#!/bin/sh
# Деплой на боевом сервере: обновляет код до коммита из main и пересобирает изменившиеся образы.
# Запускает GitHub Actions (job deploy в .github/workflows/ci.yml) по SSH: в authorized_keys ключу деплоя задана
# принудительная команда (command="sh .../deploy/deploy.sh"), а SHA коммита приходит в SSH_ORIGINAL_COMMAND.
# Вручную: sh deploy/deploy.sh [sha] (без аргумента - последний коммит origin/main).
#
# Тело в функции: git reset ниже может переписать этот файл, а sh читает скрипт по ходу выполнения.
set -eu

main() {
  cd "$(dirname "$0")/.."

  # Два деплоя одновременно не идут: второй сразу завершается с ошибкой.
  exec 9>"${TMPDIR:-/tmp}/space-card-game-deploy.lock"
  if ! flock -n 9; then
    echo 'Деплой уже идёт' >&2
    exit 1
  fi

  sha="${SSH_ORIGINAL_COMMAND:-${1:-}}"
  git fetch --quiet origin main
  if [ -z "$sha" ]; then
    sha=$(git rev-parse origin/main)
  fi
  case "$sha" in
    *[!0-9a-f]*)
      echo "Ожидается SHA коммита, получено «$sha»" >&2
      exit 1
      ;;
  esac
  # Выкладывается только то, что уже есть в main.
  if ! git merge-base --is-ancestor "$sha" origin/main; then
    echo "Коммита $sha нет в origin/main" >&2
    exit 1
  fi

  git reset --quiet --hard "$sha"
  echo "Код: $(git log -1 --format='%h %s')"

  # --wait дожидается healthcheck'ов: если сервер не поднялся, деплой завершается с ошибкой.
  docker compose up -d --build --wait
  docker image prune -f
  docker compose ps
}

main "$@"
exit
