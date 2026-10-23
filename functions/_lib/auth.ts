import { type Env, settings, fail } from './env';

// Verifies Firebase ID tokens inside a Cloudflare Function (no Firebase Admin SDK needed):
// RS256 signature against Google's published keys, plus audience, issuer and expiry checks.

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: { keys: Map<string, CryptoKey>; until: number } | null = null;

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(b64url(s)));

async function googleKey(kid: string): Promise<CryptoKey | undefined> {
  if (!jwksCache || jwksCache.until < Date.now()) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error('Could not load Google sign-in keys.');
    const maxAge = Number(res.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
    const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const keys = new Map<string, CryptoKey>();
    for (const k of body.keys) keys.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    jwksCache = { keys, until: Date.now() + maxAge * 1000 };
  }
  return jwksCache.keys.get(kid);
}

export async function verifyIdToken(token: string, env: Env): Promise<{ uid: string }> {
  const { projectId } = settings(env);
  if (!projectId) throw new Error('VITE_FIREBASE_CONFIG is not set.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed sign-in token.');
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  const emulator = env.AUTH_EMULATOR === '1';
  if (!emulator) {
    if (header.alg !== 'RS256' || !header.kid) throw new Error('Unexpected sign-in token.');
    const key = await googleKey(header.kid);
    if (!key) throw new Error('Unknown sign-in key.');
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) throw new Error('Invalid sign-in token.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token is for a different project.');
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Your sign-in has expired. Please reload.');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new Error('Token issued in the future.');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Token has no user.');
  return { uid: payload.sub };
}

/** Returns an error Response unless the request carries the owner's valid Firebase ID token. */
export async function requireOwner(request: Request, env: Env): Promise<Response | { uid: string }> {
  const { ownerUid } = settings(env);
  if (!ownerUid) return fail(503, 'The owner is not set up yet (VITE_OWNER_UID is missing).');
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail(401, 'Please sign in.');
  try {
    const { uid } = await verifyIdToken(token, env);
    if (uid !== ownerUid) return fail(403, 'Only the owner of this world can do that.');
    return { uid };
  } catch (e: any) {
    return fail(401, e.message);
  }
}

// ── the private-image cookie ───────────────────────────────────
// <img> tags can't send sign-in headers, so after signing in the owner's browser receives a short,
// signed, HttpOnly cookie that only works for /media/ and only for the owner.

const enc = new TextEncoder();
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const MEDIA_COOKIE = 'rm_media';
export async function makeMediaCookie(uid: string, secret: string, days = 7) {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const value = `${uid}.${exp}.${await hmac(secret, `${uid}.${exp}`)}`;
  return `${MEDIA_COOKIE}=${value}; Path=/media; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}
export async function mediaCookieIsOwner(request: Request, env: Env): Promise<boolean> {
  const { ownerUid } = settings(env);
  if (!ownerUid || !env.MEDIA_SECRET) return false;
  const raw = request.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${MEDIA_COOKIE}=`))?.slice(MEDIA_COOKIE.length + 1);
  if (!raw) return false;
  const [uid, exp, sig] = raw.split('.');
  if (uid !== ownerUid || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(env.MEDIA_SECRET, `${uid}.${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
