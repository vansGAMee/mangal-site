#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "  Мастер настройки нового заведения / клиента (VPS .env)"
echo "============================================================"

read -p "Введите домен сайта (например: mycafe.ru): " DOMAIN
read -p "Введите email администратора: " ADMIN_EMAIL
read -p "Введите название заведения (например: Кафе Шашлычный Дворик): " VENUE_NAME

DOMAIN=${DOMAIN:-localhost}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
VENUE_NAME=${VENUE_NAME:-Заведение}

# Генерация безопасных 32-байтовых base64 ключей и случайных паролей
generate_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

generate_password() {
  openssl rand -hex 16 | tr -d '\n'
}

POSTGRES_PASS=$(generate_password)
PII_KEY=$(generate_secret)
PHONE_KEY=$(generate_secret)
ADMIN_KEY=$(generate_secret)
MFA_KEY=$(generate_secret)
CSRF_KEY=$(generate_secret)
JOBS_TOKEN=$(generate_secret)
REVALIDATE_SECRET=$(generate_secret)
DEMO_RESET_SECRET=$(generate_secret)

SITE_URL="https://${DOMAIN}"
if [ "${DOMAIN}" = "localhost" ]; then
  SITE_URL="http://localhost:3000"
fi

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  echo "ВНИМАНИЕ: Файл .env уже существует. Создаём .env.new"
  ENV_FILE=".env.new"
fi

cat <<EOF > "$ENV_FILE"
# -----------------------------------------------------------------------------
# Конфигурация отдельной установки mangal-site для ${VENUE_NAME}
# Сгенерировано: $(date)
# -----------------------------------------------------------------------------

NODE_ENV=production
APP_ROLE=web
PORT=8080

# Ссылка на PostgreSQL
DATABASE_URL="postgresql://mangal:${POSTGRES_PASS}@postgres:5432/mangal?schema=public"
DIRECT_URL="postgresql://mangal:${POSTGRES_PASS}@postgres:5432/mangal?schema=public"
POSTGRES_PASSWORD="${POSTGRES_PASS}"

# Ключи шифрования ПД и HMAC
PII_KEY_RING_JSON='{"activeKeyId":"vps-v1","keys":{"vps-v1":"${PII_KEY}"}}'
PHONE_LOOKUP_HMAC_KEY="${PHONE_KEY}"
ADMIN_SESSION_HMAC_KEY="${ADMIN_KEY}"
MFA_ENCRYPTION_KEY="${MFA_KEY}"
CSRF_HMAC_KEY="${CSRF_KEY}"
INTERNAL_JOBS_TOKEN="${JOBS_TOKEN}"
STOREFRONT_REVALIDATE_SECRET="${REVALIDATE_SECRET}"
DEMO_RESET_SECRET="${DEMO_RESET_SECRET}"

# Настройки доменов и протоколов
ALLOWED_STOREFRONT_ORIGINS="${SITE_URL}"
ADMIN_BASE_URL="${SITE_URL}"
NEXT_PUBLIC_SITE_URL="${SITE_URL}"
PLATFORM_API_URL="${SITE_URL}"
NEXT_PUBLIC_PLATFORM_API_URL="${SITE_URL}"

# Локальное хранилище медиа и загрузок
STORAGE_DRIVER=local
LOCAL_MEDIA_ROOT=/app/uploads
MEDIA_PUBLIC_BASE_URL="${SITE_URL}"
NEXT_PUBLIC_MEDIA_BASE_URL="${SITE_URL}"

# Начальные учетные данные для первого администратора
ADMIN_BOOTSTRAP_EMAIL="${ADMIN_EMAIL}"
EOF

chmod 600 "$ENV_FILE"

echo ""
echo "✓ Сгенерирован безопасный файл ${ENV_FILE}!"
echo "  Домен: ${SITE_URL}"
echo "  Email админа: ${ADMIN_EMAIL}"
echo "  Пароли и ключи шифрования созданы случайно и защищены."
