import { type Env, json, fail } from '../_lib/env';
import { requireOwner } from '../_lib/auth';

// Fetches a feed or web page for the owner's reader and link previews. The browser does the parsing,
// which keeps this function well inside the free plan's CPU budget. Owner-only, so it can't be used
// as an open proxy.

const MAX_BYTES = 3 * 1024 * 1024;
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f:]*\]?)$/i;

function checkUrl(raw: string, env: Env): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('That does not look like a web address.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https links can be fetched.');
  if (env.ALLOW_PRIVATE_FETCH !== '1' && PRIVATE_HOST.test(u.hostname)) throw new Error('Private addresses cannot be fetched.');
  return u;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const who = await requireOwner(request, env);
  if (who instanceof Response) return who;
  const { url, accept = '*/*' } = (await request.json().catch(() => ({}))) as { url?: string; accept?: string };
  if (!url || url.length > 2000) return fail(400, 'Please give a web address.');
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const target = checkUrl(current, env);
      const res = await fetch(target.toString(), {
        redirect: 'manual',
        headers: { 'user-agent': 'RibbonmereReader/0.2 (+personal RSS reader)', accept: String(accept).slice(0, 200) },
        signal: AbortSignal.timeout(12_000),
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) { current = new URL(loc, target).toString(); continue; }
      if (!res.ok) return fail(422, `The site answered ${res.status}.`);
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES) { await reader.cancel(); return fail(422, 'That page is too large to read.'); }
          chunks.push(value);
        }
      }
      const buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
      return json({ text: new TextDecoder().decode(buf), finalUrl: target.toString(), contentType: res.headers.get('content-type') ?? '' });
    }
    return fail(422, 'Too many redirects.');
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'The site took too long to answer.' : String(e?.message ?? e);
    return fail(422, msg);
  }
};
