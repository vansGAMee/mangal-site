# Памятка по обслуживанию и эксплуатации (Operations)

Шпаргалка для технического специалиста по управлению production-сервером VPS.

---

## 1. Проверка статуса контейнеров

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```
Все 4 сервиса (`postgres`, `platform`, `storefront`, `caddy`) должны находиться в статусе `Up` (`healthy`).

---

## 2. Просмотр логов

### Логи всех сервисов (последние 200 строк):
```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200
```

### Логи конкретного сервиса в реальном времени:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f platform
docker compose --env-file .env.production -f docker-compose.production.yml logs -f storefront
docker compose --env-file .env.production -f docker-compose.production.yml logs -f caddy
docker compose --env-file .env.production -f docker-compose.production.yml logs -f postgres
```

---

## 3. Перезапуск сервисов (Restart)

Перезапуск не затирает данные и не сбрасывает базу:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml restart
```

---

## 4. Пересборка контейнеров (Rebuild)

При обновлении кода приложения:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

---

## 5. Применение миграций базы данных

Выполняется после обновления кода, если в схеме появились новые поля:
```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec platform npx prisma migrate deploy
```

---

## 6. Резервное копирование и восстановление

### Создание резервной копии (База данных + Картинки):
```bash
./scripts/backup-vps.sh
```
Копия сохраняется в `./backups/` с меткой времени.

### Просмотр существующих копий:
```bash
ls -lh ./backups/
```

### Восстановление из бэкапа:
```bash
./scripts/restore-vps.sh ./backups/mangal-db-ГГГГММДД-ЧЧММСС.dump ./backups/mangal-uploads-ГГГГММДД-ЧЧММСС.tar.gz mangal
```

---

## 7. Проверка свободной памяти и диска

### Проверка места на диске:
```bash
df -h
docker system df
```

### Очистка старых неиспользуемых Docker-образов:
```bash
docker image prune -f
```

### Проверка оперативной памяти:
```bash
free -h
```

---

## 8. Проверка HTTPS и медиа-загрузок

```bash
# Проверка работы веб-сервера
curl -I https://ваш-домен.ru

# Проверка входа в админку
curl -I https://ваш-домен.ru/admin/login

# Проверка публичной доступности медиа-файла
curl -I https://ваш-домен.ru/uploads/restaurant-logo/файл.png
```

---

## 9. Безопасность и сброс паролей

### Смена пароля администратора / Перевыпуск MFA:
Запустите команду повторной инициализации администратора (потребуется флаг `--force`):
```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec platform npx tsx scripts/create-client.ts --config clients/example.client.json --force
```

### Безопасное завершение работы (Down без удаления данных):
```bash
docker compose --env-file .env.production -f docker-compose.production.yml down
```
⚠️ **Внимание**: Никогда не используйте флаг `-v` (`docker compose down -v`), так как он удалит объёмы с базой данных и загруженными картинками!
