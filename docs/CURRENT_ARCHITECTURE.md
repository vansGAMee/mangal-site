# Текущая архитектура

Состояние зафиксировано для `vansGAMee/mangal-site`, commit `95a90d98edce6a4ba95698995c5e7ef80c652410`, tag `before-productization`.

## Стек

- Node.js 24, npm workspaces.
- Next.js 16 App Router и React 19.
- TypeScript strict, Tailwind CSS 4, GSAP, Motion, Zustand.
- Prisma 7 с `@prisma/adapter-pg`, PostgreSQL.
- Vitest и Playwright.

## Приложения

### `apps/storefront`

Публичная SSR/RSC-витрина: главная, каталог, карточки, корзина, modifiers, checkout, публичный статус заказа, legal, metadata, Open Graph, manifest, robots и sitemap. Клиентская форма отправляет checkout непосредственно в URL platform API. В storefront нет Prisma и route handler создания заказа.

Текущая версия содержит светлый редизайн и локальные демонстрационные изображения. При недоступности platform API она подставляет встроенный каталог. Этот fallback годится только для просмотра, но его идентификаторы и delivery-данные несовместимы с реальным checkout.

### `apps/platform`

Контур checkout, заказов, PII, платежей, webhook, фоновых задач и admin UI. Основные домены находятся в `src/server`: catalog, checkout, crypto, health, jobs, observability, orders, outbox, payments, security и admin.

Платформа использует собственные Argon2id-сессии, TOTP, RBAC, CSRF, AES-256-GCM PII envelopes, transactional outbox, payment reconciliation и асинхронные возвраты.

### Общие packages

- `packages/contracts` — Zod-схемы и безопасные API-типы.
- `packages/catalog-seed` — текущее меню и hard-coded данные «МАНГАЛ».
- `packages/design-system` — общие форматтеры и SVG/UI-примитивы.
- `packages/tsconfig` — базовая strict-конфигурация TypeScript.

## Данные

Prisma schema содержит каталог, modifiers, singleton `StoreSettings`, delivery zones/hours, orders и immutable snapshots, legal consents/documents, payment attempts/operations/webhooks/reconciliation/refunds, outbox, admin users/sessions/TOTP/permissions/audit и health sentinel.

Существующие источники настроек дублируются:

- телефон: `StoreSettings`, catalog seed, contracts и hard-coded public API/UI;
- бренд и SEO: JSX/metadata;
- тема: CSS и компоненты;
- fiscal/delivery/routing: env, seed и БД;
- меню: catalog seed и редактируемая БД.

## Путь заказа

1. Storefront хранит в Zustand только идентификаторы, количество, unit и modifiers.
2. Браузер отправляет checkout напрямую platform API.
3. Platform проверяет Origin, размер, rate limit и Zod-схему.
4. Checkout заново читает каталог/настройки, пересчитывает цены и шифрует PII.
5. Транзакция создаёт Order, snapshots, LegalConsent, PaymentAttempt и OutboxEvent.
6. После commit запускается bounded provider initialization; неопределённый результат уходит в reconciliation.

## Администрирование

Admin размещён в platform-контуре. Реализованы login/logout, TOTP/recovery, роли ADMIN/MANAGER, permission `REFUND_ORDER`, каталог, modifiers, настройки, routing с re-auth, пользователи, заказы, возвраты и audit log.

Загрузка изображения сейчас использует Vercel Blob при наличии токена, иначе сохраняет Base64 data URL в PostgreSQL. Storage abstraction отсутствует.

## Deployment

- Vercel: текущие изменения пытаются собирать storefront и platform отдельными проектами, но platform на Vercel может принимать PII и не имеет runtime-запрета для реального checkout.
- Docker: один platform image поддерживает web/worker/reconciliation/retention; текущий compose ориентирован на разработку.
- Yandex: есть заготовка container-конфигурации, но не завершённый deployment workflow.
- Production VPS: отсутствуют Caddy/Nginx, закрытая DB-сеть, production Compose, persistent media adapter и проверенные backup/restore scripts.

## Целевая модель

Сохраняется простая схема «одно заведение — одна БД — одно развёртывание». Мультитенантный SaaS не требуется. Профиль заведения, темы, import/create-client и storage adapters должны быть общими; Vercel demo и российский VPS отличаются только безопасным mode/config/deployment слоем.
