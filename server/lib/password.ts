import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Passwords are hashed with scrypt (built into Node, no native add-on). The stored
// form carries its own parameters, so they can be raised later without breaking
// existing logins: "scrypt$N$r$p$salt$hash" (salt and hash in base64).

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize('NFKC'), salt, KEY_LEN, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** The rule shown on every password field. */
export const PASSWORD_MIN = 10;
