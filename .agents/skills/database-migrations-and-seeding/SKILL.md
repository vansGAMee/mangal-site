---
name: database-migrations-and-seeding
description: Safely evolve and initialize the PostgreSQL/Prisma database. Use for schema migrations, repeatable demo bootstrap, client creation, CSV/JSON menu imports, administrator setup, backups, restores, or clean-database verification.
---

# Database Migrations and Seeding

1. Fail fast when the database URL is absent; never silently fall back for migrate, seed, backup, or restore.
2. Use expand–migrate–contract changes and SQL constraints for money, quantities, modifier ranges, unique provider IDs, and idempotency.
3. Test migrations against a new disposable PostgreSQL database and an upgraded representative database.
4. Separate schema migrations, empty-database bootstrap, demo reset, and client menu import.
5. Make production seed non-destructive. Never overwrite operator-edited catalog, fiscal, delivery, legal, routing, or media data.
6. Validate CSV/JSON with row/path errors, stable import hashes, dry-run, transaction boundaries, and explicit replace confirmation.
7. Hash administrator passwords and never store real people, addresses, phones, passwords, or tokens in examples.
8. Require a verified backup before destructive replacement and test restore into a separate database.

Do not use `db push --accept-data-loss` as a deployment migration strategy.
