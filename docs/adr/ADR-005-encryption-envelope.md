# ADR-005: Encryption envelope

Status: accepted.

Every PII field is a separate AES-256-GCM JSON envelope with version, key ID, nonce, ciphertext and tag. Associated data is `entityId:fieldName:schemaVersion`. PII, phone lookup, session, CSRF and MFA keys are separate. Old key IDs remain decryptable during rotation; reads can enqueue interceptable lazy re-encryption work.
