---
name: safe-refactor-existing-app
description: Refactor this existing restaurant application with minimal, reviewable patches. Use for bug fixes, productization, security corrections, or architecture changes that must preserve storefront, cart, checkout, admin, database, and user work.
---

# Safe Refactor Existing App

1. Confirm clean Git state or identify and preserve user-owned changes.
2. State the behavior being preserved and the smallest files that need modification.
3. Prefer additive schemas, adapters, and configuration over whole-module rewrites.
4. Never delete working functionality without a failing test or concrete security/domain reason.
5. Keep secrets, PII, local databases, generated build state, and credentials out of Git and logs.
6. Add or update tests before declaring behavior fixed.
7. Run focused tests after each patch, then lint, typecheck, complete tests, schema validation, and both builds.
8. Inspect `git diff --check`, `git diff --stat`, and the full relevant diff before committing.
9. Make one clear commit per major stage and report commands exactly as executed.

Do not use destructive Git or database commands without an explicit, verified target and recovery plan.
