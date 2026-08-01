# ADR-006: Checkout and payment saga

Status: accepted.

The order, payment attempt and outbox event commit in one database transaction. Provider HTTP starts only after commit. Known rejection becomes FAILED; an ambiguous result becomes UNKNOWN and is reconciled. No database transaction spans a provider request and no critical work runs in an unobserved promise after an HTTP response.
