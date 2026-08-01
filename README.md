# МАНГАЛ — delivery commerce

Production-oriented npm-workspaces monorepo with a public Next.js storefront and a physically separate Yandex Cloud platform for checkout, PII, payments, admin and jobs.

## Local start

1. Install Node.js 24 LTS and Docker.
2. Copy `.env.example` to `.env`. Fill local cryptographic keys and URLs; do not reuse local keys in production.
3. Start PostgreSQL: `docker compose up -d postgres`.
4. Install and initialize: `npm ci`, `npm run prisma:generate`, `npm run prisma:migrate:deploy`, `npm run prisma:seed`.
5. Start `npm run dev:platform` and `npm run dev:storefront` in separate terminals.
6. Bootstrap the first administrator once with `npm run admin:bootstrap`; securely capture the printed MFA URI and recovery codes, then erase bootstrap variables.

The initial catalog intentionally cannot accept a real order until delivery zones, operating hours, fiscal values, active payment routes and provider credentials are supplied. This is a launch guard, not a demo fallback.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run prisma:validate`, `npm run build`, `npm run launch-check`.

See [production checklist](docs/operations/production-checklist.md) and [deployment](docs/operations/deployment.md).
