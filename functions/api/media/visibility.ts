import { type Env, json, fail } from '../../_lib/env';
import { requireOwner } from '../../_lib/auth';
import { MEDIA_ID, setVisibility } from '../../_lib/media';

// Change several images' visibility at once (used when publishing something that shows them).
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const who = await requireOwner(request, env);
  if (who instanceof Response) return who;
  if (!env.MEDIA) return fail(503, 'Image storage is not connected yet.');
  const { ids, visibility } = (await request.json().catch(() => ({}))) as { ids?: string[]; visibility?: string };
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every((i) => MEDIA_ID.test(i))) return fail(400, 'Invalid image list.');
  if (visibility !== 'public' && visibility !== 'private') return fail(400, 'Visibility must be public or private.');
  const results: Record<string, boolean> = {};
  for (const id of ids) results[id] = await setVisibility(env, request, id, visibility);
  return json({ ok: true, results });
};
