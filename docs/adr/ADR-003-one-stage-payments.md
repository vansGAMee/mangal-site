# ADR-003: One-stage payments

Status: accepted.

Version 1 uses one-stage payment (`capture=true` at YooKassa and `PayType=O` at T-Bank). A paid cancellation is a separate asynchronous full refund. Two-stage authorization and capture are deliberately outside scope until operating procedures explicitly require them.
