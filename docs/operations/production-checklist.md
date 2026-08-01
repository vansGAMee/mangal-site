# Production checklist

Technical gate (all must pass):

- `npm ci`, lint, strict typecheck, unit/integration/contract tests, Playwright and axe;
- Prisma validate, clean migration test and Next builds;
- Lighthouse targets, container image scan and dependency review;
- YooKassa CARD/SBP sandbox payment and full-refund smoke tests;
- T-Bank CARD/SBP sandbox payment and full-refund smoke tests;
- webhook replay/mismatch/timeout/reconciliation smoke tests;
- backup restore drill with operator-confirmed RPO/RTO.

Organisational gate (the application cannot complete these automatically): RKN notification, legal-basis review, local acts and responsible person, processor contracts, approved legal texts and hashes, business identity, tax/fiscal parameters, every menu value, unpriced products, zones and operating hours.
