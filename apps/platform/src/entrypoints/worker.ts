import "dotenv/config";
import { hostname } from "node:os";
import { startJobRole } from "./job-server";
import { processOutboxBatch } from "../server/outbox/worker";
startJobRole("worker", () => processOutboxBatch(`${hostname()}:${process.pid}`));
