#!/usr/bin/env bash
set -euo pipefail

DB_FILE="${1:-}"
CONFIRMATION="${2:-}"

if [ -z "${DB_FILE}" ] || [ "${CONFIRMATION}" != "mangal" ]; then
  echo "Использование:"
  echo "  ./scripts/restore-vps.sh <путь_к_файлу_дампа> mangal"
  echo ""
  echo "Пример:"
  echo "  ./scripts/restore-vps.sh ./backups/mangal-db-20260804-120000.dump mangal"
  exit 1
fi

if [ ! -f "${DB_FILE}" ] || [ ! -s "${DB_FILE}" ]; then
  echo "ОШИБКА: Файл резервной копии '${DB_FILE}' не существует или пуст."
  exit 1
fi

echo "ВНИМАНИЕ: Восстановление перезапишет существующую базу данных PostgreSQL!"
echo "Выполняется восстановление из ${DB_FILE}..."

# Остановка платформы на время восстановления базы
docker compose stop platform storefront || true

# Восстановление дампа базы данных в PostgreSQL
docker compose exec -T postgres pg_restore -U mangal -d mangal --clean --if-exists --no-owner --no-privileges < "${DB_FILE}"

# Перезапуск сервисов
docker compose start platform storefront

echo "============================================================"
echo "  ✓ База данных успешно восстановлена из ${DB_FILE}"
echo "============================================================"
