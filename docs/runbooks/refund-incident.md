# Refund incident runbook

Do not change a paid order to CANCELED. Confirm the Refund record, original provider binding and full amount. Reconcile the refund state. A successful provider state is required for `REFUNDED/CANCELED`; ambiguous exhausted retries remain `REVIEW_REQUIRED`. Record any manual provider action as an allowlisted audit event without PII.
