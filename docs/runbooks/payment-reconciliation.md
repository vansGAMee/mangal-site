# Payment reconciliation runbook

Inspect only safe attempt, provider request, webhook fingerprint and order IDs. Never copy provider bodies or PII into tickets. Check UNKNOWN age, outbox lease/dead-letter state and authenticated provider state. Re-run the idempotent reconciliation role. Amount, RUB currency, provider, external ID and internal order ID must all match before state application. Escalate persistent conflicts without manually marking an order paid.
