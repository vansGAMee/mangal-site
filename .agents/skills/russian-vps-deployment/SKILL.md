---
name: russian-vps-deployment
description: Prepare the real-client restaurant application for an Ubuntu VPS in Russia. Use for Docker Compose, PostgreSQL, Caddy HTTPS, persistent uploads, migrations, health checks, backups, restores, updates, or operational handoff.
---

# Russian VPS Deployment

1. Expose only ports 80/443 through Caddy. Keep PostgreSQL and application ports on private Docker networks.
2. Run application containers as non-root with restart policies, health checks, resource/concurrency limits, and bounded JSON logs.
3. Persist PostgreSQL and local image storage in separate named volumes. Validate upload paths stay inside the configured media root.
4. Keep secrets only in an ignored production env file with restrictive filesystem permissions.
5. Run `prisma migrate deploy` as a controlled one-shot job; never seed or `db push` automatically on production startup.
6. Implement daily compressed `pg_dump`, seven-copy retention, restore into a separate test database, and documented RPO/RTO.
7. Provide deploy, update, backup, restore, and health scripts that stop on errors and never echo secrets.
8. Verify liveness, readiness, storefront, admin, uploads, persistence across restart, backup, and restore before handoff.

Russian hosting supports the data-location architecture but does not by itself prove legal compliance. Keep a separate legal checklist.
