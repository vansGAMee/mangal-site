import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "mangal_" });

export const checkoutResults = new Counter({ name: "mangal_checkout_results_total", help: "Checkout results by code", labelNames: ["result"] as const, registers: [metricsRegistry] });
export const providerLatency = new Histogram({ name: "mangal_payment_provider_duration_seconds", help: "Provider request latency", labelNames: ["provider", "operation"] as const, buckets: [.1, .25, .5, 1, 2, 5, 10], registers: [metricsRegistry] });
export const providerFailures = new Counter({ name: "mangal_payment_provider_failures_total", help: "Provider failures", labelNames: ["provider", "operation", "code"] as const, registers: [metricsRegistry] });
export const webhookVerificationFailures = new Counter({ name: "mangal_webhook_verification_failures_total", help: "Rejected provider callbacks", labelNames: ["provider"] as const, registers: [metricsRegistry] });
export const catalogChanged = new Counter({ name: "mangal_catalog_changed_total", help: "Catalog changed checkout conflicts", registers: [metricsRegistry] });
export const unknownAttempts = new Gauge({ name: "mangal_payment_unknown_attempts", help: "Payment attempts in UNKNOWN", registers: [metricsRegistry] });
export const outboxBacklog = new Gauge({ name: "mangal_outbox_backlog", help: "Pending outbox events", registers: [metricsRegistry] });
export const reconciliationBacklog = new Gauge({ name: "mangal_reconciliation_backlog", help: "Pending reconciliation tasks", registers: [metricsRegistry] });
export const refundBacklog = new Gauge({ name: "mangal_refund_backlog", help: "Refunds awaiting a final state", registers: [metricsRegistry] });
