/** Reads a JSON response; throws an ApiError with the server's message when the request failed. */
export async function readJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !json) {
    // A lost session anywhere sends the app back to the sign-in page (see app/auth.tsx).
    if (response.status === 401 && !response.url.endsWith('/api/auth/login')) window.dispatchEvent(new Event('auth:expired'));
    throw new ApiError(json?.error ?? `Request failed (${response.status}).`, response.status);
  }
  return json;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  }).then((r) => readJson<T>(r));
}

export const getJson = <T>(url: string) => send<T>('GET', url);
export const postJson = <T>(url: string, body: unknown = {}) => send<T>('POST', url, body);
export const patchJson = <T>(url: string, body: unknown) => send<T>('PATCH', url, body);
export const putJson = <T>(url: string, body: unknown) => send<T>('PUT', url, body);
export const deleteJson = <T = { ok: true }>(url: string) => send<T>('DELETE', url);

/** "?a=1&b=x" from the values that are set. */
export function query(params: Record<string, string | undefined | false>): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const s = q.toString();
  return s ? `?${s}` : '';
}
