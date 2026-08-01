import EmbeddedPostgres from 'embedded-postgres';

async function main() {
  const pg = new EmbeddedPostgres({
    port: 5432,
    databaseDir: './.pgdata',
    user: 'postgres',
    password: 'postgres',
    initialDatabase: 'postgres',
  });

  console.log('Starting Embedded Postgres on port 5432...');
  await pg.initialise();
  await pg.start();
  console.log('Postgres started successfully!');

  // Create mangal_dev and mangal_dev_shadow databases if they don't exist
  const client = pg.getPgClient();
  await client.connect();

  const res1 = await client.query("SELECT 1 FROM pg_database WHERE datname = 'mangal_dev'");
  if (res1.rowCount === 0) {
    await client.query("CREATE DATABASE mangal_dev;");
    console.log("Created database mangal_dev");
  }

  const res2 = await client.query("SELECT 1 FROM pg_database WHERE datname = 'mangal_dev_shadow'");
  if (res2.rowCount === 0) {
    await client.query("CREATE DATABASE mangal_dev_shadow;");
    console.log("Created database mangal_dev_shadow");
  }

  await client.end();
  console.log('Embedded PostgreSQL is ready and running!');
}

main().catch(err => {
  console.error('Failed to start Embedded Postgres:', err);
  process.exit(1);
});
