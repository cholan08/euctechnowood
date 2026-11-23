import type { AssistRequest, AssistResponse, EditRequest, EditResponse, FinalRequest, FinalResponse, RedesignRequest, RedesignResponse } from '../../../shared/types';
import { postJson, readJson } from './client';

/** Mark & edit: one change to one marked area. */
export const editImage = (body: EditRequest) => postJson<EditResponse>('/api/edit', body);

/** Standard: options A–D of a whole-room spec. */
export const redesign = (body: RedesignRequest) => postJson<RedesignResponse>('/api/redesign', body);

/** Final 2K: one realism pass over the finished image. */
export const finalImage = (body: FinalRequest) => postJson<FinalResponse>('/api/final', body);

/** AI help for a prompt bar: clear English versions of what staff typed. */
export const assist = (body: AssistRequest) => postJson<AssistResponse>('/api/assist', body);

export const getHealth = () => fetch('/api/health').then((r) => readJson<{ ok: boolean; provider: string }>(r));
