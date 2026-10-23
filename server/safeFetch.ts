import dns from 'node:dns/promises';
import net from 'node:net';

// Server-side fetching of RSS feeds and link previews. Guards against the server being
// used to reach private network addresses (SSRF), caps response size, and times out.

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('That does not look like a web address.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https links can be fetched.');
  if (process.env.ALLOW_PRIVATE_FETCH === '1') return url; // tests and local development only
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Private addresses cannot be fetched.');
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Private addresses cannot be fetched.');
    return url;
  }
  const addrs = await dns.lookup(host, { all: true }).catch(() => { throw new Error(`Could not find ${host}.`); });
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Private addresses cannot be fetched.');
  return url;
}

export async function safeFetchText(raw: string, accept = '*/*'): Promise<{ text: string; finalUrl: string; contentType: string }> {
  let current = raw;
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': 'RibbonmereReader/0.1 (+personal RSS reader)', accept },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location')!, url).toString();
        continue;
      }
      if (!res.ok) throw new Error(`The site answered ${res.status}.`);
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES) { ctrl.abort(); throw new Error('That page is too large to read.'); }
          chunks.push(value);
        }
      }
      const text = Buffer.concat(chunks).toString('utf8');
      return { text, finalUrl: url.toString(), contentType: res.headers.get('content-type') || '' };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('The site took too long to answer.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects.');
}
