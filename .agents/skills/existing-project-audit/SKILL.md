---
name: existing-project-audit
description: Audit an existing restaurant ordering repository before any refactor. Use when inheriting the project, comparing local and remote state, locating architecture, database, environment, checkout, admin, uploads, deployment, hard-coded tenant data, or baseline failures.
---

# Existing Project Audit

1. Run `git status`, current branch, HEAD, tags, remotes, and upstream checks. Stop before edits if the requested repository differs from the workspace.
2. Find all `AGENTS.md`, lockfiles, workspace manifests, runtime versions, schemas, migrations, seeds, env examples, Docker and deployment files.
3. Map storefront, checkout, orders, admin auth/RBAC, catalog mutations, image uploads, payments, jobs, health endpoints, and storage.
4. Search for brand names, contacts, colors, cities, fiscal values, credentials, demo fallbacks, destructive scripts, and unauthenticated mutations.
5. Inspect environment files by key and empty/non-empty state only. Never print secret values.
6. Install dependencies and run the repository's lint, typecheck, tests, schema validation, and builds. Record pre-existing failures verbatim.
7. Verify runtime flows only against a disposable/local database. Never run seed, readiness, payment, or reset scripts against an unknown database.
8. Write `docs/CURRENT_ARCHITECTURE.md`, `docs/AUDIT_REPORT.md`, and `docs/IMPLEMENTATION_PLAN.md`. Separate verified facts, risks, and items requiring credentials or browser access.

Do not edit application code during the initial audit.
