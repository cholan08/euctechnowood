import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { RoomDetail } from '@shared/workspace';
import { now, type Db } from '../../db/database';
import { requireRole, requireUser, userOf } from '../../http/auth';
import { AppError, RequestError } from '../../lib/errors';
import { DATA_URL } from '../../lib/image';
import { parseBody, roomTypeField } from '../../lib/validation';
import type { ImageStore } from '../../storage/imageStore';
import {
  getClient,
  getImageRow,
  getProject,
  getRoom,
  listClients,
  listDesigns,
  listImages,
  listProjects,
  requireProject,
  requireRoom,
  toImage,
  touchProject,
} from './workspace.repo';

/** The :id in the path. */
const idOf = (req: Request) => String(req.params.id);

// Studio management over HTTP: clients, projects (with their team), rooms, each
// room's image history and its saved designs. Images are stored on the server
// (agreed with EUC, 25 Nov 2026) so the whole team can open a project.

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const requiredName = (what: string) => z.string({ error: `Enter the ${what}.` }).trim().min(1, `Enter the ${what}.`).max(120, `Keep the ${what} under 120 characters.`);

const clientSchema = z.object({
  name: requiredName("client's name"),
  phone: text(40).default(''),
  email: text(200).default(''),
  address: text(400).default(''),
  notes: text(2000).default(''),
});

const projectSchema = z.object({ clientId: z.string().uuid('Choose the client.'), name: requiredName('project name'), notes: text(2000).default('') });

const updateProjectSchema = z.object({
  name: requiredName('project name').optional(),
  status: z.enum(['active', 'presented', 'approved', 'archived']).optional(),
  notes: text(2000).optional(),
  ownerId: z.string().uuid().optional(),
});

const membersSchema = z.object({ members: z.array(z.object({ userId: z.string().uuid(), access: z.enum(['edit', 'view']) })).max(50) });

const dims = { width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192) };

// A Final 2K image is about 3–6 MB as base64; 16M characters leaves room and stops abuse.
const IMAGE_MAX_CHARS = 16_000_000;
const imageField = z.string({ error: 'Add the image.' }).max(IMAGE_MAX_CHARS, 'That image is too large to store.').regex(DATA_URL, 'Images must be JPG, PNG or WebP.');

const newRoomSchema = z.object({ name: requiredName('room name'), roomType: roomTypeField, image: imageField, ...dims });
const updateRoomSchema = z.object({ name: requiredName('room name').optional(), roomType: roomTypeField.optional() });

const saveImageSchema = z.object({
  image: imageField,
  ...dims,
  kind: z.enum(['edit', 'design', 'concept', 'final', 'board']),
  parentId: z.string().uuid().nullable().optional(),
  label: text(120).default(''),
  detail: text(400).default(''),
  meta: z.record(z.string(), z.unknown()).default({}),
});

const saveDesignSchema = z.object({ imageId: z.string().uuid(), name: requiredName('design name'), notes: text(1000).default('') });
const updateDesignSchema = z.object({ name: requiredName('design name').optional(), notes: text(1000).optional() });

/** Decodes a checked data URL and makes sure the bytes really are the image type it claims. */
function decodeImage(dataUrl: string): { mime: string; bytes: Buffer } {
  const [, mime, base64] = DATA_URL.exec(dataUrl)!;
  const bytes = Buffer.from(base64, 'base64');
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes.subarray(0, 4).toString('hex') === '89504e47';
  const isWebp = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const ok = (mime === 'image/jpeg' && isJpeg) || (mime === 'image/png' && isPng) || (mime === 'image/webp' && isWebp);
  if (!ok) throw new RequestError('That file is not a readable JPG, PNG or WebP image.');
  return { mime, bytes };
}

const META_MAX = 20_000;

interface Deps {
  db: Db;
  images: ImageStore;
}

