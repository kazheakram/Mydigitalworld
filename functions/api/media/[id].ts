import { type Env, json, fail } from '../../_lib/env';
import { requireOwner } from '../../_lib/auth';
import { kvKey, MEDIA_ID, publicUrl, setVisibility } from '../../_lib/media';

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const who = await requireOwner(request, env);
  if (who instanceof Response) return who;
  const id = String(params.id);
  if (!env.MEDIA || !MEDIA_ID.test(id)) return fail(404, 'No such image.');
  const { visibility } = (await request.json().catch(() => ({}))) as { visibility?: string };
  if (visibility !== 'public' && visibility !== 'private') return fail(400, 'Visibility must be public or private.');
  return (await setVisibility(env, request, id, visibility)) ? json({ ok: true }) : fail(404, 'No such image.');
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const who = await requireOwner(request, env);
  if (who instanceof Response) return who;
  const id = String(params.id);
  if (!env.MEDIA || !MEDIA_ID.test(id)) return fail(404, 'No such image.');
  await env.MEDIA.delete(kvKey(id));
  await caches.default.delete(publicUrl(request, id)).catch(() => {});
  return json({ ok: true });
};
