import { spawn } from "node:child_process";

const role = process.env.APP_ROLE ?? "web";
const commands = {
  web: ["node", ["node_modules/next/dist/bin/next", "start", "apps/platform", "-p", process.env.PORT ?? "8080"]],
  worker: ["node", ["--import", "tsx", "apps/platform/src/entrypoints/worker.ts"]],
  reconciliation: ["node", ["--import", "tsx", "apps/platform/src/entrypoints/reconciliation.ts"]],
  retention: ["node", ["--import", "tsx", "apps/platform/src/entrypoints/retention.ts"]],
};
if (!(role in commands)) throw new Error(`Unsupported APP_ROLE: ${role}`);
const [command,args] = commands[role];
const child = spawn(command,args,{stdio:"inherit",env:process.env});
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>child.kill(signal));
child.on("exit",(code)=>{process.exitCode=code??1});
