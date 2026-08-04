#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="./backups"
MAX_BACKUPS="${MAX_BACKUPS:-10}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
DB_BACKUP_FILE="${BACKUP_DIR}/mangal-db-${TIMESTAMP}.dump"
UPLOADS_BACKUP_FILE="${BACKUP_DIR}/mangal-uploads-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "→ Создание резервной копии базы данных PostgreSQL..."
docker compose exec -T postgres pg_dump -U mangal -d mangal -Fc > "${DB_BACKUP_FILE}"

# Проверка ненулевого размера файла дампа
if [ ! -s "${DB_BACKUP_FILE}" ]; then
  echo "ОШИБКА: Резервная копия базы данных пуста или не создана!"
  rm -f "${DB_BACKUP_FILE}"
  exit 1
fi

echo "→ Создание резервной копии пользовательских загрузок..."
if [ -d ".data/media" ] || docker compose exec -T platform test -d /app/uploads; then
  docker compose exec -T platform tar -czf - -C /app uploads > "${UPLOADS_BACKUP_FILE}" 2>/dev/null || true
fi

# Удаление старых бэкапов базы данных свыше лимита MAX_BACKUPS
echo "→ Ротация старых резервных копий (лимит: ${MAX_BACKUPS})..."
find "${BACKUP_DIR}" -name "mangal-db-*.dump" -type f | sort -r | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f
find "${BACKUP_DIR}" -name "mangal-uploads-*.tar.gz" -type f | sort -r | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

echo "============================================================"
echo "  ✓ Резервная копия успешно создана:"
echo "  Дамп БД: ${DB_BACKUP_FILE} ($(du -h "${DB_BACKUP_FILE}" | cut -f1))"
if [ -f "${UPLOADS_BACKUP_FILE}" ] && [ -s "${UPLOADS_BACKUP_FILE}" ]; then
  echo "  Архив загрузок: ${UPLOADS_BACKUP_FILE} ($(du -h "${UPLOADS_BACKUP_FILE}" | cut -f1))"
fi
echo "============================================================"
