#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "  Установка и запуск mangal-site на Ubuntu VPS"
echo "============================================================"

# 1. Проверка зависимости Docker
if ! command -v docker &> /dev/null; then
  echo "ОШИБКА: docker не установлен. Установите Docker: https://docs.docker.com/engine/install/ubuntu/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "ОШИБКА: docker compose плагин недоступен."
  exit 1
fi

# 2. Проверка наличии конфигурационного файла .env
if [ ! -f ".env" ]; then
  echo "Файл .env не найден. Запускаем генератор конфигурации..."
  bash scripts/setup-client-env.sh
fi

# 3. Валидация файла конфигурации Docker Compose
echo "→ Проверка конфигурации Docker Compose..."
docker compose config > /dev/null

# 4. Подготовка локальных каталогов
mkdir -p .data/media backups

# 5. Сборка и запуск контейнеров
echo "→ Сборка и запуск сервисов..."
docker compose up -d --build

# 6. Применение миграций PostgreSQL
echo "→ Применение миграций базы данных..."
docker compose exec -T platform npx prisma migrate deploy

echo ""
echo "============================================================"
echo "  ПРОЕКТ УСПЕШНО УСТАНОВЛЕН И ЗАПУЩЕН!"
echo "============================================================"
echo "Текущий статус сервисов:"
docker compose ps
