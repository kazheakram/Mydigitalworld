// The server half of the Book Tracker connection. One handler serves both versions of Ribbonmere:
// the Node home server (server/app.ts) and the Cloudflare Pages Function (functions/api/google).
// It only uses fetch and Web Crypto, so the same code runs in Node and in Workers.
//
// Security:
//   • Google's own OAuth flow, with one scope: drive.file. Ribbonmere can only open the
//     spreadsheet you pick (and the backup copies it makes) — none of your other files.
//   • The client secret and the refresh token never reach the browser. The refresh token is kept
//     encrypted (AES-GCM) on the server: in Workers KV on the cloud, in the SQLite file at home.
//   • Every route except the OAuth return is owner-only. The return is checked against a signed,
//     expiring state that must match a cookie set for the owner's browser.
//   • Writes are cell-by-cell and refused unless: two-way is switched on here, a Drive backup copy
//     exists, the row's title still matches, the cell still holds what the plan saw, the cell is not
//     a formula, and a filled cell is never emptied without an explicit "yes".
//   • There is no route that deletes rows, clears ranges, or rewrites a whole sheet.

import type { SheetCell, SheetGrid } from './bookSync';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface GoogleConfig {
  clientId?: string;
  clientSecret?: string;
  /** Browser key for the Google Picker (restricted to your site in Google Cloud). */
  apiKey?: string;
  /** Your Google Cloud project number (the Picker needs it to grant per-file access). */
  appId?: string;
  /** Server secret used to encrypt the stored token and sign the OAuth state. */
  secret?: string;
  /** Overrides the OAuth return address (otherwise <this site>/api/google/callback). */
  redirectUri?: string;
  /** Test-only overrides so the handler can talk to a local fake Google. */
  authUrl?: string; tokenUrl?: string; revokeUrl?: string; sheetsBase?: string; driveBase?: string;
}

export interface TokenStore { get(): Promise<string | null>; put(value: string): Promise<void>; del(): Promise<void> }

export interface GReq {
  method: string;
  /** The part after /api/google/, e.g. "status". */
  route: string;
  query: URLSearchParams;
  body: any;
  origin: string;
  cookies: Record<string, string>;
  isOwner: boolean;
  secure: boolean;
}
export interface GRes { status: number; json?: unknown; redirect?: string; cookies?: string[]; html?: string; headers?: Record<string, string> }

interface Connection {
  refreshToken: string;
  scope: string;
  connectedAt: string;
  sheet?: { id: string; name: string };
  allowWrites?: boolean;
  backup?: { id: string; name: string; at: string; url?: string };
}

const STATE_COOKIE = 'rm_gstate';
const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ok = (json: unknown, status = 200): GRes => ({ status, json });
const err = (status: number, error: string, extra: Record<string, unknown> = {}): GRes => ({ status, json: { error, ...extra } });
const clean = (s: unknown) => (s == null ? '' : String(s)).replace(/ /g, ' ').trim();

class GoogleError extends Error { constructor(public status: number, message: string, public reconnect = false) { super(message); } }

async function keyFor(secret: string, label: string, usage: 'AES-GCM' | 'HMAC') {
  const raw = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`ribbonmere:${label}:${secret}`)));
  return usage === 'AES-GCM'
    ? crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
    : crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
export async function seal(secret: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(secret, 'google-token', 'AES-GCM'), enc.encode(JSON.stringify(value))));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
export async function unseal<T>(secret: string, sealed: string): Promise<T | null> {
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !ct) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await keyFor(secret, 'google-token', 'AES-GCM'), unb64(ct));
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch { return null; }
}
async function sign(secret: string, msg: string) {
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await keyFor(secret, 'google-state', 'HMAC'), enc.encode(msg))));
}
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** A quoted A1 reference to one cell, e.g. 'Tracker'!B12. */
export function a1(sheetTitle: string, row: number, col: number) {
  let s = ''; let n = col + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return `'${sheetTitle.replace(/'/g, "''")}'!${s}${row}`;
}