export function workspaceRoutes({ db, images }: Deps): Router {
  const router = Router();
  const editors = requireRole('admin', 'designer');
  router.use(['/clients', '/projects', '/rooms', '/images', '/designs'], requireUser);

  /** Deletes stored files after their rows are gone. A missing file is not an error. */
  async function removeFiles(ids: string[]) {
    await Promise.all(ids.map((id) => images.remove(id).catch((err: unknown) => console.error(`[images] could not remove ${id}:`, err))));
  }

  async function storeImage(roomId: string, userId: string, input: { image: string; width: number; height: number; kind: string; parentId?: string | null; label?: string; detail?: string; meta?: Record<string, unknown> }) {
    const { mime, bytes } = decodeImage(input.image);
    const meta = JSON.stringify(input.meta ?? {});
    if (meta.length > META_MAX) throw new RequestError('Too much detail was sent with this image.');
    if (input.parentId) {
      const parent = db.get<{ room_id: string }>('SELECT room_id FROM images WHERE id = ?', input.parentId);
      if (parent?.room_id !== roomId) throw new RequestError('The image it was made from is not in this room.');
    }
    const id = randomUUID();
    await images.put(id, bytes);
    db.run(
      'INSERT INTO images (id, room_id, parent_id, kind, label, detail, mime, bytes, width, height, meta, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      roomId,
      input.parentId ?? null,
      input.kind,
      input.label ?? '',
      input.detail ?? '',
      mime,
      bytes.length,
      input.width,
      input.height,
      meta,
      userId,
      now(),
    );
    return id;
  }

  // ---------------------------------------------------------------- clients

  router.get('/clients', (req, res) => {
    res.json(listClients(db, String(req.query.q ?? '').slice(0, 80)));
  });

  router.post('/clients', editors, (req, res) => {
    const b = parseBody(clientSchema, req.body);
    const id = randomUUID();
    const at = now();
    db.run(
      'INSERT INTO clients (id, name, phone, email, address, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      b.name,
      b.phone,
      b.email,
      b.address,
      b.notes,
      userOf(req).id,
      at,
      at,
    );
    res.status(201).json(getClient(db, id));
  });

  router.get('/clients/:id', (req, res) => {
    res.json({ client: getClient(db, idOf(req)), projects: listProjects(db, { clientId: idOf(req) }) });
  });

  router.patch('/clients/:id', editors, (req, res) => {
    getClient(db, idOf(req));
    const b = parseBody(clientSchema.partial(), req.body);
    db.tx(() => {
      for (const [key, value] of Object.entries(b)) if (value !== undefined) db.run(`UPDATE clients SET ${key} = ? WHERE id = ?`, value, idOf(req));
      db.run('UPDATE clients SET updated_at = ? WHERE id = ?', now(), idOf(req));
    });
    res.json(getClient(db, idOf(req)));
  });

  // Deleting a client deletes all its projects, rooms and images: admins only.
  router.delete('/clients/:id', requireRole('admin'), async (req, res) => {
    getClient(db, idOf(req));
    const ids = db.all<{ id: string }>('SELECT i.id FROM images i JOIN rooms r ON r.id = i.room_id JOIN projects p ON p.id = r.project_id WHERE p.client_id = ?', idOf(req)).map((r) => r.id);
    db.run('DELETE FROM clients WHERE id = ?', idOf(req));
    await removeFiles(ids);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- projects

  router.get('/projects', (req, res) => {
    const q = (k: string) => (typeof req.query[k] === 'string' ? (req.query[k] as string).slice(0, 80) : undefined);
    res.json(listProjects(db, { clientId: q('clientId'), status: q('status'), q: q('q'), mine: q('mine') === '1' ? userOf(req).id : undefined }));
  });

  router.post('/projects', editors, (req, res) => {
    const b = parseBody(projectSchema, req.body);
    getClient(db, b.clientId);
    const id = randomUUID();
    const at = now();
    db.tx(() => {
      db.run('INSERT INTO projects (id, client_id, name, notes, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, b.clientId, b.name, b.notes, userOf(req).id, at, at);
      db.run('UPDATE clients SET updated_at = ? WHERE id = ?', at, b.clientId);
    });
    res.status(201).json(getProject(db, userOf(req), id));
  });

  router.get('/projects/:id', (req, res) => {
    res.json(getProject(db, userOf(req), idOf(req)));
  });

  router.patch('/projects/:id', (req, res) => {
    const user = userOf(req);
    requireProject(db, user, idOf(req), 'edit');
    const b = parseBody(updateProjectSchema, req.body);
    if (b.ownerId) {
      const owner = db.get<{ role: string; active: number }>('SELECT role, active FROM users WHERE id = ?', b.ownerId);
      if (!owner?.active || owner.role === 'viewer') throw new RequestError('The owner must be an active admin or designer.');
    }
    db.tx(() => {
      if (b.name !== undefined) db.run('UPDATE projects SET name = ? WHERE id = ?', b.name, idOf(req));
      if (b.status !== undefined) db.run('UPDATE projects SET status = ? WHERE id = ?', b.status, idOf(req));
      if (b.notes !== undefined) db.run('UPDATE projects SET notes = ? WHERE id = ?', b.notes, idOf(req));
      if (b.ownerId !== undefined) db.run('UPDATE projects SET owner_id = ? WHERE id = ?', b.ownerId, idOf(req));
      touchProject(db, idOf(req));
    });
    res.json(getProject(db, user, idOf(req)));
  });

  /** Replaces the project's team. Only its owner or an admin decides who works on it. */
  router.put('/projects/:id/members', (req, res) => {
    const user = userOf(req);
    const project = getProject(db, user, idOf(req));
    if (user.role !== 'admin' && project.ownerId !== user.id) throw new AppError(403, "Only the project's owner or an admin can change who works on it.");
    const { members } = parseBody(membersSchema, req.body);
    db.tx(() => {
      db.run('DELETE FROM project_members WHERE project_id = ?', idOf(req));
      for (const m of members) {
        if (m.userId === project.ownerId) continue;
        const u = db.get<{ role: string }>('SELECT role FROM users WHERE id = ? AND active = 1', m.userId);
        if (!u) throw new RequestError('One of those staff members was not found.');
        // A viewer account can only ever view, whatever the project says.
        db.run('INSERT INTO project_members (project_id, user_id, access) VALUES (?, ?, ?)', idOf(req), m.userId, u.role === 'viewer' ? 'view' : m.access);
      }
    });
    res.json(getProject(db, user, idOf(req)));
  });

  router.delete('/projects/:id', async (req, res) => {
    const user = userOf(req);
    const project = getProject(db, user, idOf(req));
    if (user.role !== 'admin' && project.ownerId !== user.id) throw new AppError(403, "Only the project's owner or an admin can delete it.");
    const ids = db.all<{ id: string }>('SELECT i.id FROM images i JOIN rooms r ON r.id = i.room_id WHERE r.project_id = ?', idOf(req)).map((r) => r.id);
    db.run('DELETE FROM projects WHERE id = ?', idOf(req));
    await removeFiles(ids);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- rooms

  router.post('/projects/:id/rooms', async (req, res) => {
    const user = userOf(req);
    requireProject(db, user, idOf(req), 'edit');
    const b = parseBody(newRoomSchema, req.body);
    const roomId = randomUUID();
    const at = now();
    db.run('INSERT INTO rooms (id, project_id, name, room_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', roomId, idOf(req), b.name, b.roomType, at, at);
    try {
      const imageId = await storeImage(roomId, user.id, { image: b.image, width: b.width, height: b.height, kind: 'original', label: 'Original photo' });
      db.run('UPDATE rooms SET original_image_id = ? WHERE id = ?', imageId, roomId);
    } catch (err) {
      db.run('DELETE FROM rooms WHERE id = ?', roomId);
      throw err;
    }
    touchProject(db, idOf(req));
    res.status(201).json(getRoom(db, roomId));
  });

  router.get('/rooms/:id', (req, res) => {
    const user = userOf(req);
    const projectId = requireRoom(db, user, idOf(req), 'view');
    const p = getProject(db, user, projectId);
    const detail: RoomDetail = {
      room: getRoom(db, idOf(req)),
      project: { id: p.id, name: p.name, clientId: p.clientId, clientName: p.clientName, canEdit: p.canEdit },
      images: listImages(db, idOf(req)),
      designs: listDesigns(db, idOf(req)),
    };
    res.json(detail);
  });

  router.patch('/rooms/:id', (req, res) => {
    const projectId = requireRoom(db, userOf(req), idOf(req), 'edit');
    const b = parseBody(updateRoomSchema, req.body);
    db.tx(() => {
      if (b.name !== undefined) db.run('UPDATE rooms SET name = ? WHERE id = ?', b.name, idOf(req));
      if (b.roomType !== undefined) db.run('UPDATE rooms SET room_type = ? WHERE id = ?', b.roomType, idOf(req));
      db.run('UPDATE rooms SET updated_at = ? WHERE id = ?', now(), idOf(req));
      touchProject(db, projectId);
    });
    res.json(getRoom(db, idOf(req)));
  });

  router.delete('/rooms/:id', async (req, res) => {
    const projectId = requireRoom(db, userOf(req), idOf(req), 'edit');
    const ids = db.all<{ id: string }>('SELECT id FROM images WHERE room_id = ?', idOf(req)).map((r) => r.id);
    db.run('DELETE FROM rooms WHERE id = ?', idOf(req));
    touchProject(db, projectId);
    await removeFiles(ids);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- image history

  router.get('/rooms/:id/images', (req, res) => {
    requireRoom(db, userOf(req), idOf(req), 'view');
    res.json(listImages(db, idOf(req)));
  });

  /** Stores a result made in the studio (after paste-back in the browser) in the room's history. */
  router.post('/rooms/:id/images', async (req, res) => {
    const user = userOf(req);
    const projectId = requireRoom(db, user, idOf(req), 'edit');
    const b = parseBody(saveImageSchema, req.body);
    const id = await storeImage(idOf(req), user.id, b);
    db.run('UPDATE rooms SET updated_at = ? WHERE id = ?', now(), idOf(req));
    touchProject(db, projectId);
    res.status(201).json(toImage(getImageRow(db, id)));
  });

  /** The image itself. Ids never change content, so browsers may cache it for good. */
  router.get('/images/:id', async (req, res) => {
    const row = getImageRow(db, idOf(req));
    requireRoom(db, userOf(req), row.room_id, 'view');
    const bytes = await images.get(row.id);
    if (!bytes) throw new AppError(404, 'That image file is missing.');
    res.setHeader('content-type', row.mime);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    if (req.query.download) res.setHeader('content-disposition', `attachment; filename="${row.kind}-${row.id.slice(0, 8)}.${row.mime.split('/')[1].replace('jpeg', 'jpg')}"`);
    res.end(bytes);
  });

  router.delete('/images/:id', async (req, res) => {
    const row = getImageRow(db, idOf(req));
    const projectId = requireRoom(db, userOf(req), row.room_id, 'edit');
    if (row.kind === 'original') throw new AppError(400, "The room's original photo cannot be deleted. Delete the room instead.");
    db.tx(() => {
      db.run('DELETE FROM images WHERE id = ?', row.id);
      db.run('UPDATE rooms SET cover_image_id = NULL WHERE cover_image_id = ?', row.id);
      touchProject(db, projectId);
    });
    await removeFiles([row.id]);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- saved designs

  router.post('/rooms/:id/designs', (req, res) => {
    const user = userOf(req);
    const projectId = requireRoom(db, user, idOf(req), 'edit');
    const b = parseBody(saveDesignSchema, req.body);
    const image = getImageRow(db, b.imageId);
    if (image.room_id !== idOf(req)) throw new RequestError('That image is not in this room.');
    const id = randomUUID();
    db.tx(() => {
      db.run('INSERT INTO designs (id, room_id, image_id, name, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, idOf(req), b.imageId, b.name, b.notes, user.id, now());
      // The newest saved design is the room's thumbnail.
      db.run('UPDATE rooms SET cover_image_id = ?, updated_at = ? WHERE id = ?', b.imageId, now(), idOf(req));
      touchProject(db, projectId);
    });
    res.status(201).json(listDesigns(db, idOf(req)).find((d) => d.id === id));
  });

  router.patch('/designs/:id', (req, res) => {
    const d = db.get<{ room_id: string }>('SELECT room_id FROM designs WHERE id = ?', idOf(req));
    if (!d) throw new AppError(404, 'That design was not found.');
    requireRoom(db, userOf(req), d.room_id, 'edit');
    const b = parseBody(updateDesignSchema, req.body);
    if (b.name !== undefined) db.run('UPDATE designs SET name = ? WHERE id = ?', b.name, idOf(req));
    if (b.notes !== undefined) db.run('UPDATE designs SET notes = ? WHERE id = ?', b.notes, idOf(req));
    res.json(listDesigns(db, d.room_id).find((x) => x.id === idOf(req)));
  });

  router.delete('/designs/:id', (req, res) => {
    const d = db.get<{ room_id: string; image_id: string }>('SELECT room_id, image_id FROM designs WHERE id = ?', idOf(req));
    if (!d) throw new AppError(404, 'That design was not found.');
    requireRoom(db, userOf(req), d.room_id, 'edit');
    db.run('DELETE FROM designs WHERE id = ?', idOf(req));
    // Removing a saved design keeps the image in the history.
    const latest = db.get<{ image_id: string }>('SELECT image_id FROM designs WHERE room_id = ? ORDER BY created_at DESC LIMIT 1', d.room_id);
    db.run('UPDATE rooms SET cover_image_id = ? WHERE id = ?', latest?.image_id ?? null, d.room_id);
    res.json({ ok: true });
  });

  return router;
}

