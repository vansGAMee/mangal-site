# ADR-009: Asynchronous refund workflow

Status: accepted.

A paid order cannot be directly canceled. An authorized administrator with `REFUND_ORDER` supplies a reason; the transaction creates Refund and outbox records and moves the order to `CANCEL_REQUESTED/REFUND_PENDING`. A worker uses the attempt’s original provider. Only verified success produces `CANCELED/REFUNDED`; exhausted ambiguity becomes `REVIEW_REQUIRED`.
