# Отчёт исходного аудита

Дата: 2 августа 2026 года. Исходный commit: `95a90d98edce6a4ba95698995c5e7ef80c652410`.

## Git и источник

Workspace первоначально указывал на устаревший `voxelpy/mangal-site`. Репозиторий пользователя `vansGAMee/mangal-site` оказался fast-forward продолжением истории. Локальный `master` безопасно переведён на пользовательский commit, старый remote сохранён как `legacy-origin`, старый commit — как `legacy-voxelpy-master`. Tag `before-productization` указывает на правильный пользовательский snapshot.

## Baseline-команды

| Проверка | Исходный результат |
| --- | --- |
| `npm ci` | Успешно; 682 packages. `npm audit`: 4 moderate, 5 high, 1 critical. |
| `npm run prisma:validate` | Успешно. |
| `npm run lint` | Неуспешно: 16 errors, 7 warnings. |
| `npm run typecheck` | Неуспешно: `verify-vps-readiness.ts:70`, `string \| undefined`. |
| `npm test` | 24 passed, 1 skipped. |
| platform build | Неуспешно из-за той же TypeScript-ошибки. |
| storefront build | Успешно. |

DB integration был пропущен: тест не применяет миграцию к чистой PostgreSQL без отдельного `TEST_DATABASE_URL`.

## P0 — немедленно

### Опубликованные секреты

`.env.txt` отслеживается с initial commit и содержит непустые DB URLs, PII/session/HMAC/MFA/CSRF keys, internal tokens и bootstrap credentials. Значения не выводились и не использовались для подключения.

Все реально использованные значения следует считать скомпрометированными. Требуются ротация DB-пароля и всех ключей, проверка access logs и удаление файла из Git history. Обычный новый commit удаляет файл из текущей версии, но не из истории.

### Публичные destructive endpoints

- `GET /api/admin/catalog/migrate-images` не проверяет admin session и изменяет Blob/БД.
- `GET /api/admin/catalog/reset-images` импортирует auth-функцию, но не вызывает её и сбрасывает изображения.

Оба маршрута должны быть удалены или заменены защищёнными POST jobs с CSRF, ролью, audit и idempotency.

### Опасный readiness script

`verify-vps-readiness.ts` создаёт предсказуемого manager, может подделать DB session с fallback keys, создаёт checkout, затрагивает payment path и переписывает изображение. Его нельзя запускать на существующей или production-БД.

## P1 — высокий риск

- Upload не проверяет размер, magic bytes, MIME, dimensions или filename; fallback сохраняет неограниченный Base64 в PostgreSQL.
- Seed выдумывает fiscal codes, tax system, delivery fee/zone, 24/7 hours и активный payment routing, затем перезаписывает operator data.
- `prisma db push --accept-data-loss` включён как штатная команда platform.
- Storefront fallback содержит выдуманный город/зону/товары и несовместимые с API ID.
- Pickup маскируется как доставка на `Маркс / Самовывоз / 1`, поэтому сохраняются ложные адресные данные и возможна неверная fee.
- Безопасного `DEMO_MODE` нет; Vercel demo может собирать реальные ПД или пытаться вызвать эквайер.
- Internal Bearer endpoints принимают `Bearer undefined`, когда token не настроен.
- Platform CSP снова содержит `script-src 'unsafe-inline'`.
- Из Prisma pool убран statement timeout.
- Login/checkout используют необработанный `console.error(error)` вместо redacted logger.
- `PaymentAttempt.externalPaymentId` не защищён DB uniqueness на provider.
- Delivery capacity и routing re-auth имеют race windows.

## Productization gaps

- Название, телефон, SEO, Open Graph, favicon, тема, footer и часть public catalog захардкожены.
- Нет полного singleton restaurant profile.
- Нет `npm run create-client`, CSV/JSON importer и overwrite guard.
- Нет трёх общих тем.
- Нет local/Vercel storage interface.
- Admin не предоставляет полный CRUD новых категорий/товаров и не управляет всем профилем заведения.
- Нет безопасного demo seed/reset и PII non-persistence test.
- Нет production Compose/Caddy/backup/restore.

## Подтверждённые сильные стороны

- Серверный пересчёт цены и проверка modifiers/unit/availability.
- Idempotent checkout ID и immutable order/fiscal snapshots.
- AES-256-GCM PII envelopes и HMAC lookup.
- Разделённые payment/fulfillment state machines.
- Транзакция не удерживается во время HTTP к эквайеру.
- Transactional outbox, reconciliation и asynchronous refunds.
- Проверка current provider state для webhook; constant-time T-Bank Token.
- Argon2id, hashed sessions, Strict cookies, TOTP, CSRF, RBAC и audit.

## Ограничения аудита

Не выполнялись реальные checkout/payment, destructive readiness, seed или миграции против опубликованной БД. Browser E2E и admin login требуют отдельной disposable database и безопасных credentials.
