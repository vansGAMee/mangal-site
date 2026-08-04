# Подробная ручная установка «МАНГАЛ» на VPS (Ubuntu Linux)

Данное руководство содержит пошаговую инструкцию по ручному развёртыванию проекта «МАНГАЛ» на виртуальном выделенном сервере (VPS) под управлением Ubuntu Linux. Инструкция составлена максимально подробно и понятна даже человеку без опыта работы с Linux.

---

## 1. Требования к серверу

Перед началом работы убедитесь, что ваш VPS соответствует следующим требованиям:

- **Операционная система**: Ubuntu 22.04 LTS или 24.04 LTS (64-bit).
- **Процессор (CPU)**: минимум 1 ядро (vCPU).
- **Оперативная память (RAM)**: минимум **2 ГБ**.
- **Дисковое пространство**: желательно **20 ГБ SSD** (минимум 15 ГБ свободного места).
  
> ⚠️ **ПРЕДУПРЕЖДЕНИЕ О ДИСКОВОМ ПРОСТРАНСТВЕ**: 10 ГБ диска **недостаточно** для сборки и запуска Docker-контейнеров! Во время сборки приложений Next.js и PostgreSQL создаются временные слои Docker. Если на диске менее 10–12 ГБ свободного места, процесс сборки завершится ошибкой `No space left on device`.
>
> Проверить доступное дисковое пространство перед сборкой можно командой:
> ```bash
> df -h /
> ```
> Обращайте внимание на столбец `Avail` (Доступно).

---

## 2. Подключение к серверу по SSH

Откройте терминал (в Windows — PowerShell или Командную строку, в macOS/Linux — Терминал) и подключитесь к вашему VPS:

```bash
ssh root@IP_СЕРВЕРА
```

*Замените `IP_СЕРВЕРА` на реальный IP-адрес вашего VPS (например, `192.0.2.1`). При первом подключении введите `yes` для подтверждения fingerprint, затем введите пароль пользователя `root`.*

---

## 3. Установка необходимых системных пакетов

Обновите списки пакетов и установите Git, nginx, curl, openssl и Docker с плагином Docker Compose:

```bash
# Обновление пакетов
apt-get update && apt-get install -y curl git nginx openssl ca-certificates gnupg

# Настройка официального репозитория Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker Engine и Docker Compose plugin
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверьте, что Docker и Docker Compose успешно установлены:

```bash
docker --version
docker compose version
```

---

## 4. Клонирование репозитория проекта

Скопируйте репозиторий проекта с нужной веткой и перейдите в созданный каталог:

```bash
git clone -b release/v1-constructor-vps https://github.com/vansGAMee/mangal-site.git
cd mangal-site
```

---

## 5. Создание файла конфигурации (.env.production)

Скопируйте пример файла переменных окружения в боевой `.env.production`:

```bash
cp .env.production.example .env.production
```

> 🔒 **КРАЙНЕ ВАЖНО**: Никогда и ни при каких обстоятельствах **НЕ добавляйте `.env.production` в Git**! Этот файл содержит секретные ключи шифрования и пароли к базе данных. Файл `.gitignore` уже настроен для его игнорирования, не удаляйте его из `.gitignore`.

---

## 6. Настройка обязательных переменных окружения

Откройте `.env.production` в текстовом редакторе `nano`:

```bash
nano .env.production
```

Отредактируйте следующие обязательные переменные:

1. **Основные параметры сайта и базы данных**:
   - `SITE_DOMAIN` — домен вашего заведения без `http://` (например, `mangal-bar.ru` или IP-адрес `192.0.2.1`).
   - `DOMAIN` — укажите то же значение, что и в `SITE_DOMAIN`.
   - `POSTGRES_DB` — имя базы данных (по умолчанию `mangal`).
   - `POSTGRES_USER` — имя пользователя PostgreSQL (по умолчанию `mangal`).
   - `POSTGRES_PASSWORD` — надежный пароль базы данных (сгенерируйте случайную строку).
   - `ADMIN_BOOTSTRAP_EMAIL` — email для входа первого администратора (например, `admin@mangal-bar.ru`).
   - `ADMIN_BOOTSTRAP_PASSWORD` — надежный пароль администратора (минимум 14 символов!).
   - `ADMIN_BASE_URL` — полный адрес панели управления (например, `http://localhost:8080/admin` при использовании SSH-туннеля или `https://mangal-bar.ru/admin`).

2. **Криптографические секреты и ключи HMAC**:
   Все секретные ключи должны быть случайными строками формата base64.

---

## 7. Генерация криптографических секретов

Для каждого секрета выполните отдельную команду в терминале для получения стойкой случайной строки:

```bash
openssl rand -base64 48
```

Скопируйте сгенерированные строки в соответствующие поля `.env.production`:

- `PII_KEY_RING_JSON` — JSON-объект с ключом шифрования персональных данных, например:
  ```json
  {"activeKeyId":"vps-v1","keys":{"vps-v1":"СГЕНЕРИРОВАННАЯ_СТРОКА_BASE64"}}
  ```
