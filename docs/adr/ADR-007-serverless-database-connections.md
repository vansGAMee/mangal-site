# ADR-007: Serverless database connections

Status: accepted.

Prisma 7 uses `@prisma/adapter-pg` and an explicit bounded pool. Production launch requires `pool max × total process instances <= connection budget`. Container concurrency and instance caps are operator inputs. Connection and statement timeouts are finite; shutdown disconnects cleanly. A managed pooler may be introduced without changing domain code.