export function createGoogleHandler(cfg: GoogleConfig, store: TokenStore, fetcher: typeof fetch = (...a) => fetch(...a)) {
  const authUrl = cfg.authUrl ?? 'https://accounts.google.com/o/oauth2/v2/auth';
  const tokenUrl = cfg.tokenUrl ?? 'https://oauth2.googleapis.com/token';
  const revokeUrl = cfg.revokeUrl ?? 'https://oauth2.googleapis.com/revoke';
  const sheetsBase = cfg.sheetsBase ?? 'https://sheets.googleapis.com';
  const driveBase = cfg.driveBase ?? 'https://www.googleapis.com';
  const configured = !!(cfg.clientId && cfg.clientSecret && cfg.secret);
  let access: { token: string; exp: number; for: string } | null = null;

  const load = async () => { const s = await store.get(); return s && cfg.secret ? unseal<Connection>(cfg.secret, s) : null; };
  const save = async (c: Connection) => store.put(await seal(cfg.secret!, c));
  const redirectUri = (origin: string) => cfg.redirectUri ?? `${origin}/api/google/callback`;

  async function tokenFor(c: Connection): Promise<string> {
    if (access && access.for === c.refreshToken && access.exp > Date.now() + 60_000) return access.token;
    const res = await fetcher(tokenUrl, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId!, client_secret: cfg.clientSecret!, refresh_token: c.refreshToken, grant_type: 'refresh_token' }),
    }).catch(() => null);
    if (!res) throw new GoogleError(502, "Couldn't reach Google. Nothing was changed — try again in a little while.");
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      if (body.error === 'invalid_grant') throw new GoogleError(401, 'Google access has expired or was removed. Nothing was changed — please connect again.', true);
      throw new GoogleError(502, `Google refused the request (${body.error ?? res.status}). Nothing was changed.`);
    }
    access = { token: body.access_token, exp: Date.now() + (Number(body.expires_in) || 3600) * 1000, for: c.refreshToken };
    return access.token;
  }

  async function google(c: Connection, url: string, init: RequestInit = {}): Promise<any> {
    const token = await tokenFor(c);
    const res = await fetcher(url, { ...init, headers: { ...(init.headers as Record<string, string> ?? {}), authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res) throw new GoogleError(502, "Couldn't reach Google. Nothing was changed — try again in a little while.");
    const body: any = await res.json().catch(() => ({}));
    if (res.ok) return body;
    const msg = body?.error?.message ?? `Google answered ${res.status}`;
    if (res.status === 401) { access = null; throw new GoogleError(401, 'Google access has expired. Please connect again.', true); }
    if (res.status === 403 || res.status === 404) throw new GoogleError(res.status, `Ribbonmere can't open that spreadsheet (${msg}). Choose it with "Pick from Google Drive" so Google lets Ribbonmere see just that file.`);
    if (res.status === 429) throw new GoogleError(429, 'Google asked us to slow down. Nothing was changed — try again in a minute.');
    throw new GoogleError(res.status >= 500 ? 502 : 400, `Google: ${msg}`);
  }

  async function tabs(c: Connection, id: string) {
    const meta = await google(c, `${sheetsBase}/v4/spreadsheets/${encodeURIComponent(id)}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))`);
    return {
      id: String(meta.spreadsheetId ?? id),
      name: String(meta.properties?.title ?? 'Spreadsheet'),
      tabs: (meta.sheets ?? []).map((s: any) => ({ gid: Number(s.properties.sheetId), title: String(s.properties.title), rows: s.properties.gridProperties?.rowCount ?? 0, cols: s.properties.gridProperties?.columnCount ?? 0 })) as { gid: number; title: string; rows: number; cols: number }[],
    };
  }
  async function titleOf(c: Connection, gid: number) {
    const t = (await tabs(c, c.sheet!.id)).tabs.find((x) => x.gid === gid);
    if (!t) throw new GoogleError(404, "That tab isn't in the spreadsheet any more. Nothing was changed.");
    return t.title;
  }
  async function batchGet(c: Connection, ranges: string[], render: 'FORMATTED_VALUE' | 'FORMULA' | 'UNFORMATTED_VALUE') {
    const q = new URLSearchParams({ valueRenderOption: render, dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
    for (const r of ranges) q.append('ranges', r);
    const body = await google(c, `${sheetsBase}/v4/spreadsheets/${encodeURIComponent(c.sheet!.id)}/values:batchGet?${q}`);
    return (body.valueRanges ?? []).map((v: any) => (v.values ?? []) as any[][]);
  }

  async function readGrid(c: Connection, gid: number): Promise<SheetGrid> {
    const title = await titleOf(c, gid);
    const range = `'${title.replace(/'/g, "''")}'!A1:BZ5000`;
    const [[shown], [formulas], [raw]] = await Promise.all([batchGet(c, [range], 'FORMATTED_VALUE'), batchGet(c, [range], 'FORMULA'), batchGet(c, [range], 'UNFORMATTED_VALUE')]);
    const rows: SheetCell[][] = [];
    const n = Math.max(shown?.length ?? 0, formulas?.length ?? 0, raw?.length ?? 0);
    for (let r = 0; r < n; r++) {
      const w = Math.max(shown?.[r]?.length ?? 0, formulas?.[r]?.length ?? 0, raw?.[r]?.length ?? 0);
      const row: SheetCell[] = [];
      for (let col = 0; col < w; col++) {
        const f = formulas?.[r]?.[col];
        const cell: SheetCell = { v: shown?.[r]?.[col] == null ? '' : String(shown[r][col]) };
        if (typeof f === 'string' && f.startsWith('=')) cell.f = f.slice(0, 2000);
        const u = raw?.[r]?.[col];
        if (u !== undefined && u !== '') cell.u = typeof u === 'string' ? u.slice(0, 2000) : u;
        row.push(cell);
      }
      rows.push(row);
    }
    return { title, gid, rows };
  }

  const DATE_OR_TIME = /^(\d{4}-\d{2}-\d{2}|\d{1,3}:\d{2}:\d{2})$/;
  async function write(c: Connection, body: any): Promise<GRes> {
    if (!c.allowWrites) return err(403, 'Two-way sync is not switched on, so Ribbonmere will not change the sheet.');
    if (!c.backup) return err(409, 'Make a backup copy of the spreadsheet in Google Drive before Ribbonmere writes to it.');
    const gid = Number(body?.gid);
    const writes: any[] = Array.isArray(body?.writes) ? body.writes : [];
    if (!Number.isInteger(gid) || !writes.length || writes.length > 200) return err(400, 'Send between 1 and 200 cell changes at a time.');
    for (const w of writes) {
      const fine = Number.isInteger(w?.row) && w.row >= 1 && w.row <= 20000 && Number.isInteger(w?.col) && w.col >= 0 && w.col < 78
        && Number.isInteger(w?.guard?.col) && w.guard.col >= 0 && w.guard.col < 78 && typeof w?.guard?.expect === 'string' && typeof w?.expect === 'string'
        && (typeof w.value === 'string' ? w.value.length <= 40000 : typeof w.value === 'number' ? Number.isFinite(w.value) : typeof w.value === 'boolean')
        && (w.input === 'RAW' || (w.input === 'USER_ENTERED' && typeof w.value === 'string' && DATE_OR_TIME.test(w.value)));
      if (!fine) return err(400, 'One of the cell changes is not allowed, so nothing was written.');
    }
    const title = await titleOf(c, gid);
    const targets = writes.map((w) => a1(title, w.row, w.col));
    const guards = writes.map((w) => a1(title, w.row, w.guard.col));
    const [shown, formulas] = await Promise.all([batchGet(c, [...targets, ...guards], 'FORMATTED_VALUE'), batchGet(c, targets, 'FORMULA')]);
    const cell = (v: any[][] | undefined) => clean(v?.[0]?.[0]);
    const results = writes.map((w, i) => {
      const now = cell(shown[i]);
      const guard = cell(shown[writes.length + i]);
      const formula = formulas[i]?.[0]?.[0];
      if (typeof formula === 'string' && formula.startsWith('=')) return { ok: false, reason: 'formula' };
      if (guard !== clean(w.guard.expect)) return { ok: false, reason: 'moved' };
      if (now !== clean(w.expect)) return { ok: false, reason: 'changed', now };
      if (w.value === '' && now !== '' && w.clear !== true) return { ok: false, reason: 'clear' };
      return { ok: true };
    });
    for (const input of ['RAW', 'USER_ENTERED'] as const) {
      const data = writes.map((w, i) => ({ w, i })).filter(({ w, i }) => results[i].ok && w.input === input).map(({ w, i }) => ({ range: targets[i], values: [[w.value]] }));
      if (!data.length) continue;
      await google(c, `${sheetsBase}/v4/spreadsheets/${encodeURIComponent(c.sheet!.id)}/values:batchUpdate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ valueInputOption: input, includeValuesInResponse: false, data }),
      });
    }
    return ok({ results });
  }

  return async function handle(req: GReq): Promise<GRes> {
    try {
      const route = req.route.replace(/^\/+|\/+$/g, '');
      if (route === 'picker' && req.method === 'GET') return pickerPage();
      if (route === 'callback' && req.method === 'GET') return await callback(req);
      if (!req.isOwner) return err(401, 'Only the owner can use the Book Tracker connection.');
      const c = configured ? await load() : null;
      if (route === 'status' && req.method === 'GET') {
        return ok({
          configured, pickerReady: !!(cfg.apiKey && cfg.appId), connected: !!c, scope: c?.scope ?? null, connectedAt: c?.connectedAt ?? null,
          sheet: c?.sheet ?? null, allowWrites: !!c?.allowWrites, backup: c?.backup ?? null, redirectUri: redirectUri(req.origin),
        });
      }
      if (!configured) return err(503, 'Google is not set up for this site yet. See "Connecting Google" in the Owner\'s Guide.');
      if (req.method !== 'POST') return err(405, 'Use POST.');
      if (route === 'connect') {
        const nonce = b64url(crypto.getRandomValues(new Uint8Array(18)));
        const exp = Math.floor(Date.now() / 1000) + 600;
        const state = `${nonce}.${exp}.${await sign(cfg.secret!, `${nonce}.${exp}`)}`;
        const url = `${authUrl}?${new URLSearchParams({
          client_id: cfg.clientId!, redirect_uri: redirectUri(req.origin), response_type: 'code', scope: DRIVE_FILE_SCOPE,
          access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state,
        })}`;
        return { status: 200, json: { url }, cookies: [`${STATE_COOKIE}=${nonce}; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=600${req.secure ? '; Secure' : ''}`] };
      }
      if (route === 'disconnect') {
        let revoked = false;
        if (c) {
          const res = await fetcher(revokeUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: c.refreshToken }) }).catch(() => null);
          revoked = !!res?.ok;
        }
        await store.del(); access = null;
        return ok({ ok: true, revoked });
      }
      if (!c) return err(409, 'Google is not connected.');
      if (route === 'picker-token') {
        if (!cfg.apiKey || !cfg.appId) return err(503, 'The Google Picker needs GOOGLE_API_KEY and GOOGLE_APP_ID. You can paste the spreadsheet link instead.');
        return ok({ accessToken: await tokenFor(c), apiKey: cfg.apiKey, appId: cfg.appId });
      }
      if (route === 'select') {
        const raw = String(req.body?.spreadsheet ?? '');
        const id = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(raw)?.[1] ?? (/^[A-Za-z0-9_-]{20,}$/.test(raw) ? raw : null);
        if (!id) return err(400, 'That does not look like a Google Sheets link.');
        const t = await tabs(c, id);
        const changed = c.sheet?.id !== t.id;
        await save({ ...c, sheet: { id: t.id, name: t.name }, ...(changed ? { allowWrites: false, backup: undefined } : {}) });
        return ok(t);
      }
      if (!c.sheet) return err(409, 'Choose a spreadsheet first.');
      if (route === 'tabs') return ok(await tabs(c, c.sheet.id));
      if (route === 'read') return ok(await readGrid(c, Number(req.body?.gid)));
      if (route === 'backup') {
        const name = `${c.sheet.name} — Ribbonmere backup ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
        const copy = await google(c, `${driveBase}/drive/v3/files/${encodeURIComponent(c.sheet.id)}/copy?fields=id,name,webViewLink`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
        });
        const backup = { id: String(copy.id), name: String(copy.name ?? name), at: new Date().toISOString(), url: copy.webViewLink ? String(copy.webViewLink) : undefined };
        await save({ ...c, backup });
        return ok(backup);
      }
      if (route === 'writes') {
        const allow = req.body?.allow === true;
        if (allow && !c.backup) return err(409, 'Make a backup copy of the spreadsheet in Google Drive first.');
        await save({ ...c, allowWrites: allow });
        return ok({ allowWrites: allow });
      }
      if (route === 'write') return await write(c, req.body);
      return err(404, 'Unknown Book Tracker request.');
    } catch (e: any) {
      if (e instanceof GoogleError) return err(e.status, e.message, e.reconnect ? { reconnect: true } : {});
      return err(500, `Something went wrong talking to Google: ${String(e?.message ?? e).slice(0, 200)}`);
    }
  };

  async function callback(req: GReq): Promise<GRes> {
    const back = (q: string): GRes => ({ status: 302, redirect: `/atelier/books?${q}`, cookies: [`${STATE_COOKIE}=; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=0${req.secure ? '; Secure' : ''}`] });
    if (!configured) return back('google=error&reason=not-configured');
    const state = req.query.get('state') ?? '';
    const [nonce, exp, sig] = state.split('.');
    const cookie = req.cookies[STATE_COOKIE] ?? '';
    if (!nonce || !exp || !sig || Number(exp) < Date.now() / 1000 || !cookie || !sameText(cookie, nonce) || !sameText(await sign(cfg.secret!, `${nonce}.${exp}`), sig)) {
      return back('google=error&reason=state');
    }
    if (req.query.get('error')) return back(`google=error&reason=${encodeURIComponent(req.query.get('error')!.slice(0, 40))}`);
    const code = req.query.get('code');
    if (!code) return back('google=error&reason=code');
    const res = await fetcher(tokenUrl, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: cfg.clientId!, client_secret: cfg.clientSecret!, redirect_uri: redirectUri(req.origin), grant_type: 'authorization_code' }),
    }).catch(() => null);
    const body: any = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !body.refresh_token) return back('google=error&reason=token');
    const scope = String(body.scope ?? '');
    if (!scope.split(' ').includes(DRIVE_FILE_SCOPE)) return back('google=error&reason=scope');
    const prev = await load();
    await save({ refreshToken: body.refresh_token, scope, connectedAt: new Date().toISOString(), sheet: prev?.sheet, allowWrites: false, backup: prev?.backup });
    access = body.access_token ? { token: body.access_token, exp: Date.now() + (Number(body.expires_in) || 3600) * 1000, for: body.refresh_token } : null;
    return back('google=connected');
  }

  function pickerPage(): GRes {
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
    return {
      status: 200,
      html: PICKER_HTML.replace(/__NONCE__/g, nonce),
      headers: {
        'content-security-policy': [
          "default-src 'none'", `script-src 'nonce-${nonce}' https://apis.google.com https://www.gstatic.com`, "style-src 'unsafe-inline' https://fonts.googleapis.com",
          "img-src https: data:", 'frame-src https://docs.google.com https://drive.google.com https://*.google.com', "connect-src https://*.googleapis.com https://*.google.com",
          "base-uri 'none'", "form-action 'none'",
        ].join('; '),
        'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-content-type-options': 'nosniff',
      },
    };
  }
}

