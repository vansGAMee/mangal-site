# Инструкция по развёртыванию «МАНГАЛ» на Ubuntu / Debian VPS

Данная инструкция содержит пошаговые команды для полного запуска автономного сайта заведения с админкой и защищённой базой данных PostgreSQL на одном VPS.

---

## Требования к серверу (VPS)

- **ОС**: Ubuntu 22.04 LTS / 24.04 LTS или Debian 12.
- **Ресурсы**: от 1 vCPU, 2 ГБ RAM, 20 ГБ SSD.
- **Сеть**: Публичный IPv4-адрес, открытые порты 80 (HTTP) и 443 (HTTPS).
- **Домен**: A-запись вашего домена (например, `cafe-mangal.ru`), указывающая на IP-адрес VPS.

---

## Шаг 1. Подключение к серверу и установка Docker

Подключитесь к VPS по SSH:
```bash
ssh root@<IP_ВАШЕГО_СЕРВЕРА>
```

Обновите пакеты и установите Docker Engine и Docker Compose plugin:
```bash
apt-get update && apt-get install -y curl git ca-certificates gnupg

# Установка ключа Docker и репозитория
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверьте корректность установки:
```bash
docker compose version
```

---

## Шаг 2. Клонирование репозитория

Клонируйте проект и перейдите в рабочую папку:
```bash
git clone https://github.com/vansGAMee/mangal-site.git /opt/mangal-site
cd /opt/mangal-site
git checkout feat/real-constructor
```

---

## Шаг 3. Настройка переменных окружения (.env.production)

Создайте рабочий конфигурационный файл из примера:
```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Сгенерируйте стойкие ключи base64 через `openssl rand -base64 32` и отредактируйте `.env.production`:
```bash
nano .env.production
```

Заполните обязательные параметры:
- `SITE_DOMAIN=ваш-домен.ru`
- `POSTGRES_PASSWORD=стойкий_пароль_бд`
- `ADMIN_BOOTSTRAP_EMAIL=admin@ваш-домен.ru`
- `ADMIN_BOOTSTRAP_PASSWORD=сложный_пароль_админа`
- Сгенерируйте секреты для `PII_KEY_RING_JSON`, `PHONE_LOOKUP_HMAC_KEY`, `ADMIN_SESSION_HMAC_KEY`, `MFA_ENCRYPTION_KEY`, `CSRF_HMAC_KEY`, `INTERNAL_JOBS_TOKEN`, `STOREFRONT_REVALIDATE_SECRET`.

---

## Шаг 4. Сборка и запуск контейнеров

Запустите контейнерный стек в фоновом режиме:
```bash
docker compose -f docker-compose.production.yml up -d --build
```

Проверьте статус контейнеров (все сервисы должны иметь статус `healthy` или `running`):
```bash
docker compose -f docker-compose.production.yml ps
```

---

## Шаг 5. Применение миграций базы данных

Примените схему PostgreSQL:
```bash
docker compose -f docker-compose.production.yml exec platform npx prisma migrate deploy
```

---

## Шаг 6. Создание первичном администратора

Запустите инициализацию администратора:
```bash
docker compose -f docker-compose.production.yml exec platform npm run admin:bootstrap
```

> ⚠️ **Сохраните вывод в надежном месте!** Вывод содержит MFA TOTP URI и разовые коды восстановления (Recovery Codes).

---

## Шаг 7. Проверка работы сайта и админки

Откройте в браузере:
- **Витрина**: `https://ваш-домен.ru` (HTTPS-сертификат от Let's Encrypt выписывается автоматически Caddy).
- **Панель управления**: `https://ваш-домен.ru/admin/login`

Войдите, измените название заведения, цвета, загрузите логотип и обложку, а также создайте или отредактируйте товар с фото.

---

## Шаг 8. Создание первой резервной копии

Выполните скрипт резервного копирования (дамп PostgreSQL + пользовательские загрузки `/app/uploads`):
```bash
chmod +x scripts/backup-vps.sh scripts/restore-vps.sh
./scripts/backup-vps.sh
```
Архивы сохранятся в папку `./backups/`.

---

## Полезные команды обслуживания

### Просмотр логов:
```bash
docker compose -f docker-compose.production.yml logs -f
```

### Перезапуск сервисов:
```bash
docker compose -f docker-compose.production.yml restart
```

### Обновление сайта без потери данных:
```bash
git pull origin feat/real-constructor
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec platform npx prisma migrate deploy
```

### Восстановление из резервной копии:
```bash
./scripts/restore-vps.sh ./backups/mangal-db-ГГГГММДД-ЧЧММСС.dump ./backups/mangal-uploads-ГГГГММДД-ЧЧММСС.tar.gz mangal
```
