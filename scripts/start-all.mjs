import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nativeLibDir = path.resolve(__dirname, '../node_modules/@embedded-postgres/linux-x64/native/lib');
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH ? `${nativeLibDir}:${process.env.LD_LIBRARY_PATH}` : nativeLibDir;

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

async function ensurePostgres() {
  const isOpen = await isPortOpen(5432);
  if (isOpen) {
    console.log('PostgreSQL is already running on port 5432.');
    return;
  }

  console.log('Starting Embedded PostgreSQL on port 5432...');
  const pg = new EmbeddedPostgres({
    port: 5432,
    databaseDir: './.pgdata',
    user: 'postgres',
    password: 'postgres',
    initialDatabase: 'postgres',
  });

  await pg.initialise();
  await pg.start();
  console.log('Embedded PostgreSQL started successfully!');
}

async function main() {
  await ensurePostgres();

  console.log('Starting Platform API on http://localhost:3001...');
  const platform = spawn('npm', ['run', 'dev:platform'], { stdio: 'inherit', shell: true });

  console.log('Starting Storefront Web on http://localhost:3000...');
  const storefront = spawn('npm', ['run', 'dev:storefront'], { stdio: 'inherit', shell: true });

  process.on('SIGINT', () => {
    platform.kill();
    storefront.kill();
    process.exit();
  });
}

main().catch(err => {
  console.error('Error starting services:', err);
  process.exit(1);
});
