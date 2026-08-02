---
name: vercel-demo-deployment
description: Prepare and verify a public Vercel demonstration of the restaurant product. Use for preview deployment, serverless PostgreSQL, Vercel Blob, environment configuration, safe demo reset, or a non-PII/non-payment ordering showcase.
---

# Vercel Demo Deployment

1. Keep `DEMO_MODE=true` explicit and fail closed if its safety configuration is incomplete.
2. Display “Демонстрационная версия” and “Не вводите реальные персональные данные”. Set `noindex` for unofficial client demos.
3. Never persist submitted phone, email, address, IP, or comment. Store only generated fictional demo-order data.
4. Never call a real payment provider, webhook, notification provider, or production PII service in demo mode.
5. Use a serverless-compatible PostgreSQL pool and `STORAGE_DRIVER=vercel-blob`; never store Base64 images in PostgreSQL.
6. Protect reset with a separate secret, rate limiting, POST, exact Origin, and idempotency.
7. Run migrations and demo seed as explicit deployment jobs, not during `next build`.
8. Verify preview URL, catalog, cart, demo order, admin restrictions, storage, and a database assertion proving realistic submitted PII was not stored.

If Vercel authorization is missing, prepare code and exact commands, then ask the user to sign in. Never claim deployment succeeded without the URL and checks.
