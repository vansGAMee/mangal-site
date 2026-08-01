const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT * FROM \"AdminUser\"");
  console.log("AdminUser:", res.rows);
  const res2 = await client.query("SELECT * FROM \"AdminRecoveryCode\"");
  console.log("AdminRecoveryCode:", res2.rows);
  await client.end();
}
main().catch(console.error);