- `PHONE_LOOKUP_HMAC_KEY` — сгенерируйте через `openssl rand -base64 48`
- `ADMIN_SESSION_HMAC_KEY` — сгенерируйте через `openssl rand -base64 48`
- `MFA_ENCRYPTION_KEY` — сгенерируйте через `openssl rand -base64 48`
- `CSRF_HMAC_KEY` — сгенерируйте через `openssl rand -base64 48`
- `INTERNAL_JOBS_TOKEN` — сгенерируйте через `openssl rand -base64 48`
- `STOREFRONT_REVALIDATE_SECRET` — сгенерируйте через `openssl rand -base64 48`

Сохраните файл в `nano` (нажмите `Ctrl + O`, затем `Enter`, для выхода нажмите `Ctrl + X`).

---

## 8. Проверка диска и поочередная сборка контейнеров

Чтобы сборка не перегружала оперативную память и дисковую систему VPS, выполняйте сборку сервисов **строго по очереди**:

1. Проверьте свободное место на диске перед сборкой:
   ```bash
   df -h /
   ```
   *Убедитесь, что доступно не менее 10–12 ГБ.*

2. Соберите сервис платформы (Backend API):
   ```bash
   docker compose --env-file .env.production -f docker-compose.production.yml build platform
   ```

3. Соберите сервис витрины (Frontend Storefront):
   ```bash
   docker compose --env-file .env.production -f docker-compose.production.yml build storefront
   ```

---

## 9. Запуск базы данных и платформы

Запустите только PostgreSQL и сервис platform (без Caddy на этом этапе):

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres platform
```

Дождитесь 10-15 секунд, пока инициализируется база данных.

---

## 10. Применение миграций базы данных

Примените схему Prisma к базе данных PostgreSQL:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec platform npx prisma migrate deploy
```

---

## 11. Первичное заполнение базы данных (Seed)

Заполните новую базу начальными данными (категории, базовые настройки витрины):

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec platform npx --yes tsx@4.20.5 prisma/seed.ts
```

---

## 12. Запуск клиентской витрины (Storefront)

Запустите контейнер витрины:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d storefront
```

---

## 13. Проверка статуса контейнеров

Проверьте состояние работающих контейнеров:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Все запущенные сервисы в колонке `STATUS` должны иметь отметку `(healthy)` или `running`.

---

## 14. Особенность развёртывания на сервере с Amnezia VPN (порт 443 занят)

Если на вашем VPS уже установлен **Amnezia VPN** (или другой VPN-сервис), порт `443` (HTTPS) занят VPN-сервером и не может использоваться веб-сервером Caddy.

### Правила работы в этом режиме:
- **НЕ запускать** Compose-сервис `caddy` из `docker-compose.production.yml` (он попытается занять порт 443 и заблокирует запуск).
- **НЕ трогать** порт `443`.
- **НЕ останавливать** контейнеры Amnezia VPN.
- Запустить изолированный Caddy на локальном интерфейсе `127.0.0.1:8088`.
- Установить системный Nginx на порт `80` (HTTP) и проксировать запросы на `127.0.0.1:8088`.

### Шаг A. Создание конфигурации `docker/Caddyfile.http`

Создайте файл `docker/Caddyfile.http` со следующим содержимым:

```caddyfile
{
  admin off
  auto_https off
}

:8088 {
  request_body {
    max_size 10MB
  }

  handle_path /uploads/* {
    root * /app/uploads
    file_server {
      hide .*
    }
  }

  handle /_platform/* {
    uri strip_prefix /_platform
    reverse_proxy platform:8080
  }

  handle /api/* {
    reverse_proxy platform:8080
  }

  handle /admin* {
    reverse_proxy platform:8080
  }

  handle {
    reverse_proxy storefront:3000
  }
}
```

Запустите контейнер Caddy в HTTP-режиме на порту 8088:

```bash
docker run -d \
  --name mangal-caddy-http \
  --network mangal-site_default \
  --restart always \
  -p 127.0.0.1:8088:8088 \
  -v $(pwd)/docker/Caddyfile.http:/etc/caddy/Caddyfile:ro \
  -v mangal-site_uploadsdata:/app/uploads:ro \
  caddy:2-alpine
```

### Шаг B. Настройка Nginx на порту 80

Создайте конфигурационный файл `/etc/nginx/sites-available/mangal-site`:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию и перезапустите Nginx:

```bash
ln -s /etc/nginx/sites-available/mangal-site /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## 15. Проблема «голого HTML без CSS» в HTTP-режиме

При открытии сайта по протоколу HTTP (без SSL-сертификата) вы можете столкнуться с ситуацией, когда страница загружается без стилей и оформления («голый HTML»).

### Причина:
Заголовок `Content-Security-Policy` (CSP) в продакшен-режиме по умолчанию содержит директиву `upgrade-insecure-requests`. Эта директива заставляет браузер принудительно преобразовывать все `http://` URL ресурсов (CSS-стили, картинки, JavaScript) в `https://`. Поскольку SSL на порту 443 не настроен, браузер блокирует загрузку этих файлов.