/** The small popup that shows Google's file picker. It receives a short-lived token from the
 *  owner's open Ribbonmere tab by postMessage (same origin only) and sends back the picked file. */
const PICKER_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Choose your book tracker</title>
<style>body{margin:0;font:16px/1.5 Georgia,serif;background:#fff4f6;color:#4a2e35;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px}p{max-width:30em}</style></head>
<body><main><p id="msg">Opening Google Drive… ♡</p></main>
<script nonce="__NONCE__">
(function () {
  var msg = document.getElementById('msg');
  var opener = window.opener;
  if (!opener) { msg.textContent = 'Please open this from the Book Tracker page in the Atelier.'; return; }
  function send(m) { opener.postMessage(m, location.origin); }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || e.source !== opener || !e.data || e.data.type !== 'rm-picker-config') return;
    var cfg = e.data;
    var s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js'; s.nonce = '__NONCE__';
    s.onerror = function () { msg.textContent = "Couldn't load Google's picker. Close this window and paste the link instead."; send({ type: 'rm-picker-error' }); };
    s.onload = function () {
      gapi.load('picker', function () {
        var view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST);
        var picker = new google.picker.PickerBuilder().addView(view).setOAuthToken(cfg.accessToken).setDeveloperKey(cfg.apiKey)
          .setAppId(cfg.appId).setOrigin(location.origin).setTitle('Choose your book tracker')
          .setCallback(function (d) {
            if (d.action === google.picker.Action.PICKED) { var f = d.docs[0]; send({ type: 'rm-picker-picked', id: f.id, name: f.name }); window.close(); }
            else if (d.action === google.picker.Action.CANCEL) { send({ type: 'rm-picker-cancel' }); window.close(); }
          }).build();
        msg.textContent = 'Choose your book tracker spreadsheet ♡';
        picker.setVisible(true);
      });
    };
    document.head.appendChild(s);
  });
  send({ type: 'rm-picker-ready' });
})();
</script></body></html>`;
