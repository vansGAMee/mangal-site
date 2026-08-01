import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export function startJobRole(role: string, handler: () => Promise<unknown>): void {
  let running = false;
  const execute = async () => { if (running) return { skipped: "already_running" }; running = true; try { return await handler(); } finally { running = false; } };
  if (process.env.JOB_EXECUTION_MODE === "loop") {
    const interval = Number(process.env.JOB_INTERVAL_MS ?? 30_000);
    const loop = async () => { await execute(); setTimeout(loop, interval).unref(); };
    void loop();
  }
  const server = createServer(async (request,response) => {
    if (request.url === "/live") { response.writeHead(200,{"Content-Type":"application/json"}); response.end(JSON.stringify({live:true,role})); return; }
    if (request.method !== "POST" || request.url !== "/run" || request.headers.authorization !== `Bearer ${process.env.INTERNAL_JOBS_TOKEN}`) { response.writeHead(401); response.end(); return; }
    const jobId = randomUUID();
    try { const result = await execute(); response.writeHead(200,{"Content-Type":"application/json","X-Job-Id":jobId}); response.end(JSON.stringify({jobId,result})); }
    catch { response.writeHead(500,{"Content-Type":"application/json","X-Job-Id":jobId}); response.end(JSON.stringify({jobId,error:"job_failed"})); }
  });
  server.listen(Number(process.env.PORT ?? 8080));
  const shutdown = () => server.close(() => process.exit(0)); process.on("SIGTERM",shutdown); process.on("SIGINT",shutdown);
}
