export function GET(): Response { return Response.json({ live: true, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } }); }
