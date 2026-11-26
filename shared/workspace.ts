import type { RoomTypeId } from './catalog';

// Studio management: staff accounts, clients, projects, rooms, the image history
// and saved designs. These are the shapes the API sends and accepts; both sides
// import them so they can never drift apart.

// ---------------------------------------------------------------- staff and permissions

/**
 * - admin: everything, including staff accounts and every project
 * - designer: creates clients and projects, uses the studio, edits projects they own or were given edit access to
 * - viewer: sees clients, projects and designs; cannot change anything or use the AI
 */
export type Role = 'admin' | 'designer' | 'viewer';

export const ROLES: { id: Role; label: string; description: string }[] = [
  { id: 'admin', label: 'Admin', description: 'Everything, including staff accounts and every project.' },
  { id: 'designer', label: 'Designer', description: 'Clients, projects and the studio. Edits own projects and ones shared with them.' },
  { id: 'viewer', label: 'Viewer', description: 'Sees clients, projects and designs. Cannot change anything or use the AI.' },
];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** A staff account as admins see it. */
export interface StaffMember extends User {
  active: boolean;
  /** Images per day; null = the studio default. */
  dailyLimit: number | null;
  createdAt: string;
  lastLoginAt: string | null;
  /** Images made today. */
  usedToday: number;
}

export interface MeResponse {
  user: User;
  /** Images this person may still make today. */
  imagesLeft: number;
  dailyLimit: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface NewStaffRequest {
  name: string;
  email: string;
  role: Role;
  password: string;
  dailyLimit?: number | null;
}

export interface UpdateStaffRequest {
  name?: string;
  role?: Role;
  active?: boolean;
  dailyLimit?: number | null;
  /** Admin resets the password. */
  password?: string;
}

/** Who may use the AI (it costs money) and change records. */
export const canEdit = (role: Role) => role !== 'viewer';

// ---------------------------------------------------------------- clients

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** Number of projects. */
  projectCount: number;
}

export type ClientInput = Pick<Client, 'name'> & Partial<Pick<Client, 'phone' | 'email' | 'address' | 'notes'>>;

// ---------------------------------------------------------------- projects

export type ProjectStatus = 'active' | 'presented' | 'approved' | 'archived';

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: 'active', label: 'In design' },
  { id: 'presented', label: 'Presented' },
  { id: 'approved', label: 'Approved' },
  { id: 'archived', label: 'Archived' },
];

export type Access = 'edit' | 'view';

export interface ProjectMember {
  userId: string;
  name: string;
  access: Access;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  clientId: string;
  clientName: string;
  ownerId: string | null;
  ownerName: string | null;
  roomCount: number;
  /** Designs staff kept across all rooms. */
  designCount: number;
  /** Rooms with at least one kept design. */
  designedRoomCount: number;
  /** Room names, oldest first. */
  roomNames: string[];
  /** Everyone added to the project besides the owner. */
  memberNames: string[];
  /** An image id for the card thumbnail. */
  coverImageId: string | null;
  updatedAt: string;
}

/** A presented project with no activity for this many days needs a follow-up with the client. */
export const FOLLOW_UP_DAYS = 7;

/** Headline numbers for the Projects page. */
export interface ProjectStats {
  /** Projects per status. */
  byStatus: Record<ProjectStatus, number>;
  /** Everything not archived. */
  open: number;
  /** Projects the signed-in person owns or was added to. */
  mine: number;
  /** Presented projects quiet for FOLLOW_UP_DAYS or more. */
  followUp: number;
  rooms: number;
  designs: number;
}

export type ProjectSort = 'recent' | 'stale' | 'name' | 'client';

export const PROJECT_SORTS: { id: ProjectSort; label: string }[] = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'stale', label: 'Least recently updated' },
  { id: 'name', label: 'Project name' },
  { id: 'client', label: 'Client name' },
];

export interface Project extends ProjectSummary {
  notes: string;
  createdAt: string;
  members: ProjectMember[];
  rooms: Room[];
  /** Whether the signed-in person may change this project. */
  canEdit: boolean;
}

export interface ProjectInput {
  clientId: string;
  name: string;
  notes?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  status?: ProjectStatus;
  notes?: string;
  ownerId?: string;
}

export interface SetMembersRequest {
  members: { userId: string; access: Access }[];
}

// ---------------------------------------------------------------- rooms, image history, saved designs

export interface Room {
  id: string;
  projectId: string;
  name: string;
  roomType: RoomTypeId;
  originalImageId: string | null;
  coverImageId: string | null;
  imageCount: number;
  designCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewRoomRequest {
  name: string;
  roomType: RoomTypeId;
  /** The room photo as a data URL. */
  image: string;
  width: number;
  height: number;
}

export type ImageKind = 'original' | 'edit' | 'design' | 'concept' | 'final' | 'board';

export const IMAGE_KINDS: Record<ImageKind, string> = {
  original: 'Original photo',
  edit: 'Mark & edit',
  design: 'Standard design',
  concept: 'Generated concept',
  final: 'Final 2K',
  board: 'Presentation board',
};

/** One image in a room's history. Its bytes are at GET /api/images/:id. */
export interface StoredImage {
  id: string;
  roomId: string;
  parentId: string | null;
  kind: ImageKind;
  /** "Base cabinets", "Modern · Concept 2" */
  label: string;
  /** "Sage green · Laminate · Matte" */
  detail: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  createdBy: string | null;
  /** Free-form: the prompt, the style, spec lines... */
  meta: Record<string, unknown>;
}

export interface SaveImageRequest {
  /** The image as a data URL (JPEG, PNG or WebP). */
  image: string;
  width: number;
  height: number;
  kind: Exclude<ImageKind, 'original'>;
  parentId?: string | null;
  label?: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface SavedDesign {
  id: string;
  roomId: string;
  image: StoredImage;
  name: string;
  notes: string;
  createdAt: string;
  createdBy: string | null;
}

export interface SaveDesignRequest {
  imageId: string;
  name: string;
  notes?: string;
}

/** What the room page and the studio need in one call. */
export interface RoomDetail {
  room: Room;
  project: Pick<Project, 'id' | 'name' | 'clientId' | 'clientName' | 'canEdit'>;
  images: StoredImage[];
  designs: SavedDesign[];
}

export const imageUrl = (id: string) => `/api/images/${id}`;

// ---------------------------------------------------------------- usage

export interface UsageSummary {
  /** Last 30 days, newest first. */
  days: { day: string; images: number; calls: number; failed: number }[];
  people: { userId: string | null; name: string; images: number; calls: number; failed: number }[];
  totals: { images: number; calls: number; failed: number; avgMs: number };
}
