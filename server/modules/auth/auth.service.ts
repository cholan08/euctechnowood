import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Role, User } from '@shared/workspace';
import { now, type Db } from '../../db/database';
import { AppError } from '../../lib/errors';
import { hashPassword, PASSWORD_MIN, verifyPassword } from '../../lib/password';

// Staff sign-in. A session is a random token in an HTTP-only cookie; the database
// stores only its sha256, so a leaked backup cannot be used to sign in. Sessions
// end after `idleHours` without a request, or at sign-out, or when an admin
// deactivates the account or resets its password.

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  daily_limit: number | null;
  active: number;
  created_at: string;
  last_login_at: string | null;
}

export const toUser = (r: Pick<UserRow, 'id' | 'name' | 'email' | 'role'>): User => ({ id: r.id, name: r.name, email: r.email, role: r.role });

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// A hash to compare against when the email is unknown, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;

export interface AuthService {
  /** Checks the email and password; returns the user and a new session token. */
  login(email: string, password: string): Promise<{ user: User; token: string }>;
  /** The signed-in user for a cookie token, or null. Extends the session while it is in use. */
  lookup(token: string): (User & { dailyLimit: number | null }) | null;
  logout(token: string): void;
  changePassword(userId: string, current: string, next: string): Promise<void>;
  /** Creates a user (admin tools and the first-admin bootstrap). Email must be unused. */
  createUser(input: { name: string; email: string; role: Role; password: string; dailyLimit?: number | null }): Promise<User>;
  /** Ends every session of a user (password reset, deactivation). */
  endSessions(userId: string): void;
  readonly idleMs: number;
}

export function checkNewPassword(password: string) {
  if (password.length < PASSWORD_MIN) throw new AppError(400, `Use at least ${PASSWORD_MIN} characters for the password.`);
}

export function createAuthService(db: Db, { idleHours }: { idleHours: number }): AuthService {
  const idleMs = idleHours * 60 * 60 * 1000;
  // Writing the new expiry on every request is wasteful; once a minute is plenty.
  const SLIDE_AFTER_MS = 60_000;

  function startSession(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    const at = Date.now();
    db.run('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', hashToken(token), userId, new Date(at).toISOString(), new Date(at + idleMs).toISOString());
    // Old, expired sessions are tidied up here rather than by a timer.
    db.run('DELETE FROM sessions WHERE expires_at < ?', new Date(at).toISOString());
    return token;
  }

  return {
    idleMs,

    async login(email, password) {
      const row = db.get<UserRow>('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase());
      dummyHash ??= hashPassword('not-a-real-password');
      const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
      if (!row || !ok) throw new AppError(401, 'That email and password do not match.');
      if (!row.active) throw new AppError(403, 'This account has been turned off. Ask an admin to turn it back on.');
      db.run('UPDATE users SET last_login_at = ? WHERE id = ?', now(), row.id);
      return { user: toUser(row), token: startSession(row.id) };
    },

    lookup(token) {
      if (!token) return null;
      const id = hashToken(token);
      const row = db.get<UserRow & { expires_at: string }>(
        'SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?',
        id,
      );
      if (!row) return null;
      const expires = Date.parse(row.expires_at);
      if (expires < Date.now() || !row.active) {
        db.run('DELETE FROM sessions WHERE id_hash = ?', id);
        return null;
      }
      if (Date.now() + idleMs - expires > SLIDE_AFTER_MS) db.run('UPDATE sessions SET expires_at = ? WHERE id_hash = ?', new Date(Date.now() + idleMs).toISOString(), id);
      return { ...toUser(row), dailyLimit: row.daily_limit };
    },

    logout(token) {
      if (token) db.run('DELETE FROM sessions WHERE id_hash = ?', hashToken(token));
    },

    async changePassword(userId, current, next) {
      const row = db.get<UserRow>('SELECT * FROM users WHERE id = ?', userId);
      if (!row || !(await verifyPassword(current, row.password_hash))) throw new AppError(400, 'Your current password is not right.');
      checkNewPassword(next);
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(next), userId);
    },

    async createUser({ name, email, role, password, dailyLimit = null }) {
      checkNewPassword(password);
      const clean = email.trim().toLowerCase();
      if (db.get('SELECT id FROM users WHERE email = ?', clean)) throw new AppError(409, 'Someone already has an account with that email.');
      const id = randomUUID();
      db.run(
        'INSERT INTO users (id, name, email, password_hash, role, daily_limit, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
        id,
        name.trim(),
        clean,
        await hashPassword(password),
        role,
        dailyLimit,
        now(),
      );
      return { id, name: name.trim(), email: clean, role };
    },

    endSessions(userId) {
      db.run('DELETE FROM sessions WHERE user_id = ?', userId);
    },
  };
}

/** Makes the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the studio has no users yet. */
export async function bootstrapAdmin(db: Db, auth: AuthService, admin: { email: string; password: string; name: string } | null): Promise<boolean> {
  if (!admin) return false;
  const { n } = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!;
  if (n > 0) return false;
  await auth.createUser({ ...admin, role: 'admin' });
  return true;
}

export const newId = () => randomUUID();
