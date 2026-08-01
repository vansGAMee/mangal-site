import "dotenv/config";
import { startJobRole } from "./job-server";
import { runRetentionBatch } from "../server/jobs/retention";
startJobRole("retention", () => runRetentionBatch());
