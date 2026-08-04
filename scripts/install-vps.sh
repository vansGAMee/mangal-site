#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "  Установка и запуск mangal-site на Ubuntu VPS"
echo "============================================================"

# 1. Проверка Docker & Docker Compose
if ! command -v docker &> /dev/null; then
  echo "ОШИБКА: docker не установлен. Установите Docker: https://docs.docker.com/engine/install/ubuntu/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "ОШИБКА: docker compose не доступен."
  exit 1
fi

# 2. Проверка наличия .env
if [ ! -f ".env" ]; then
  if [ -f "scripts/setup-client-env.sh" ]; then
    echo "Файл .env не найден. Запускаем генерацию новой конфигурации..."
    bash scripts/setup-client-env.sh
  else
    echo "ОШИБКА: Файл .env отсутствует. Создайте .env на основе .env.example"
    exit 1
  fi
fi

# 3. Создание необходимых директорий
mkdir -p .data/media backups

# 4. Запуск контейнеров через Docker Compose
echo "→ Сборка и запуск контейнеров..."
docker compose up -d --build

# 5. Применение миграций Prisma
echo "→ Применение миграций базы данных..."
docker compose exec -T platform npx prisma migrate deploy

echo ""
echo "============================================================"
echo "  ПРОЕКТ УСПЕШНО ЗАПУЩЕН!"
echo "============================================================"
echo "Статус контейнеров:"
docker compose ps
