import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "phone", "email", "address", "comment", "ip", "*.phone", "*.email", "*.address", "*.comment", "*.ciphertext", "*.authTag"],
    censor: "[REDACTED]",
  },
  base: null,
});

export type SafeLogContext = {
  requestId?: string;
  traceId?: string;
  orderPublicId?: string;
  orderId?: string;
  paymentAttemptId?: string;
  providerRequestId?: string;
  webhookFingerprint?: string;
  jobId?: string;
};
