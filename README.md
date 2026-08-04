# mangal-site — Готовое решение (конструктор) сайта для кафе и доставок еды

Продукт для запуска онлайн-витрины, меню и приема заказов для заведения общепита. Приложение разворачивается по схеме **Single-Tenant** (одна изолированная установка на отдельный VPS для одного заведения).

---

## 🚀 Основные возможности

- **Витрина (Storefront)**: Современный адаптивный интерфейс витрины на Next.js (React 19) с выбором категории, блюд, модификаторов, корзиной и оформлением заказа.
- **Панель управления (Admin)**: Полный контроль каталога, категорий, товаров, цен, фотографий, статусов заказов и параметров заведения.
- **Двухфакторная аутентификация (MFA/TOTP)**: Защита админки одноразовыми паролями (Google Authenticator / Яндекс Ключ).
- **Безопасность персональных данных**: Шифрование ПД (envelope encryption) и ХЭШ-поиск клиентов в базе данных.
- **Полная изоляция клиентов**: Каждое заведение разворачивается на отдельном VPS со своими секретами в `.env`.
- **Готовый Docker Compose & HTTPS**: Автоматический развертыватель с Caddy reverse proxy и бесплатными SSL-сертификатами Let's Encrypt.
- **Backup & Restore**: Встроенная система резервного копирования базы данных PostgreSQL с ротацией старых архивов.

---

## 🛠 Технологический стек

- **Frontend / Storefront**: Next.js 16 (Turbopack), React 19, Tailwind CSS, Motion / GSAP.
- **Backend / Platform**: Node.js 24 LTS, TypeScript 5.9, Next.js App Router, Zod.
- **Database & ORM**: PostgreSQL 17, Prisma ORM 7.
- **Infrastructure**: Docker, Docker Compose, Caddy 2, OpenSSL.

---

## 📁 Структура репозитория и документации

- [`LOCAL_WINDOWS.md`](LOCAL_WINDOWS.md) — Запуск демо на компьютере под управлением Windows в 1 клик (`START_DEMO.cmd`);
- [`LICENSE_TERMS.md`](LICENSE_TERMS.md) — Условия правообладания и коммерческого лицензирования;
- [`docs/BUYER_GUIDE.md`](docs/BUYER_GUIDE.md) — Руководство покупателя (архитектура, возможности);
- [`docs/VPS_DEPLOY.md`](docs/VPS_DEPLOY.md) — Развёртывание на Ubuntu VPS (Docker Compose, Caddy, SSL, HTTPS);
- [`docs/CONSTRUCTOR_GUIDE.md`](docs/CONSTRUCTOR_GUIDE.md) — Кастомизация бренда, цветов, товаров, категорий и цен;
- [`docs/CLIENT_INSTALLATION.md`](docs/CLIENT_INSTALLATION.md) — Инструкция по созданию и передаче сайта новому клиенту;
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) — Реестр технических особенностей и допущений;
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) — Результаты прохождения автоматических тестов и сценариев.

---

## ⚡️ Быстрый запуск

### 1. Локально на Windows (1 клик)
Запустите `START_DEMO.cmd` в корне проекта или выполните:
```bash
npm run demo:local
```

### 2. Создание администратора
```bash
npm run admin:create
```

### 3. Развёртывание на VPS
```bash
./scripts/install-vps.sh
```

---

## 🔐 Лицензирование и авторские права

Все авторские права принадлежат владельцу репозитория. Передача прав или выдача коммерческой лицензии на использование данного кода оформляется отдельным договором. Подробности в [`LICENSE_TERMS.md`](LICENSE_TERMS.md).
