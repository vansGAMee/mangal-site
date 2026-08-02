# «МАНГАЛ» — переиспользуемое приложение заказа еды

Проект разворачивается по схеме «одно заведение — один экземпляр». Это не мультитенантный SaaS и не конструктор произвольных сайтов: профиль ресторана, тема, меню, доставка, самовывоз и SEO меняются без редактирования React-компонентов, но база и секреты у каждого клиента отдельные.

## Архитектура

- `apps/storefront` — публичная Next.js-витрина без Prisma и без обработки персональных данных на сервере Vercel.
- `apps/platform` — checkout, заказы, платежи, админка, шифрование PII и фоновые задачи.
- `packages/contracts` — строгие публичные контракты.
- `prisma` — PostgreSQL-схема, миграции и безопасный seed фактического меню из 33 позиций.
- `scripts/create-client.ts` — создание отдельного экземпляра клиента и первого ADMIN.
- `scripts/import-menu.ts` — транзакционный CSV/JSON-импорт с dry-run и защитой от повторов.

Production-контур персональных данных размещается на сервере в России. Vercel используется только для storefront либо для отдельной обезличенной demo-ветки. Код и документация не являются юридическим заключением о соответствии 152-ФЗ.

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

Локальные адреса по умолчанию: storefront `http://localhost:3000`, platform/admin `http://localhost:3001`. В `.env` нужны локальные криптографические ключи и URL; production-ключи нельзя использовать для разработки.

Seed намеренно не создаёт выдуманные зоны, часы, налоговые параметры, routing или администратора. Пока оператор не ввёл реальные данные, production launch-check обязан блокировать запуск. Две позиции без цены — «Шашлык в лаваше» и «Люля в лаваше» — видны, но не заказываются.

## Создание сайта для клиента

Интерактивно:

```bash
npm run create-client
```

Из конфигурации без секрета в JSON:

```bash
export CLIENT_ADMIN_PASSWORD='уникальный-длинный-пароль'
npm run create-client -- --config ./clients/example.client.json
unset CLIENT_ADMIN_PASSWORD
```

Команда не перезаписывает существующий профиль или ADMIN без явного `--force`. TOTP URI и recovery-коды выводятся один раз. Подробности: [создание клиента](docs/CREATE_NEW_CLIENT.md) и [импорт меню](docs/IMPORT_MENU.md).

## Изображения

`STORAGE_DRIVER=local` сохраняет проверенные файлы в постоянный VPS volume. `STORAGE_DRIVER=vercel-blob` использует Vercel Blob. Оба адаптера проверяют allowlist MIME, сигнатуру и размер; внешний URL из menu import не принимается.

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm run test:migrations
npm run test:productization
npm run test:storefront-build
npm run test:integration
npm run test:e2e
npm run prisma:validate
npm run build
npm run launch-check
```

Sandbox-проверки ЮKassa и T-Bank выполняются только с выданными провайдерами credentials. Redirect покупателя не подтверждает оплату.

## Ветки развёртывания

- `production-russia-vps` — реальный контур клиента: Docker Compose, PostgreSQL, локальные изображения, HTTPS и резервные копии на российском VPS.
- `demo-vercel` — публичная обезличенная демонстрация с `DEMO_MODE=true`, внешней PostgreSQL и Vercel Blob.

Общий код продуктового слоя находится в commit `feat: productize restaurant ordering application`; обе deployment-ветки должны расходиться именно от него.

## Критическое действие владельца репозитория

В публичной истории ранее находился отслеживаемый `.env.txt` с заполненными значениями. Файл удалён из текущего дерева и игнорируется, но все когда-либо использованные значения необходимо отозвать и перевыпустить: PostgreSQL credentials, PII/HMAC/session/MFA/CSRF keys, internal tokens и bootstrap credentials. После ротации историю следует отдельно очистить согласованной процедурой и включить GitHub secret scanning.

Production checklist находится в [docs/operations/production-checklist.md](docs/operations/production-checklist.md). Архитектурный аудит — в [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md).
