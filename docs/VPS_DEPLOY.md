# Развёртывание на Ubuntu VPS (VPS_DEPLOY)

Данный документ содержит пошаговую инструкцию по установке и эксплуатации рабочей версии **mangal-site** на виртуальном сервере (VPS) в российском контуре.

---

## 1. Требования к серверу

- **ОС**: Ubuntu 22.04 LTS / 24.04 LTS;
- **Процессор**: 2 vCPU;
- **Оперативная память**: 2 ГБ RAM (минимум);
- **Диск**: 20 ГБ SSD;
- **ПО**: Docker Engine 24+ & Docker Compose v2+.

---

## 2. Настройка DNS

До того как запускать инсталляцию, привяжите домен заведения (например, `mycafe.ru`) к IP-адресу вашего VPS в панели управления DNS (создайте A-запись):

```
@   A   <IP_АДРЕС_ВАШЕГО_VPS>
www A   <IP_АДРЕС_ВАШЕГО_VPS>
```

---

## 3. Автоматическая установка одной командой

Подключитесь к VPS по SSH и выполните:

```bash
git clone https://github.com/vansGAMee/mangal-site.git
cd mangal-site
git checkout production-russia-vps

# Запуск мастера генерации .env и установки
./scripts/install-vps.sh
```

Скрипт `install-vps.sh`:
1. Запустит интерактивную генерацию файла `.env` (запросит домен, email админа и имя заведения);
2. Сгенерирует случайные 32-байтовые ключи шифрования ПД, HMAC и пароль к PostgreSQL;
3. Создаст постоянные Docker volumes (`pgdata`, `uploadsdata`, `caddy_data`);
4. Скомпилирует и запустит контейнеры PostgreSQL, Platform API, Storefront и Caddy Reverse Proxy;
5. Выполнит миграцию базы данных `prisma migrate deploy`.

---

## 4. Создание первого администратора

Для безопасности пароли администратора не сохраняются в файлах исходного кода. Чтобы создать учетную запись администратора, выполните на сервере:

```bash
docker compose exec -it platform npm run admin:create
```

Введите email и создайте надежный пароль (от 14 символов). Отсканируйте выведенный TOTP QR-код / URI в приложении-аутентификаторе (Google Authenticator / Яндекс Ключ).

---

## 5. Обслуживание и мониторинг

### Просмотр логов
```bash
# Логи всех сервисов
docker compose logs -f

# Логи платформы API
docker compose logs -f platform
```

### Перезапуск сервисов
```bash
docker compose restart
```

### Остановка
```bash
docker compose down
```

---

## 6. Резервное копирование и восстановление (Backup & Restore)

### Создание резервной копии базы данных
```bash
docker compose exec platform npm run db:backup
```
Архив сохраняется в папку `./backups/`. Автоматически сохраняются 10 последних архивов, старые удаляются.

### Восстановление из резервной копии
```bash
docker compose exec platform npm run db:restore -- --file ./backups/mangal-YYYY-MM-DD.dump --confirm mangal
```
