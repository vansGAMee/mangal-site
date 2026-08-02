# Финальная передача технического этапа

Дата проверки: 2 августа 2026 года. Ветка проверки: `production-russia-vps`.

## Что готово

- Существующий monorepo сохранён: отдельные Next.js-приложения storefront и platform, PostgreSQL/Prisma, Zustand, GSAP/Motion, checkout, платежная saga, webhooks, reconciliation, возвраты и админка.
- Данные конкретного заведения вынесены в `RestaurantProfile`, `StoreSettings`, часы, зоны доставки и payment routing.
- Реализованы три конфигурируемые темы: `mangal-dark`, `cafe-light`, `sushi-minimal`.
- Реализованы настройки профиля, контактов, SEO, способов получения, часов, зон, routing и изображений в админке.
- Каталог поддерживает категории, фиксированные и килограммовые цены, неподтверждённые цены, старую цену, modifier groups/options/bindings и фискальные поля.
- Реализованы local-volume и Vercel Blob storage adapters с проверкой размера, MIME и сигнатуры файла.
- Созданы безопасная миграция productization и повторяемый production seed фактических 33 позиций. Seed не придумывает зоны, часы, эквайринг, налоговые параметры или ADMIN.
- `create-client` создаёт отдельный профиль, импортирует меню и создаёт ADMIN с Argon2id/TOTP без хранения пароля в файле.
- CSV/JSON import поддерживает quoted/multiline CSV, точные рубли→копейки, `--dry-run`, SHA-256 duplicate guard и `--update-existing`.
- Checkout повторно читает каталог из БД, пересчитывает цены, проверяет modifiers/availability/unit/delivery, создаёт immutable snapshots и шифрует PII.
- Заказы DELIVERY/PICKUP разделены без фиктивного адреса самовывоза.
- Платёжная инициализация, webhooks и reconciliation используют общий verified-state domain; redirect не подтверждает оплату.
- Admin sessions отзываются, ADMIN использует MFA, `REFUND_ORDER` выдаётся отдельно, routing/legal требуют одноразовый re-auth.
- Удалены исходные публичные destructive image endpoints и опасный production/VPS verifier.
- Storefront не подставляет выдуманный fallback-каталог и не пропускает PII через Vercel Route Handler.

## Результаты финальной проверки

Успешно выполнено:

```text
npm run lint                         PASS, 0 warnings
npm run typecheck                    PASS
npm test                             PASS, 38 passed / 1 skipped
npm run prisma:validate              PASS
npm run test:migrations              PASS, clean PostgreSQL + 2 migrations + seed twice
npm run test:productization          PASS, create-client + dry-run/import/duplicate guard
npm run build:platform               PASS, Next.js production build
npm run test:storefront-build        PASS, isolated catalog fixture + Next.js production build
```

Skipped `tests/integration/database-schema.test.ts` требует отдельно заданный `TEST_DATABASE_URL`; его основная проверка миграций покрыта более строгим disposable-PostgreSQL сценарием `test:migrations`.

## Локальный запуск

Требуются Node.js 24 LTS, npm 11 и Docker.

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev:platform
```

Во втором терминале:

```bash
npm run dev:storefront
```

Storefront: `http://localhost:3000`. Platform/admin: `http://localhost:3001`.

## Создание нового клиента

Интерактивно:

```bash
npm run create-client
```

Неинтерактивно, без пароля в JSON:

```bash
export CLIENT_ADMIN_PASSWORD='уникальный-длинный-пароль'
npm run create-client -- --config ./clients/example.client.json
unset CLIENT_ADMIN_PASSWORD
```

Перед командой нужны применённые миграции, отдельная клиентская БД и `MFA_ENCRYPTION_KEY` как base64 от 32 случайных байт. TOTP URI и recovery-коды выводятся один раз и должны храниться офлайн. Перезапись существующего профиля разрешается только явным `--force` после backup.

## Импорт меню

Проверка без записи:

```bash
npm run import-menu -- --file ./examples/menu-template.csv --dry-run
npm run import-menu -- --file ./examples/menu-template.json --dry-run
```

Применение:

```bash
npm run import-menu -- --file ./menu.csv
```

Обновление совпадающих slug допускается только явно:

```bash
npm run import-menu -- --file ./menu.csv --update-existing
```

Внешние image URL импорт не принимает. Изображения загружаются через админку в настроенный storage.

## Переменные окружения

Полный безопасный шаблон находится в `.env.example`; реальные значения не коммитятся.

Обязательные группы для production:

