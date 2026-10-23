import { type Env, json, fail } from '../../_lib/env';
import { requireOwner } from '../../_lib/auth';
import { kvKey, type MediaMeta } from '../../_lib/media';
import { IMAGE_TYPES, isSafeSvg, sniffImage } from '../../../shared/logic';

// Upload an image into Workers KV. Images are private unless the owner says otherwise
// (the app makes an image public automatically when it's used on something public).
const MAX = 10 * 1024 * 1024;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const who = await requireOwner(request, env);
  if (who instanceof Response) return who;
  if (!env.MEDIA) return fail(503, 'Image storage is not connected yet (KV binding "MEDIA" is missing).');
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.length === 0) return fail(400, 'No file arrived.');
  if (buf.length > MAX) return fail(413, 'That image is larger than 10 MB. Try a smaller version.');
  const type = sniffImage(buf);
  if (!type) return fail(415, 'Please upload a PNG, JPEG, WebP, GIF or SVG image.');
  if (type === 'svg' && !isSafeSvg(new TextDecoder().decode(buf))) return fail(415, 'That SVG contains scripts or external references, so it cannot be used safely.');
  const visibility = request.headers.get('x-visibility') === 'public' ? 'public' : 'private';
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const meta: MediaMeta = { type: IMAGE_TYPES[type], visibility, size: buf.length, createdAt: new Date().toISOString() };
  try {
    await env.MEDIA.put(kvKey(id), buf, { metadata: meta });
  } catch (e: any) {
    return fail(507, /limit|quota/i.test(String(e?.message)) ? "Today's free upload allowance is used up (1,000 a day). Please try again tomorrow." : `Could not store the image: ${e?.message ?? e}`);
  }
  return json({ id, url: `/media/${id}`, type, size: buf.length, visibility }, 201);
};
