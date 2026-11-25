import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase, type Db } from '../db/database';
import { createMockImageProvider } from '../providers/mock';
import type { Providers } from '../providers/types';
import { createMemoryImageStore } from '../storage/imageStore';

// The whole HTTP app on a random port, with an in-memory database and image
// store, three staff accounts and a fetch helper that keeps each one's cookie.

export const PASSWORD = 'correct-horse-battery';

/** A real 1×1 JPEG, so stored images pass the file-type check. */
export const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

export interface Reply {
  status: number;
  json: any;
  headers: Headers;
}

export interface Client {
  get(path: string): Promise<Reply>;
  post(path: string, body?: unknown): Promise<Reply>;
  patch(path: string, body: unknown): Promise<Reply>;
  put(path: string, body: unknown): Promise<Reply>;
  del(path: string): Promise<Reply>;
  raw(path: string): Promise<Response>;
}

export async function startTestApp(opts: { providers?: Providers; env?: Record<string, string> } = {}) {
  const config = { ...loadConfig({ IMAGE_PROVIDER: 'mock', ...opts.env }), distDir: '/nonexistent' };
  const db: Db = openDatabase(':memory:');
  const images = createMemoryImageStore();
  const app = createApp({ config, providers: opts.providers ?? { image: createMockImageProvider(() => 0), text: null }, db, images });
  const server: Server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;

  const users = {
    admin: await app.auth.createUser({ name: 'Asha Admin', email: 'admin@test.in', role: 'admin', password: PASSWORD }),
    designer: await app.auth.createUser({ name: 'Dev Designer', email: 'dev@test.in', role: 'designer', password: PASSWORD }),
    other: await app.auth.createUser({ name: 'Oviya Other', email: 'oviya@test.in', role: 'designer', password: PASSWORD }),
    viewer: await app.auth.createUser({ name: 'Vijay Viewer', email: 'vijay@test.in', role: 'viewer', password: PASSWORD }),
  };

  function client(cookie = ''): Client & { setCookie(c: string): void } {
    let jar = cookie;
    const call = async (method: string, path: string, body?: unknown): Promise<Reply> => {
      const r = await fetch(base + path, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(jar ? { cookie: jar } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const set = r.headers.get('set-cookie');
      if (set) jar = set.split(';')[0];
      return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
    };
    return {
      get: (p) => call('GET', p),
      post: (p, b) => call('POST', p, b ?? {}),
      patch: (p, b) => call('PATCH', p, b),
      put: (p, b) => call('PUT', p, b),
      del: (p) => call('DELETE', p),
      raw: (p) => fetch(base + p, { headers: jar ? { cookie: jar } : {} }),
      setCookie: (c) => (jar = c),
    };
  }

  /** A client signed in as one of the test accounts. */
  async function as(who: keyof typeof users) {
    const c = client();
    const r = await c.post('/auth/login', { email: users[who].email, password: PASSWORD });
    if (r.status !== 200) throw new Error(`login failed for ${who}: ${JSON.stringify(r.json)}`);
    return c;
  }

  return { server, base, db, images, users, client, as, close: () => new Promise<void>((r) => server.close(() => r())) };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;
