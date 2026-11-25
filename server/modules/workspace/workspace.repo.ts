import type { RoomTypeId } from '@shared/catalog';
import type { Access, Client, ImageKind, Project, ProjectMember, ProjectStatus, ProjectSummary, Room, SavedDesign, StoredImage } from '@shared/workspace';
import type { Db } from '../../db/database';
import { AppError } from '../../lib/errors';
import type { SessionUser } from '../../http/auth';

// Reading the workspace tables and turning rows into the API's shapes, plus the
// one rule for who may change a project. Writes live in the route files, next to
// the request they answer.

// ---------------------------------------------------------------- access

/**
 * Every active staff member can see every client and project (it is one small
 * studio). Changing a project needs: admin, or a designer who owns it or was
 * given edit access. Viewers never change anything.
 */
export function projectAccess(db: Db, user: SessionUser, projectId: string): Access | null {
  const p = db.get<{ owner_id: string | null }>('SELECT owner_id FROM projects WHERE id = ?', projectId);
  if (!p) return null;
  if (user.role === 'admin') return 'edit';
  if (user.role === 'viewer') return 'view';
  if (p.owner_id === user.id) return 'edit';
  const m = db.get<{ access: Access }>('SELECT access FROM project_members WHERE project_id = ? AND user_id = ?', projectId, user.id);
  return m?.access === 'edit' ? 'edit' : 'view';
}

/** Throws 404 when the project is missing and 403 when `need` is edit and the user only views. */
export function requireProject(db: Db, user: SessionUser, projectId: string, need: Access): void {
  const access = projectAccess(db, user, projectId);
  if (!access) throw new AppError(404, 'That project was not found.');
  if (need === 'edit' && access !== 'edit') throw new AppError(403, 'You can view this project but not change it. Ask its owner or an admin for edit access.');
}

/** The project a room belongs to; 404 if the room is missing. */
export function projectOfRoom(db: Db, roomId: string): string {
  const r = db.get<{ project_id: string }>('SELECT project_id FROM rooms WHERE id = ?', roomId);
  if (!r) throw new AppError(404, 'That room was not found.');
  return r.project_id;
}

export function requireRoom(db: Db, user: SessionUser, roomId: string, need: Access): string {
  const projectId = projectOfRoom(db, roomId);
  requireProject(db, user, projectId, need);
  return projectId;
}

// ---------------------------------------------------------------- clients

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  project_count: number;
}

const toClient = (r: ClientRow): Client => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  projectCount: r.project_count,
});

const CLIENT_SELECT = `SELECT c.*, (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count FROM clients c`;

export function listClients(db: Db, q: string): Client[] {
  const like = `%${q.replace(/[%_]/g, '')}%`;
  return db.all<ClientRow>(`${CLIENT_SELECT} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? ORDER BY c.updated_at DESC LIMIT 500`, like, like, like).map(toClient);
}

export function getClient(db: Db, id: string): Client {
  const r = db.get<ClientRow>(`${CLIENT_SELECT} WHERE c.id = ?`, id);
  if (!r) throw new AppError(404, 'That client was not found.');
  return toClient(r);
}

// ---------------------------------------------------------------- projects

interface ProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
  notes: string;
  client_id: string;
  client_name: string;
  owner_id: string | null;
  owner_name: string | null;
  room_count: number;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
}

const PROJECT_SELECT = `
  SELECT p.*, c.name AS client_name, u.name AS owner_name,
         (SELECT COUNT(*) FROM rooms r WHERE r.project_id = p.id) AS room_count,
         (SELECT COALESCE(r.cover_image_id, r.original_image_id) FROM rooms r WHERE r.project_id = p.id ORDER BY r.updated_at DESC LIMIT 1) AS cover_image_id
    FROM projects p JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.owner_id`;

const toSummary = (r: ProjectRow): ProjectSummary => ({
  id: r.id,
  name: r.name,
  status: r.status,
  clientId: r.client_id,
  clientName: r.client_name,
  ownerId: r.owner_id,
  ownerName: r.owner_name,
  roomCount: r.room_count,
  coverImageId: r.cover_image_id,
  updatedAt: r.updated_at,
});

