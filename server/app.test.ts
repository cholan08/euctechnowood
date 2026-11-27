import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProviderError } from './lib/errors';
import { createMockImageProvider } from './providers/mock';
import type { ImageEditProvider } from './providers/types';
import { JPEG, PASSWORD, startTestApp, type TestApp } from './testing/harness';

// The whole HTTP app with the mock provider, an in-memory database and image store.

const editBody = { image: JPEG, width: 1200, height: 800, roomType: 'kitchen', part: 'base-cabinets', finish: { material: 'laminate', shade: 'sage' }, area: { x: 0.1, y: 0.5, w: 0.5, h: 0.3 } };

describe('studio API with the mock provider', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp({ env: { IMAGES_PER_HOUR: '20', DAILY_IMAGE_LIMIT: '6' } });
  });
  afterAll(() => t.close());

  it('answers the health check without signing in, with security headers', async () => {
    const r = await t.client().get('/health');
    expect(r.json).toEqual({ ok: true, provider: 'mock' });
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    // Never cached and no ETag, so the browser can never be handed an empty 304.
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('etag')).toBeNull();
  });

  it('refuses the studio to anyone not signed in', async () => {
    const r = await t.client().post('/edit', editBody);
    expect(r.status).toBe(401);
    expect(r.json.error).toBe('Please sign in.');
  });

  it('makes a Mark & edit change and returns the image and prompt', async () => {
    const c = await t.as('designer');
    const { status, json } = await c.post('/edit', editBody);
    expect(status).toBe(200);
    expect(json.image).toBe(JPEG);
    expect(json.prompt).toContain('to sage green (#9AA98F) laminate');
  });

  it('removes an object in the marked area', async () => {
    const c = await t.as('designer');
    const { status, json } = await c.post('/edit', { ...editBody, part: undefined, finish: undefined, action: 'remove', text: 'the bottles' });
    expect(status).toBe(200);
    expect(json.prompt).toMatch(/^Edit this photo of a kitchen\. Remove the bottles in the/);
    expect(json.prompt).toContain('Do not put anything new in its place.');
  });

  it('refuses a bad request with a readable message, without using the allowance', async () => {
    const c = await t.as('designer');
    const { status, json } = await c.post('/edit', { ...editBody, area: undefined });
    expect(status).toBe(400);
    expect(json.error).toBe('Mark the part on the photo first.');
  });

  it('answers 400 to invalid JSON and 404 to unknown API routes', async () => {
    const bad = await fetch(`${t.base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Bad request.' });
    expect((await t.client().get('/nothing-here')).status).toBe(404);
  });

  it('answers AI help and furniture ideas with built-in suggestions in mock mode', async () => {
    const c = await t.as('designer');
    const help = await c.post('/assist', { kind: 'change', roomType: 'kitchen', text: 'shoba' });
    expect(help.json.suggestions).toHaveLength(3);
    const ideas = await c.post('/recommend', { roomType: 'living', style: 'luxury' });
    expect(ideas.json.provider).toBe('mock');
    expect(ideas.json.items[0]).toEqual({ name: 'Three-seater sofa', note: '' });
  });

  it('generates concepts for an empty room, keeping its architecture', async () => {
    const c = await t.as('other');
    const r = await c.post('/generate', {
      image: JPEG,
      width: 1200,
      height: 800,
      roomType: 'living',
      style: 'modern',
      concepts: [{ palette: 'graphite-oak', elements: { walls: { material: 'emulsion', shade: 'sage' } } }, { palette: 'white-walnut', elements: {} }],
      furniture: ['Three-seater sofa', 'Coffee table'],
      brief: 'space for a swing',
      mood: '',
    });
    expect(r.status).toBe(200);
    expect(r.json.concepts.map((v: { label: string }) => v.label)).toEqual(['Concept 1 · Graphite & oak', 'Concept 2 · White & walnut']);
    const prompt: string = r.json.concepts[0].prompt;
    expect(prompt).toContain('Do not add, move, resize or remove any wall, window or door.');
    expect(prompt).toContain('Wall paint: sage green (#9AA98F) emulsion paint');
    expect(prompt).toContain('three-seater sofa and coffee table');
    expect(prompt).toContain("Designer's brief: space for a swing.");
  });

  it('keeps viewers away from the AI', async () => {
    const c = await t.as('viewer');
    expect((await c.post('/edit', editBody)).status).toBe(403);
    expect((await c.post('/assist', { kind: 'change', roomType: 'kitchen', text: 'x' })).status).toBe(403);
  });

  it('stops at the daily image limit and says how many are left', async () => {
    // The designer has used 2 of 6 today (edit + remove above).
    const c = await t.as('designer');
    const me = await c.get('/auth/me');
    expect(me.json).toMatchObject({ dailyLimit: 6, imagesLeft: 4 });
    const four = await c.post('/redesign', {
      image: JPEG,
      width: 1200,
      height: 800,
      roomType: 'kitchen',
      source: 'photo',
      variants: ['sage', 'navy', 'teal', 'ivory'].map((shade) => ({ elements: { 'base-cabinets': { material: 'laminate', shade } } })),
    });
    expect(four.status).toBe(200);
    expect(four.json.variations.map((v: { label: string }) => v.label)).toEqual(['Option A', 'Option B', 'Option C', 'Option D']);
    const refused = await c.post('/final', { image: JPEG, width: 1200, height: 800, roomType: 'kitchen' });
    expect(refused.status).toBe(429);
    expect(refused.json.error).toMatch(/used all your images for today/);
  });

  it('logs every call for the admin usage page', async () => {
    const admin = await t.as('admin');
    const u = await admin.get('/usage');
    expect(u.status).toBe(200);
    expect(u.json.totals.images).toBe(8); // 2 edits + 4 options + 2 concepts
    expect(u.json.people.find((p: { name: string }) => p.name === 'Dev Designer').images).toBe(6);
    expect((await (await t.as('designer')).get('/usage')).status).toBe(403);
  });
});

describe('AI failures', () => {
  const failing = (err: Error): ImageEditProvider => ({ name: 'failing', imageRef: (i) => `<IMAGE_${i}>`, edit: () => Promise.reject(err) });

  it('explains a refusal in plain words, and does not count it', async () => {
    const t = await startTestApp({ providers: { image: failing(new ProviderError('xAI 400: content moderation', 400, true)), text: null } });
    const c = await t.as('designer');
    const { status, json } = await c.post('/edit', editBody);
    expect(status).toBe(502);
    expect(json.error).toBe('The AI service declined this image. Try a different photo.');
    expect((await c.get('/auth/me')).json.imagesLeft).toBe(80);
    await t.close();
  });

  it('hides provider details in production', async () => {
    const t = await startTestApp({ providers: { image: failing(new Error('secret upstream detail')), text: null }, env: { NODE_ENV: 'production' } });
    const c = await t.as('designer');
    const { json } = await c.post('/final', { image: JPEG, width: 1200, height: 800, roomType: 'kitchen' });
    expect(json.error).toBe('The final image could not be made. Please try again.');
    await t.close();
  });
});

describe('sign-in and team access', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp({ providers: { image: createMockImageProvider(() => 0), text: null } });
  });
  afterAll(() => t.close());

  it('signs in with an HTTP-only, SameSite cookie and signs out', async () => {
    const c = t.client();
    const bad = await c.post('/auth/login', { email: 'dev@test.in', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.json.error).toBe('That email and password do not match.');

    const raw = await fetch(`${t.base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'DEV@test.in ', password: PASSWORD }) });
    const cookie = raw.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^rs_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    c.setCookie(cookie.split(';')[0]);
    expect((await c.get('/auth/me')).json.user).toEqual({ id: t.users.designer.id, name: 'Dev Designer', email: 'dev@test.in', role: 'designer' });

    await c.post('/auth/logout');
    c.setCookie(cookie.split(';')[0]); // the old cookie no longer works
    expect((await c.get('/auth/me')).status).toBe(401);
  });

  it('stores only a hash of the session token', async () => {
    const raw = await fetch(`${t.base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'oviya@test.in', password: PASSWORD }) });
    const token = decodeURIComponent(raw.headers.get('set-cookie')!.split(';')[0].split('=')[1]);
    expect(t.db.get('SELECT 1 AS x FROM sessions WHERE id_hash = ?', token)).toBeUndefined();
    expect(t.db.all('SELECT id_hash FROM sessions').every((r) => /^[0-9a-f]{64}$/.test(String(r.id_hash)))).toBe(true);
  });

  it('lets admins add staff, change roles, reset passwords and turn accounts off', async () => {
    const admin = await t.as('admin');
    const made = await admin.post('/team', { name: 'New Person', email: 'new@test.in', role: 'designer', password: 'short' });
    expect(made.status).toBe(400);
    expect(made.json.error).toMatch(/at least 10 characters/);

    const ok = await admin.post('/team', { name: 'New Person', email: 'new@test.in', role: 'designer', password: PASSWORD, dailyLimit: 25 });
    expect(ok.status).toBe(201);
    expect(ok.json).toMatchObject({ name: 'New Person', role: 'designer', active: true, dailyLimit: 25, usedToday: 0 });
    expect((await admin.post('/team', { name: 'Again', email: 'new@test.in', role: 'viewer', password: PASSWORD })).status).toBe(409);

    const person = t.client();
    await person.post('/auth/login', { email: 'new@test.in', password: PASSWORD });
    expect((await person.get('/auth/me')).json.dailyLimit).toBe(25);

    const off = await admin.patch(`/team/${ok.json.id}`, { active: false });
    expect(off.json.active).toBe(false);
    expect((await person.get('/auth/me')).status).toBe(401); // signed out everywhere
    expect((await person.post('/auth/login', { email: 'new@test.in', password: PASSWORD })).status).toBe(403);
  });

  it('never lets the studio lose its last admin', async () => {
    const admin = await t.as('admin');
    const r = await admin.patch(`/team/${t.users.admin.id}`, { role: 'designer' });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/only admin/);
  });

  it('keeps the team page for admins', async () => {
    const designer = await t.as('designer');
    expect((await designer.get('/team')).status).toBe(403);
    expect((await designer.post('/team', { name: 'x', email: 'x@test.in', role: 'admin', password: PASSWORD })).status).toBe(403);
    const dir = await designer.get('/team/directory');
    expect(dir.json.map((u: { name: string }) => u.name)).toContain('Asha Admin');
    expect(dir.json[0]).not.toHaveProperty('password_hash');
  });

  it('lets people change their own password', async () => {
    const c = await t.as('viewer');
    expect((await c.post('/auth/password', { current: 'nope', next: 'another-long-password' })).status).toBe(400);
    expect((await c.post('/auth/password', { current: PASSWORD, next: 'another-long-password' })).status).toBe(200);
    expect((await t.client().post('/auth/login', { email: 'vijay@test.in', password: 'another-long-password' })).status).toBe(200);
  });
});

describe('clients, projects, rooms, image history and saved designs', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp();
  });
  afterAll(() => t.close());

  async function setup() {
    const dev = await t.as('designer');
    const client = (await dev.post('/clients', { name: 'Mr. Raman', phone: '98400 00000' })).json;
    const project = (await dev.post('/projects', { clientId: client.id, name: 'Anna Nagar flat' })).json;
    const room = (await dev.post(`/projects/${project.id}/rooms`, { name: 'Kitchen', roomType: 'kitchen', image: JPEG, width: 1200, height: 800 })).json;
    return { dev, client, project, room };
  }

  it('creates a client, a project owned by its creator and a room with its original photo', async () => {
    const { dev, client, project, room } = await setup();
    expect(client).toMatchObject({ name: 'Mr. Raman', phone: '98400 00000', projectCount: 0 });
    expect(project).toMatchObject({ name: 'Anna Nagar flat', status: 'active', clientName: 'Mr. Raman', ownerName: 'Dev Designer', canEdit: true });
    expect(room).toMatchObject({ name: 'Kitchen', roomType: 'kitchen', imageCount: 1 });

    const photo = await dev.raw(`/images/${room.originalImageId}`);
    expect(photo.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await photo.arrayBuffer()).subarray(0, 2).toString('hex')).toBe('ffd8');
    expect((await dev.get(`/clients/${client.id}`)).json.projects).toHaveLength(1);
  });

  it('refuses a file that is not really an image', async () => {
    const { dev, project } = await setup();
    const r = await dev.post(`/projects/${project.id}/rooms`, { name: 'Bad', roomType: 'kitchen', image: 'data:image/png;base64,AAAA', width: 10, height: 10 });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('That file is not a readable JPG, PNG or WebP image.');
  });

  it('keeps every studio result in the room history and saves chosen designs', async () => {
    const { dev, room } = await setup();
    const edit = await dev.post(`/rooms/${room.id}/images`, { image: JPEG, width: 1200, height: 800, kind: 'edit', parentId: room.originalImageId, label: 'Base cabinets', detail: 'Sage green · Laminate', meta: { prompt: 'p' } });
    expect(edit.status).toBe(201);
    expect(edit.json).toMatchObject({ kind: 'edit', label: 'Base cabinets', parentId: room.originalImageId, createdBy: 'Dev Designer', meta: { prompt: 'p' } });

    const design = await dev.post(`/rooms/${room.id}/designs`, { imageId: edit.json.id, name: 'Option for client' });
    expect(design.status).toBe(201);
    const detail = (await dev.get(`/rooms/${room.id}`)).json;
    expect(detail.images.map((i: { kind: string }) => i.kind)).toEqual(['original', 'edit']);
    expect(detail.designs[0]).toMatchObject({ name: 'Option for client', image: { id: edit.json.id } });
    expect(detail.room.coverImageId).toBe(edit.json.id);

    // The original cannot be deleted; a result can, and its file goes too.
    expect((await dev.del(`/images/${room.originalImageId}`)).status).toBe(400);
    const before = t.images.size();
    expect((await dev.del(`/images/${edit.json.id}`)).status).toBe(200);
    expect(t.images.size()).toBe(before - 1);
    expect((await dev.get(`/rooms/${room.id}`)).json.designs).toEqual([]);
  });

  it('lets other staff view a project but only the owner, members with edit access and admins change it', async () => {
    const { project, room } = await setup();
    const other = await t.as('other');
    const viewer = await t.as('viewer');
    const admin = await t.as('admin');

    expect((await other.get(`/projects/${project.id}`)).json.canEdit).toBe(false);
    expect((await other.post(`/rooms/${room.id}/images`, { image: JPEG, width: 10, height: 10, kind: 'edit' })).status).toBe(403);
    expect((await other.raw(`/images/${room.originalImageId}`)).status).toBe(200);

    // Only the owner (or an admin) decides the team.
    expect((await other.put(`/projects/${project.id}/members`, { members: [{ userId: t.users.other.id, access: 'edit' }] })).status).toBe(403);
    const dev = await t.as('designer');
    const team = await dev.put(`/projects/${project.id}/members`, {
      members: [
        { userId: t.users.other.id, access: 'edit' },
        { userId: t.users.viewer.id, access: 'edit' },
      ],
    });
    expect(team.json.members).toEqual([
      { userId: t.users.other.id, name: 'Oviya Other', access: 'edit' },
      { userId: t.users.viewer.id, name: 'Vijay Viewer', access: 'view' }, // a viewer account can only view
    ]);
    expect((await other.post(`/rooms/${room.id}/images`, { image: JPEG, width: 10, height: 10, kind: 'edit' })).status).toBe(201);
    expect((await viewer.patch(`/projects/${project.id}`, { status: 'presented' })).status).toBe(403);
    expect((await viewer.post('/clients', { name: 'X' })).status).toBe(403);
    expect((await admin.patch(`/projects/${project.id}`, { status: 'presented' })).json.status).toBe('presented');
  });

  it('lists and searches projects, and "mine" shows owned and shared ones', async () => {
    const dev = await t.as('designer');
    const all = (await dev.get('/projects?q=anna')).json;
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toMatchObject({ name: 'Anna Nagar flat', clientName: 'Mr. Raman', roomCount: 1 });
    const other = await t.as('other');
    const mine = (await other.get('/projects?mine=1')).json;
    expect(mine.every((p: { name: string }) => p.name === 'Anna Nagar flat')).toBe(true);
  });

  it('sorts projects and reports headline stats', async () => {
    const dev = await t.as('designer');
    const names = (await dev.get('/projects?sort=name')).json.map((p: { name: string }) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
    expect((await dev.get('/projects?sort=bogus')).status).toBe(200);
    const s = (await dev.get('/projects/stats')).json;
    expect(s.open).toBe(s.byStatus.active + s.byStatus.presented + s.byStatus.approved);
    expect(s.rooms).toBeGreaterThan(0);
    expect(s.mine).toBeGreaterThan(0);
    expect(s.followUp).toBe(0);
    expect((await dev.get('/projects?status=followup')).json).toEqual([]);
  });

  it('lists room names, designed rooms and team on each project, and searches room names', async () => {
    const dev = await t.as('designer');
    const [p] = (await dev.get('/projects?q=kitchen')).json;
    expect(p).toMatchObject({ name: 'Anna Nagar flat', roomNames: ['Kitchen'] });
    expect(p.designedRoomCount).toBeLessThanOrEqual(p.roomCount);
    expect(Array.isArray(p.memberNames)).toBe(true);
  });

  it('deleting a project deletes its rooms, history and files; only admins delete clients', async () => {
    const { dev, client, project } = await setup();
    const files = t.images.size();
    expect((await (await t.as('other')).del(`/projects/${project.id}`)).status).toBe(403);
    expect((await dev.del(`/projects/${project.id}`)).status).toBe(200);
    expect(t.images.size()).toBe(files - 1);
    expect((await dev.get(`/projects/${project.id}`)).status).toBe(404);
    expect((await dev.del(`/clients/${client.id}`)).status).toBe(403);
    expect((await (await t.as('admin')).del(`/clients/${client.id}`)).status).toBe(200);
  });
});

describe('password guessing', () => {
  it('locks sign-in for a while after 10 failed attempts', async () => {
    const t = await startTestApp();
    const c = t.client();
    for (let i = 0; i < 10; i++) expect((await c.post('/auth/login', { email: 'dev@test.in', password: `guess-${i}` })).status).toBe(401);
    const locked = await c.post('/auth/login', { email: 'dev@test.in', password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.json.error).toMatch(/Too many failed sign-in attempts/);
    await t.close();
  });
});
