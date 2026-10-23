import type { Env } from '../_lib/env';
import { mediaCookieIsOwner } from '../_lib/auth';
import { kvKey, MEDIA_ID, type MediaMeta } from '../_lib/media';

// Serves images. Public images are cached at the edge for 5 minutes; private images are only
// served to the owner's browser (signed cookie) and never cached. Anyone else gets a plain 404,
// so they can't even tell whether a private image exists.

const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain' } });
const baseHeaders = { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" };

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  const id = String(params.id);
  if (!MEDIA_ID.test(id) || !env.MEDIA) return notFound();
  const cache = caches.default;
  const cacheKey = new Request(new URL(`/media/${id}`, request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const got = await env.MEDIA.getWithMetadata<MediaMeta>(kvKey(id), { type: 'arrayBuffer', cacheTtl: 60 });
  if (!got.value || !got.metadata) return notFound();
  const isPublic = got.metadata.visibility === 'public';
  if (!isPublic && !(await mediaCookieIsOwner(request, env))) return notFound();
  const res = new Response(got.value, {
    headers: {
      ...baseHeaders,
      'content-type': got.metadata.type,
      'cache-control': isPublic ? 'public, max-age=300' : 'private, no-store',
    },
  });
  if (isPublic) waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