export function listProjects(db: Db, filter: { clientId?: string; status?: string; q?: string; mine?: string }): ProjectSummary[] {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.clientId) {
    where.push('p.client_id = ?');
    params.push(filter.clientId);
  }
  if (filter.status === 'open') where.push("p.status != 'archived'");
  else if (filter.status) {
    where.push('p.status = ?');
    params.push(filter.status);
  }
  if (filter.q) {
    const like = `%${filter.q.replace(/[%_]/g, '')}%`;
    where.push('(p.name LIKE ? OR c.name LIKE ?)');
    params.push(like, like);
  }
  if (filter.mine) {
    where.push('(p.owner_id = ? OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ?))');
    params.push(filter.mine, filter.mine);
  }
  const sql = `${PROJECT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.updated_at DESC LIMIT 500`;
  return db.all<ProjectRow>(sql, ...params).map(toSummary);
}

export function getProject(db: Db, user: SessionUser, id: string): Project {
  const r = db.get<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = ?`, id);
  if (!r) throw new AppError(404, 'That project was not found.');
  const members = db.all<ProjectMember>(
    'SELECT m.user_id AS userId, u.name, m.access FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY u.name',
    id,
  );
  return { ...toSummary(r), notes: r.notes, createdAt: r.created_at, members, rooms: listRooms(db, id), canEdit: projectAccess(db, user, id) === 'edit' };
}

/** Marks a project as just changed, so it rises to the top of lists. */
export const touchProject = (db: Db, projectId: string) => db.run('UPDATE projects SET updated_at = ? WHERE id = ?', new Date().toISOString(), projectId);

// ---------------------------------------------------------------- rooms

interface RoomRow {
  id: string;
  project_id: string;
  name: string;
  room_type: RoomTypeId;
  original_image_id: string | null;
  cover_image_id: string | null;
  image_count: number;
  design_count: number;
  created_at: string;
  updated_at: string;
}

const ROOM_SELECT = `
  SELECT r.*, (SELECT COUNT(*) FROM images i WHERE i.room_id = r.id) AS image_count,
              (SELECT COUNT(*) FROM designs d WHERE d.room_id = r.id) AS design_count
    FROM rooms r`;

const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  roomType: r.room_type,
  originalImageId: r.original_image_id,
  coverImageId: r.cover_image_id,
  imageCount: r.image_count,
  designCount: r.design_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const listRooms = (db: Db, projectId: string): Room[] => db.all<RoomRow>(`${ROOM_SELECT} WHERE r.project_id = ? ORDER BY r.created_at`, projectId).map(toRoom);

export function getRoom(db: Db, id: string): Room {
  const r = db.get<RoomRow>(`${ROOM_SELECT} WHERE r.id = ?`, id);
  if (!r) throw new AppError(404, 'That room was not found.');
  return toRoom(r);
}

// ---------------------------------------------------------------- images and designs

export interface ImageRow {
  id: string;
  room_id: string;
  parent_id: string | null;
  kind: ImageKind;
  label: string;
  detail: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  meta: string;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
}

function parseMeta(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const toImage = (r: ImageRow): StoredImage => ({
  id: r.id,
  roomId: r.room_id,
  parentId: r.parent_id,
  kind: r.kind,
  label: r.label,
  detail: r.detail,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  createdAt: r.created_at,
  createdBy: r.creator_name ?? null,
  meta: parseMeta(r.meta),
});

const IMAGE_SELECT = 'SELECT i.*, u.name AS creator_name FROM images i LEFT JOIN users u ON u.id = i.created_by';

export const listImages = (db: Db, roomId: string): StoredImage[] => db.all<ImageRow>(`${IMAGE_SELECT} WHERE i.room_id = ? ORDER BY i.created_at, i.rowid`, roomId).map(toImage);

export function getImageRow(db: Db, id: string): ImageRow {
  const r = db.get<ImageRow>(`${IMAGE_SELECT} WHERE i.id = ?`, id);
  if (!r) throw new AppError(404, 'That image was not found.');
  return r;
}

interface DesignRow {
  id: string;
  room_id: string;
  image_id: string;
  name: string;
  notes: string;
  created_at: string;
  creator_name: string | null;
}

export function listDesigns(db: Db, roomId: string): SavedDesign[] {
  const rows = db.all<DesignRow>('SELECT d.*, u.name AS creator_name FROM designs d LEFT JOIN users u ON u.id = d.created_by WHERE d.room_id = ? ORDER BY d.created_at DESC', roomId);
  return rows.map((d) => ({
    id: d.id,
    roomId: d.room_id,
    image: toImage(getImageRow(db, d.image_id)),
    name: d.name,
    notes: d.notes,
    createdAt: d.created_at,
    createdBy: d.creator_name,
  }));
}
