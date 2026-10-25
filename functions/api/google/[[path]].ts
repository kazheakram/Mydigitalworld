import { type Env, fail } from '../../_lib/env';
import { requireOwner } from '../../_lib/auth';
import { createGoogleHandler } from '../../../shared/googleServer';

// The Book Tracker connection on Cloudflare (same handler as the home server). The encrypted
// Google token is kept in Workers KV under "g:connection" — a key the image route can never serve.

const KV_KEY = 'g:connection';
const OPEN = new Set(['callback', 'picker']);

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const route = ([] as string[]).concat((params.path as string[] | string | undefined) ?? []).join('/');
  if (!env.MEDIA) return fail(503, 'The MEDIA KV namespace is not bound, so the Google connection has nowhere safe to live.');
  const kv = env.MEDIA;
  let isOwner = false;
  if (!OPEN.has(route)) {
    const who = await requireOwner(request, env);
    if (who instanceof Response) return who;
    isOwner = true;
  }
  const url = new URL(request.url);
  const handle = createGoogleHandler({
    clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, apiKey: env.GOOGLE_API_KEY, appId: env.GOOGLE_APP_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI, secret: env.GOOGLE_TOKEN_SECRET || env.MEDIA_SECRET,
    authUrl: env.GOOGLE_TEST_AUTH_URL, tokenUrl: env.GOOGLE_TEST_TOKEN_URL, revokeUrl: env.GOOGLE_TEST_REVOKE_URL,
    sheetsBase: env.GOOGLE_TEST_API_BASE, driveBase: env.GOOGLE_TEST_API_BASE,
  }, { get: () => kv.get(KV_KEY), put: (v) => kv.put(KV_KEY, v), del: () => kv.delete(KV_KEY) });
  const cookies = Object.fromEntries((request.headers.get('cookie') ?? '').split(/;\s*/).filter((c) => c.includes('=')).map((c) => [c.slice(0, c.indexOf('=')), decodeURIComponent(c.slice(c.indexOf('=') + 1))]));
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : undefined;
  const r = await handle({ method: request.method, route, query: url.searchParams, body, origin: url.origin, cookies, isOwner, secure: url.protocol === 'https:' });
  const headers = new Headers({ 'cache-control': 'no-store', ...(r.headers ?? {}) });
  for (const c of r.cookies ?? []) headers.append('set-cookie', c);
  if (r.redirect) { headers.set('location', r.redirect); return new Response(null, { status: r.status, headers }); }
  if (r.html) { headers.set('content-type', 'text/html; charset=utf-8'); return new Response(r.html, { status: r.status, headers }); }
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(r.json), { status: r.status, headers });
};
