import type { Item, ItemKind, Visibility } from '../../shared/types';
import { ApiError, isPreviewingPublic, setPreviewAsPublic } from './apiCore';
import { IS_FIREBASE } from './backend/config';

// One small wrapper for every data request. With the original Node server it calls the server's
// API; on Cloudflare Pages + Firebase the same requests are answered by backend/firebaseApi.ts.
// All writes to the Node server carry the CSRF header it requires.

export { ApiError, isPreviewingPublic, setPreviewAsPublic };
const previewAsPublic = () => isPreviewingPublic();
const loadFirebase = () => import('./backend/firebaseApi');

function withPreview(url: string) {
  if (!previewAsPublic()) return url;
  return url + (url.includes('?') ? '&' : '?') + 'as=public';
}

export async function api<T = any>(method: string, url: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  if (IS_FIREBASE) {
    const { firebaseApi } = await loadFirebase();
    return firebaseApi(method, url, body, extraHeaders) as Promise<T>;
  }
  const isRaw = body instanceof Blob || body instanceof ArrayBuffer || typeof body === 'string';
  let res: Response;
  try {
    res = await fetch(method === 'GET' ? withPreview(url) : url, {
      method,
      credentials: 'same-origin',
      headers: { 'x-ribbonmere': '1', ...(body !== undefined && !isRaw ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
      body: body === undefined ? undefined : isRaw ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the village server. Are you offline?');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Something went wrong (${res.status}).`);
  return data as T;
}

export const items = {
  list: <D = any>(kind?: ItemKind, roomId?: string) => {
    const p = new URLSearchParams();
    if (kind) p.set('kind', kind);
    if (roomId) p.set('roomId', roomId);
    return api<Item<D>[]>('GET', `/api/items?${p}`);
  },
  get: <D = any>(id: string) => api<Item<D>>('GET', `/api/items/${id}`),
  create: <D = any>(kind: ItemKind, data: D, opts: { roomId?: string | null; visibility?: Visibility } = {}) =>
    api<Item<D>>('POST', '/api/items', { kind, data, roomId: opts.roomId ?? null, visibility: opts.visibility ?? 'private' }),
  update: <D = any>(id: string, patch: { data?: Partial<D>; visibility?: Visibility; roomId?: string | null; replace?: boolean }) =>
    api<Item<D>>('PATCH', `/api/items/${id}`, patch),
  remove: (id: string) => api('DELETE', `/api/items/${id}`),
};

export async function uploadImage(file: File, opts: { category?: string; decoration?: boolean } = {}) {
  return api<Item>('POST', '/api/media', file, {
    'x-filename': encodeURIComponent(file.name),
    'x-category': opts.category ?? 'Uploads',
    'x-decoration': opts.decoration ? '1' : '0',
    'content-type': file.type || 'application/octet-stream',
  });
}

// Test hook for the emulator-only cloud test build (never present in a real deployment, which
// doesn't set VITE_USE_EMULATORS): lets the browser tests read data exactly as the app does.
if (import.meta.env.VITE_USE_EMULATORS === '1' && typeof window !== 'undefined') (window as any).__rmApi = api;
