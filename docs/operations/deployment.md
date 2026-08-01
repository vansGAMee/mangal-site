# Deployment

## Yandex Cloud

Build the platform image from `Dockerfile`, push an immutable digest to Container Registry, and create four Serverless Container revisions with APP_ROLE `web`, `worker`, `reconciliation`, and `retention`. Put all secrets in Lockbox. Timer Triggers call the protected `/run` endpoint for job roles. Place PostgreSQL and backups in `ru-central1`; cap instance concurrency according to the approved connection budget.

Run `prisma migrate deploy` as a controlled pre-deploy job. Run the production launch-check after migrations and operator data, before routing customer traffic. Readiness does not call acquiring APIs.

## Vercel

Set the root to the monorepo and use `deploy/vercel/vercel.json`. `PLATFORM_API_URL` is server-only; `NEXT_PUBLIC_PLATFORM_API_URL` points directly to the Yandex API. Configure the exact storefront Origin in Yandex. Confirm that no `/api/checkout` route exists in storefront.
