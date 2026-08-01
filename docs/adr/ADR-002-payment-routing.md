# ADR-002: Payment routing

Status: accepted.

Customers see CARD and SBP. ADMIN maps each method to YOOKASSA or TBANK after password and TOTP re-authentication. A `PaymentAttempt` snapshots the provider forever; routing changes never migrate an existing attempt. MANAGER cannot change routing.
