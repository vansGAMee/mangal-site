import http from "node:http";
const target = process.env.HEALTH_TARGET ?? `http://127.0.0.1:${process.env.PORT ?? 8080}/api/internal/live`;
http.get(target,(response)=>process.exit(response.statusCode===200?0:1)).on("error",()=>process.exit(1));
