import type { Env } from './env';

export interface MediaMeta { type: string; visibility: 'private' | 'public'; size: number; createdAt: string }
export const MEDIA_ID = /^[a-f0-9]{32}$/;
export const kvKey = (id: string) => `m:${id}`;
export const publicUrl = (request: Request, id: string) => new URL(`/media/${id}`, request.url).toString();

/** Rewrites an image's metadata (KV can only change metadata by writing the value again). */
export async function setVisibility(env: Env, request: Request, id: string, visibility: 'private' | 'public') {
  const got = await env.MEDIA!.getWithMetadata<MediaMeta>(kvKey(id), 'arrayBuffer');
  if (!got.value || !got.metadata) return false;
  if (got.metadata.visibility !== visibility) {
    await env.MEDIA!.put(kvKey(id), got.value, { metadata: { ...got.metadata, visibility } });
  }
  // Drop any edge-cached public copy in this data centre (others expire within 5 minutes).
  if (visibility === 'private') await caches.default.delete(publicUrl(request, id)).catch(() => {});
  return true;
}
