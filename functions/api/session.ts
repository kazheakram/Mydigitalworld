import { type Env, json, fail } from '../_lib/env';
import { makeMediaCookie, requireOwner, MEDIA_COOKIE } from '../_lib/auth';

// POST: the owner's browser trades its Firebase sign-in for the private-image cookie.
// DELETE: sign out of private images.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const who = await requireOwner(request, env);
  if (who instanceof Response) return who;
  if (!env.MEDIA_SECRET || env.MEDIA_SECRET.length < 24) return fail(503, 'MEDIA_SECRET is missing or too short (use at least 24 random characters).');
  return json({ ok: true }, 200, { 'set-cookie': await makeMediaCookie(who.uid, env.MEDIA_SECRET) });
};
export const onRequestDelete: PagesFunction<Env> = async () =>
  json({ ok: true }, 200, { 'set-cookie': `${MEDIA_COOKIE}=; Path=/media; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
