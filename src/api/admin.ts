import type { AdminLead, LeadStatus } from '../../shared/types';
import { postJson, readJson } from './client';

export const getSession = () => fetch('/api/admin/session').then((r) => readJson<{ signedIn: boolean }>(r));

export const login = (password: string) => postJson<{ signedIn: boolean }>('/api/admin/login', { password });

export const logout = () => postJson<{ signedIn: boolean }>('/api/admin/logout', {});

export const getLeads = () => fetch('/api/admin/leads').then((r) => readJson<{ leads: AdminLead[] }>(r));

export const setLeadStatus = (id: number, status: LeadStatus) =>
  fetch(`/api/admin/leads/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then((r) => readJson<{ ok: boolean }>(r));
