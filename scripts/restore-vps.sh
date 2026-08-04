#!/usr/bin/env bash
set -euo pipefail

DB_FILE="${1:-}"
UPLOADS_FILE=""
CONFIRMATION=""

if [ "$#" -eq 2 ]; then
  CONFIRMATION="$2"
elif [ "$#" -ge 3 ]; then
  UPLOADS_FILE="$2"
  CONFIRMATION="$3"
fi

if [ -z "${DB_FILE}" ] || [ "${CONFIRMATION}" != "mangal" ]; then
  echo "Использование:"
  echo "  ./scripts/restore-vps.sh <путь_к_дампу_db> [путь_к_архиву_uploads] mangal"
  echo ""
  echo "Пример:"
  echo "  ./scripts/restore-vps.sh ./backups/mangal-db-20260804-120000.dump mangal"
  echo "  ./scripts/restore-vps.sh ./backups/mangal-db-20260804-120000.dump ./backups/mangal-uploads-20260804-120000.tar.gz mangal"
  exit 1
fi

if [ ! -f "${DB_FILE}" ] || [ ! -s "${DB_FILE}" ]; then
  echo "ОШИБКА: Файл резервной копии БД '${DB_FILE}' не существует или пуст."
  exit 1
fi

if [ -n "${UPLOADS_FILE}" ] && { [ ! -f "${UPLOADS_FILE}" ] || [ ! -s "${UPLOADS_FILE}" ]; }; then
  echo "ОШИБКА: Файл резервной копии uploads '${UPLOADS_FILE}' не существует или пуст."
  exit 1
fi

echo "ВНИМАНИЕ: Восстановление перезапишет существующую базу данных PostgreSQL!"
echo "Выполняется восстановление из ${DB_FILE}..."

# Остановка платформы и витрины на время восстановления
docker compose stop platform storefront || true

# Восстановление дампа базы данных в PostgreSQL
docker compose exec -T postgres pg_restore -U mangal -d mangal --clean --if-exists --no-owner --no-privileges < "${DB_FILE}"

# Если передан архив загрузок — восстанавливаем в volume
if [ -n "${UPLOADS_FILE}" ]; then
  echo "→ Восстановление архива загрузок из ${UPLOADS_FILE}..."
  docker compose exec -T platform tar -xzf - -C /app < "${UPLOADS_FILE}"
fi

# Перезапуск сервисов
docker compose start platform storefront

echo "============================================================"
echo "  ✓ Резервная копия успешно восстановлена"
echo "============================================================"
