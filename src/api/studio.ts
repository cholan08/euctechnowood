import type { QuoteRequest, RedesignRequest, RedesignResponse } from '../../shared/types';
import { postJson, readJson } from './client';

export const redesign = (body: RedesignRequest) => postJson<RedesignResponse>('/api/redesign', body);

export const getHealth = () => fetch('/api/health').then((r) => readJson<{ ok: boolean; provider: string }>(r));

export const submitQuote = (body: QuoteRequest) => postJson<{ ok: true; id: number }>('/api/leads', body);
