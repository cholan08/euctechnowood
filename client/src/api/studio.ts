import type {
  AssistRequest,
  AssistResponse,
  EditRequest,
  EditResponse,
  FinalRequest,
  FinalResponse,
  GenerateRequest,
  GenerateResponse,
  RecommendRequest,
  RecommendResponse,
  RedesignRequest,
  RedesignResponse,
} from '@shared/types';
import { getJson, postJson } from './http';

/** Mark & edit: one change to one marked area (a finish, own words, add or remove). */
export const editImage = (body: EditRequest) => postJson<EditResponse>('/api/edit', body);

/** Standard: options A–D of a whole-room spec. */
export const redesign = (body: RedesignRequest) => postJson<RedesignResponse>('/api/redesign', body);

/** Generate: an empty room photo → 1–4 designed concepts in a style. */
export const generate = (body: GenerateRequest) => postJson<GenerateResponse>('/api/generate', body);

/** Final 2K: one realism pass over the finished image. */
export const finalImage = (body: FinalRequest) => postJson<FinalResponse>('/api/final', body);

/** AI help for a prompt bar: clear English versions of what staff typed. */
export const assist = (body: AssistRequest) => postJson<AssistResponse>('/api/assist', body);

/** Furniture recommendations for a style and room. */
export const recommend = (body: RecommendRequest) => postJson<RecommendResponse>('/api/recommend', body);

export const getHealth = () => getJson<{ ok: boolean; provider: string }>('/api/health');
