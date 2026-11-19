import type { RedesignRequest, RedesignResponse } from '../shared/types';

async function readJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !json) throw new Error(json?.error ?? `Request failed (${response.status}).`);
  return json;
}

export async function redesign(body: RedesignRequest): Promise<RedesignResponse> {
  const response = await fetch('/api/redesign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson<RedesignResponse>(response);
}

export async function getHealth(): Promise<{ ok: boolean; provider: string }> {
  return readJson(await fetch('/api/health'));
}