- Домены и Origin: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PLATFORM_API_URL`, `PLATFORM_API_URL`, `ADMIN_BASE_URL`, `ALLOWED_STOREFRONT_ORIGINS`, `TRUSTED_PROXY_POLICY`.
- Реквизиты: `BUSINESS_LEGAL_NAME`, `BUSINESS_INN`, `BUSINESS_REGISTRATION_NUMBER`, `BUSINESS_LEGAL_ADDRESS`, `BUSINESS_EMAIL`, `BUSINESS_PHONE`.
- PostgreSQL: `DATABASE_URL`, `DIRECT_URL`, pool/connection budget и количество процессов каждого APP_ROLE.
- Раздельные ключи: `PII_KEY_RING_JSON`, `PHONE_LOOKUP_HMAC_KEY`, `ADMIN_SESSION_HMAC_KEY`, `MFA_ENCRYPTION_KEY`, `CSRF_HMAC_KEY`, `INTERNAL_JOBS_TOKEN`, `STOREFRONT_REVALIDATE_SECRET`.
- Storage: `STORAGE_DRIVER`, затем либо `LOCAL_MEDIA_ROOT` + `MEDIA_PUBLIC_BASE_URL`, либо `BLOB_READ_WRITE_TOKEN`.
- Эквайринг: credentials ЮKassa/T-Bank, HTTP timeout и подтверждённые `CARD_PAYMENT_PROVIDER`/`SBP_PAYMENT_PROVIDER`.
- Фискализация: подтверждённые СНО, VAT, subject/mode/measure товаров и доставки; исторические значения фиксируются snapshots.
- Legal: legal basis, версии, утверждённые SHA-256 и `LEGAL_DOCS_APPROVED=true` только после юридической проверки.
- Организационные gates: РКН, legal review, локальные акты, ответственный, договоры обработчиков, налоги, доставка, меню и позиции без цены.
- Retention/backup: сроки хранения, `BACKUP_RPO_MINUTES`, `BACKUP_RTO_MINUTES`.
- Analytics: реальный numeric `NEXT_PUBLIC_YANDEX_METRIKA_ID`; без consent скрипт не загружается.

Зоны доставки и семь строк часов хранятся в PostgreSQL и вводятся через create-client/admin, а не дублируются фиктивным JSON в env.

## Что остаётся и блокирует production

- Не предоставлены юридическое наименование, ИНН, ОГРН/ОГРНИП, юридический адрес и email.
- Не подтверждены адрес/самовывоз, часы, delivery zones, fee, minimum order и бесплатная доставка.
- Не подтверждены СНО, VAT-коды и остальные fiscal attributes.
- Нет production-доменов, точного CORS allowlist, trusted proxy policy и Metrika ID.
- Нет production encryption/session/HMAC/MFA keys и connection budget/RPO/RTO.
- Legal templates имеют предупреждение о необходимости юридической проверки; утверждённых hashes нет.
- Нет credentials ЮKassa/T-Bank, поэтому sandbox CARD/SBP/refund smoke tests не выполнялись.
- «Шашлык в лаваше» и «Люля в лаваше» остаются заблокированы: цена отсутствует, `isOrderable=false`, нулевой цены нет.
- Vercel demo и production VPS deployment по последнему указанию не начинались; публичного demo URL нет.
- Playwright/browser, Lighthouse, axe в реальном запущенном окружении, container scan, payment sandbox и backup restore drill не выполнены.
- Поиск клиентов и VK outreach не начинались: он разрешён только после реального demo URL и проверки storefront/order/admin.

## Критическое действие владельца

В Git-истории до productization находился `.env.txt` с заполненными значениями. Удаление из текущего дерева не отзывает секреты. Все когда-либо использованные DB credentials, PII/HMAC/session/MFA/CSRF keys, internal tokens и bootstrap credentials нужно немедленно ротировать. Очистку опубликованной истории следует выполнять отдельно и согласованно, потому что она переписывает commit hashes для всех пользователей репозитория.

## Следующие шаги

1. Ротировать исторически опубликованные секреты и включить GitHub secret scanning/push protection.
2. Заполнить только реальные данные клиента и пройти `npm run launch-check`.
3. Отдельным этапом подготовить/проверить `production-russia-vps` deployment: HTTPS, private PostgreSQL, volumes, backup/restore и health checks.
4. От общего productization commit подготовить безопасную `demo-vercel` ветку с PII-free `DEMO_MODE` и demo reset.
5. Запустить browser E2E, accessibility/performance audit и provider sandbox smoke tests при наличии credentials.
6. Только после рабочего публичного URL перейти к исследованию потенциальных клиентов; сообщения VK не отправлять без отдельного подтверждения конкретного получателя и текста.

Полезные документы: `docs/CREATE_NEW_CLIENT.md`, `docs/IMPORT_MENU.md`, `docs/SECURITY_CHECKLIST.md`, `docs/operations/production-checklist.md`.
