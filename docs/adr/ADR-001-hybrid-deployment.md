# ADR-001: Hybrid deployment

Status: accepted.

Public catalog, SEO, legal pages and a PII-free cart run on Vercel. The browser sends checkout PII directly to Yandex Cloud in `ru-central1`; Yandex also hosts admin, jobs, PostgreSQL and secrets. The storefront image may instead run in Yandex without domain changes. This prevents Vercel handlers and logs from entering the personal-data path.
