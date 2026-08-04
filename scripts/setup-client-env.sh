#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "  Мастер настройки нового заведения / клиента (VPS .env)"
echo "============================================================"

# Запрос и валидация домена
while true; do
  read -p "Введите домен сайта (например: mycafe.ru): " INPUT_DOMAIN
  INPUT_DOMAIN=$(echo "${INPUT_DOMAIN:-}" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
  if [[ "$INPUT_DOMAIN" =~ ^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$ ]]; then
    DOMAIN="$INPUT_DOMAIN"
    break
  else
    echo "ОШИБКА: Некорректный домен '$INPUT_DOMAIN'. Укажите действительное имя домена (например: mycafe.ru)."
  fi
done

read -p "Введите email администратора: " ADMIN_EMAIL
read -p "Введите название заведения: " VENUE_NAME

ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
VENUE_NAME=${VENUE_NAME:-Заведение}

# Функция безопасной генерации 32-байтовых секретов
generate_secret() {
  if command -v openssl &> /dev/null; then
    openssl rand -base64 32 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

generate_password() {
  if command -v openssl &> /dev/null; then
    openssl rand -hex 16 | tr -d '\n'
  else
    head -c 16 /dev/urandom | xxd -p | tr -d '\n'
  fi
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

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  echo "ВНИМАНИЕ: Файл .env уже существует. Создаём .env.new"
  ENV_FILE=".env.new"
fi

cat <<EOF > "$ENV_FILE"
# -----------------------------------------------------------------------------
# Конфигурация заведения ${VENUE_NAME} (${DOMAIN})
# Сгенерировано: $(date)
# -----------------------------------------------------------------------------

NODE_ENV=production
APP_ROLE=web
PORT=8080
DOMAIN="${DOMAIN}"

# База данных PostgreSQL
POSTGRES_PASSWORD="${POSTGRES_PASS}"
DATABASE_URL="postgresql://mangal:${POSTGRES_PASS}@postgres:5432/mangal?schema=public"
DIRECT_URL="postgresql://mangal:${POSTGRES_PASS}@postgres:5432/mangal?schema=public"

# Ключи шифрования и безопасности
PII_KEY_RING_JSON='{"activeKeyId":"vps-v1","keys":{"vps-v1":"${PII_KEY}"}}'
PHONE_LOOKUP_HMAC_KEY="${PHONE_KEY}"
ADMIN_SESSION_HMAC_KEY="${ADMIN_KEY}"
MFA_ENCRYPTION_KEY="${MFA_KEY}"
CSRF_HMAC_KEY="${CSRF_KEY}"
INTERNAL_JOBS_TOKEN="${JOBS_TOKEN}"
STOREFRONT_REVALIDATE_SECRET="${REVALIDATE_SECRET}"
DEMO_RESET_SECRET="${DEMO_RESET_SECRET}"

# Настройки домена и URL
ALLOWED_STOREFRONT_ORIGINS="${SITE_URL}"
ADMIN_BASE_URL="${SITE_URL}"
NEXT_PUBLIC_SITE_URL="${SITE_URL}"
PLATFORM_API_URL="${SITE_URL}"
NEXT_PUBLIC_PLATFORM_API_URL="${SITE_URL}"

# Локальное хранилище загрузок
STORAGE_DRIVER=local
LOCAL_MEDIA_ROOT=/app/uploads
MEDIA_PUBLIC_BASE_URL="${SITE_URL}"
NEXT_PUBLIC_MEDIA_BASE_URL="${SITE_URL}"

# Учетные данные для первого администратора
ADMIN_BOOTSTRAP_EMAIL="${ADMIN_EMAIL}"
EOF

chmod 600 "$ENV_FILE"

echo ""
echo "============================================================"
echo "  ✓ Конфигурация успешно создана!"
echo "  Домен: ${DOMAIN} (${SITE_URL})"
echo "  Email админа: ${ADMIN_EMAIL}"
echo "  Файл сохранён: ${ENV_FILE}"
echo "  Все секреты сгенерированы автоматически и не выводятся в лог."
echo "============================================================"
