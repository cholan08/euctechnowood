import type {
  Client,
  ClientInput,
  LoginRequest,
  MeResponse,
  NewRoomRequest,
  NewStaffRequest,
  Project,
  ProjectInput,
  ProjectSummary,
  Room,
  RoomDetail,
  SaveDesignRequest,
  SavedDesign,
  SaveImageRequest,
  SetMembersRequest,
  StaffMember,
  StoredImage,
  UpdateProjectRequest,
  UpdateStaffRequest,
  UsageSummary,
  User,
} from '@shared/workspace';
import { deleteJson, getJson, patchJson, postJson, putJson, query } from './http';

// Studio management: sign-in, staff, clients, projects, rooms, image history and saved designs.

export const auth = {
  me: () => getJson<MeResponse>('/api/auth/me'),
  login: (body: LoginRequest) => postJson<MeResponse>('/api/auth/login', body),
  logout: () => postJson<{ ok: true }>('/api/auth/logout'),
  changePassword: (current: string, next: string) => postJson<{ ok: true }>('/api/auth/password', { current, next }),
};

export const team = {
  list: () => getJson<StaffMember[]>('/api/team'),
  directory: () => getJson<User[]>('/api/team/directory'),
  add: (body: NewStaffRequest) => postJson<StaffMember>('/api/team', body),
  update: (id: string, body: UpdateStaffRequest) => patchJson<StaffMember>(`/api/team/${id}`, body),
  usage: () => getJson<UsageSummary>('/api/usage'),
};

export const clients = {
  list: (q = '') => getJson<Client[]>(`/api/clients${query({ q })}`),
  get: (id: string) => getJson<{ client: Client; projects: ProjectSummary[] }>(`/api/clients/${id}`),
  add: (body: ClientInput) => postJson<Client>('/api/clients', body),
  update: (id: string, body: Partial<ClientInput>) => patchJson<Client>(`/api/clients/${id}`, body),
  remove: (id: string) => deleteJson(`/api/clients/${id}`),
};

export const projects = {
  list: (filter: { q?: string; status?: string; mine?: boolean; clientId?: string } = {}) =>
    getJson<ProjectSummary[]>(`/api/projects${query({ q: filter.q, status: filter.status, mine: filter.mine && '1', clientId: filter.clientId })}`),
  get: (id: string) => getJson<Project>(`/api/projects/${id}`),
  add: (body: ProjectInput) => postJson<Project>('/api/projects', body),
  update: (id: string, body: UpdateProjectRequest) => patchJson<Project>(`/api/projects/${id}`, body),
  setMembers: (id: string, body: SetMembersRequest) => putJson<Project>(`/api/projects/${id}/members`, body),
  remove: (id: string) => deleteJson(`/api/projects/${id}`),
  addRoom: (id: string, body: NewRoomRequest) => postJson<Room>(`/api/projects/${id}/rooms`, body),
};

export const rooms = {
  get: (id: string) => getJson<RoomDetail>(`/api/rooms/${id}`),
  update: (id: string, body: { name?: string; roomType?: string }) => patchJson<Room>(`/api/rooms/${id}`, body),
  remove: (id: string) => deleteJson(`/api/rooms/${id}`),
  saveImage: (id: string, body: SaveImageRequest) => postJson<StoredImage>(`/api/rooms/${id}/images`, body),
  removeImage: (imageId: string) => deleteJson(`/api/images/${imageId}`),
  saveDesign: (id: string, body: SaveDesignRequest) => postJson<SavedDesign>(`/api/rooms/${id}/designs`, body),
  updateDesign: (designId: string, body: { name?: string; notes?: string }) => patchJson<SavedDesign>(`/api/designs/${designId}`, body),
  removeDesign: (designId: string) => deleteJson(`/api/designs/${designId}`),
};
