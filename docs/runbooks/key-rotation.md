# Key rotation runbook

Add a new 32-byte key under a new key ID, keep old keys readable, and switch `activeKeyId`. Validate readiness, then enqueue bounded lazy re-encryption batches. Associated data and field schema version cannot change silently. Remove an old key only after proving no envelopes reference it and after a restore drill. Rotate session, lookup and MFA keys with their independent procedures.
