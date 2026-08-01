import "dotenv/config";
import { startJobRole } from "./job-server";
import { runReconciliationBatch } from "../server/payments/jobs/reconciliation";
startJobRole("reconciliation", () => runReconciliationBatch());