### Решение:
При работе сайта по HTTP директива `upgrade-insecure-requests` **не должна отправляться**. 
> ⚠️ **ПРЕДУПРЕЖДЕНИЕ по безопасности**: Не следует полностью отключать остальные защиты CSP (`script-src`, `style-src`, `img-src`, `frame-ancestors` и т.д.). Достаточно убедиться, что отключена или не добавляется именно директива `upgrade-insecure-requests`.

---

## 16. Инициализация учетной записи администратора

Выполните скрипт первичной генерации администратора:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  exec -u 0 platform \
  npx --yes tsx@4.20.5 \
  apps/platform/src/entrypoints/bootstrap-admin.ts --force
```

### Разбор вывода скрипта:
Скрипт выведет две важные группы данных:

1. **TOTP URI (`otpauth://totp/...`)**:
   Это ссылка для двухфакторной аутентификации (2FA). Скопируйте её или преобразуйте в QR-код и отсканируйте в приложении **Google Authenticator** или **Microsoft Authenticator**. При каждом входе в админку потребуется вводить 6-значный код из приложения.
2. **Recovery Codes (Резервные коды восстановления)**:
   Список из 10 одноразовых кодов. Скопируйте и сохраните их в надежном месте! Они понадобятся для входа в панель администратора, если вы потеряете доступ к телефону с приложением 2FA.

---

## 17. Безопасный вход в админку через SSH-туннель

Если сайт работает без HTTPS по порту 80, передавать пароль и TOTP-код администратора в открытом виде через интернет небезопасно. Используйте защищенный SSH-туннель.

### Настройка SSH-туннеля на вашем ПК:
Откройте новый терминал на вашем локальном компьютере и выполните:

```bash
ssh -N -L 8080:127.0.0.1:80 root@IP_СЕРВЕРА
```

### Вход в панель управления:
Откройте браузер на вашем ПК и перейдите по адресу:

```text
http://localhost:8080/admin/login
```

> ⚠️ **ОБРАТИТЕ ВНИМАНИЕ НА `ADMIN_BASE_URL`**: В `.env.production` параметр `ADMIN_BASE_URL` должен совпадать с адресом, через который вы заходите. Если вы используете туннель на `http://localhost:8080`, укажите:
> ```env
> ADMIN_BASE_URL=http://localhost:8080/admin
> ```
> Значения `localhost` и `127.0.0.1` учитываются системой строго, убедитесь в их совпадении при проверке.

---

## 18. Команды обслуживания и администрирования

### Проверка состояния контейнеров
```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

### Перезапуск platform и storefront
```bash
docker compose --env-file .env.production -f docker-compose.production.yml restart platform storefront
```

### Просмотр логов в реальном времени
```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f --tail=100
```

### Проверка свободного места на диске
```bash
df -h /
```

### Резервная копия базы данных PostgreSQL
```bash
./scripts/backup-vps.sh
```
*(Или вручную через `docker compose exec postgres pg_dump -U mangal mangal > backup.sql`)*

### Резервная копия пользовательских загрузок (uploads)
```bash
tar -czvf uploads-backup.tar.gz -C apps/platform/uploads .
```

### Восстановление работы после перезагрузки VPS
Все сервисы настроены с политикой `restart: always`. После перезагрузки VPS Docker автоматически поднимет все контейнеры. Если требуется ручной запуск:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres platform storefront
```

---

## 19. КРУПНОЕ ПРЕДУПРЕЖДЕНИЕ ПО БЕЗОПАСНОСТИ ДАННЫХ

> 🛑 **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ВЫПОЛНЯТЬ СЛЕДУЮЩИЕ КОМАНДЫ:**
>
> 1. `docker compose down -v` — флаг `-v` **удаляет все тома Docker (volumes)**, включая базу данных PostgreSQL и сохраненные картинки!
> 2. `docker volume prune` — может безвозвратно удалить тома с вашими данными.
> 3. **Удаление тома `mangal-site_pgdata`** — приведет к полной и невозвратной потере всей базы данных (товары, категории, заказы, настройки).
> 4. **Удаление тома `mangal-site_uploadsdata`** — приведет к невозвратной потере всех загруженных медиа-файлов, логотипов и баннеров.
> 5. **Остановка контейнеров Amnezia VPN** — заблокирует работу VPN-сервера на сервере.

---

## 20. Краткая шпаргалка (Cheat Sheet)

- **Витрина (Storefront)**: `http://IP_СЕРВЕРА` или `https://ваш-домен.ru`
- **Панель администратора**: `http://localhost:8080/admin/login` (через SSH-туннель)
- **Команда для SSH-туннеля**: `ssh -N -L 8080:127.0.0.1:80 root@IP_СЕРВЕРА`
- **Проверка статуса сервисов**: `docker compose --env-file .env.production -f docker-compose.production.yml ps`
- **Просмотр логов**: `docker compose --env-file .env.production -f docker-compose.production.yml logs -f`
