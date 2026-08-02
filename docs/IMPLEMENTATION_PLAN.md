# План продуктализации

## 0. Стабилизация и incident containment

1. Удалить `.env.txt` из текущего Git tree и запретить `.env*.txt`.
2. Закрыть public mutation routes и удалить небезопасный readiness script.
3. Убрать invented seed/fallback/pickup behavior и `db push --accept-data-loss`.
4. Исправить baseline lint/typecheck/build и оценить npm advisories без `--force`.
5. Перед deployment потребовать ротацию опубликованных credentials и отдельное решение по очистке Git history.

## 1. Общая продуктовая часть

1. Расширить singleton profile: brand, slug, description, media, theme, contacts, address, social links, hours, fulfillment, currency/timezone, SEO и legal links.
2. Сделать profile единственным источником storefront/admin metadata и public catalog.
3. Добавить темы `mangal-dark`, `cafe-light`, `sushi-minimal` через один набор CSS variables.
4. Расширить admin settings и сохранить audit/optimistic locking.
5. Добавить безопасный `MediaAsset` и storage interface.

## 2. Создание клиента и импорт

1. Реализовать `npm run create-client` в interactive и `--config` режимах.
2. Пароль читать скрыто, хешировать Argon2id и никогда не записывать в client JSON/seed/log.
3. Реализовать CSV/JSON importer с Zod, row errors, dry-run, stable hash, transaction и overwrite flag.
4. Добавить examples и русскую документацию.
5. Разделить non-destructive bootstrap, demo reset и production migrations.

## 3. Storage

1. `local-volume-storage` для VPS.
2. `vercel-blob-storage` для demo.
3. Проверять allowlisted MIME и magic bytes, размер, dimensions, safe object key и SHA-256.
4. Сначала сохранить новый объект и DB-ссылку, затем удалить старый; при ошибке сохранить старое изображение.
5. Покрыть adapters unit/contract tests.

## 4. Общий commit и ветки

1. После общей реализации создать commit `feat: productize restaurant ordering application` на `production-russia-vps`.
2. Добавить VPS-слой отдельным commit.
3. Создать `demo-vercel` от общего productization commit, а не от VPS commit.
4. Не merge-ить demo safety shortcuts в production.

## 5. `production-russia-vps`

- Production Compose: app/web/workers, private PostgreSQL, Caddy, named DB/media volumes.
- Наружу только 80/443; non-root containers, health, resource/concurrency/log limits.
- Controlled migrations, daily compressed backup, seven-copy retention, restore drill.
- Российская документация deploy/update/backup/restore/security/legal checklist.

## 6. `demo-vercel`

- Serverless PostgreSQL и Vercel Blob.
- `DEMO_MODE=true`: noindex banner, PII non-persistence, fake order/payment/notification boundaries, restricted admin.
- Protected demo reset and deterministic seed.
- Automated test proving realistic submitted PII was not stored.
- Preview deployment only after user signs in; never request credentials.

## 7. Verification

- Unit: config/themes/import/storage/cart/pricing/demo sanitization.
- Integration: clean PostgreSQL migrate/bootstrap/repeat/import/idempotency/admin/order.
- E2E: catalog → two products → quantity → checkout → DB → admin → status.
- Browser: mobile, 200% zoom, keyboard, reduced motion, axe, cookies/network.
- Both branches: lint, typecheck, tests, Prisma validate, build, security scan.

## 8. Sales gate

К поиску 30 лидов переходить только после реально работающего demo URL и успешного browser handoff. Исследование использует публичные официальные страницы и ничего не отправляет. Десять лучших сообщений показываются пользователю; каждое отправление требует отдельного подтверждения.
