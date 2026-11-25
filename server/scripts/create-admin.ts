import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config';
import { openDatabase } from '../db/database';
import { createAuthService } from '../modules/auth/auth.service';

// npm run create-admin -- --email name@company.com --name "Full Name"
// Asks for the password (or reads ADMIN_PASSWORD). Run on the server to make the
// first admin; after that, admins add staff from the Team page.

try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = values.email ?? (await rl.question('Email: '));
const name = values.name ?? (await rl.question('Full name: '));
const password = process.env.ADMIN_PASSWORD || (await rl.question('Password (at least 10 characters): '));
rl.close();

const config = loadConfig(process.env);
const db = openDatabase(path.join(config.dataDir, 'studio.db'));
try {
  const user = await createAuthService(db, { idleHours: config.sessionIdleHours }).createUser({ name, email, password, role: 'admin' });
  console.log(`Admin created: ${user.name} <${user.email}>`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  db.close();
}
