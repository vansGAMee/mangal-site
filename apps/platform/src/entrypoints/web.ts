import "dotenv/config";
import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "start", "-p", process.env.PORT ?? "8080"], { cwd: new URL("../..", import.meta.url), stdio: "inherit", env: process.env });
for (const signal of ["SIGINT","SIGTERM"] as const) process.on(signal,()=>child.kill(signal));
child.on("exit",(code)=>{process.exitCode=code??1});
