import path from 'node:path';
import { createApp } from './app';
import { ConfigError, loadConfig, type Config } from './config';
import { openDatabase } from './db/database';
import { bootstrapAdmin } from './modules/auth/auth.service';
import { createProviders } from './providers';
import { createDiskImageStore } from './storage/imageStore';

// Entry point: read .env, check the settings, open the database and image store,
// build the AI providers, make the first admin if needed, start listening.

try {
  process.loadEnvFile(); // reads .env if present
} catch {
  // No .env file: use the real environment.
}

let config: Config;
try {
  config = loadConfig(process.env);
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const db = openDatabase(path.join(config.dataDir, 'studio.db'));
const images = createDiskImageStore(path.join(config.dataDir, 'images'));
const app = createApp({ config, providers: createProviders(config), db, images });

if (await bootstrapAdmin(db, app.auth, config.bootstrapAdmin)) {
  console.log(`Created the first admin account: ${config.bootstrapAdmin!.email}`);
} else if (!db.get('SELECT id FROM users LIMIT 1')) {
  console.warn('No staff accounts yet. Run `npm run create-admin`, or set ADMIN_EMAIL and ADMIN_PASSWORD and restart.');
}

const server = app.listen(config.port, () => {
  console.log(`EUC Dream Studios on http://localhost:${config.port} · data in ${config.dataDir}`);
});

// Render and Docker stop the app with SIGTERM: finish the requests in flight first.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    // An AI call can take two minutes; don't wait longer than the platform does.
    setTimeout(() => process.exit(0), 25_000).unref();
  });
}
