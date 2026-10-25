import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { SheetCell } from '../../../shared/bookSync';
import { trackerGrid } from './tracker';

// A tiny stand-in for Google (OAuth, Sheets values, Drive copy) used by the tests. It behaves like
// the real APIs in the ways that matter here: per-render values, formulas, trailing blanks trimmed,
// dates entered as text becoming dates in the cell's own format, refresh tokens that can be revoked.

export interface FakeSheet { id: string; name: string; tabs: { gid: number; title: string; rows: SheetCell[][] }[] }
export interface FakeGoogle {
  url: string;
  sheets: Map<string, FakeSheet>;
  writes: { range: string; value: unknown; input: string }[];
  copies: string[];
  revoked: Set<string>;
  requests: string[];
  failNext: (status: number, times?: number) => void;
  close: () => Promise<void>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const colIndex = (s: string) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export const TRACKER_ID = '1FakeTrackerSpreadsheetId_abcdefgh';

export async function startFakeGoogle(): Promise<FakeGoogle> {
  const sheets = new Map<string, FakeSheet>();
  sheets.set(TRACKER_ID, { id: TRACKER_ID, name: 'My book tracker <3', tabs: [
    { gid: 0, title: 'Dashboard', rows: [[{ v: 'Books read' }, { v: '6', f: '=COUNTA(Tracker!B4:B)', u: 6 }]] },
    { gid: 1234, title: 'Tracker', rows: trackerGrid().rows },
    { gid: 77, title: 'Wishlist', rows: [['BOOK TITLE', 'COVER', 'AUTHOR', 'PRICE'].map((v) => ({ v }))] },
  ] });
  const writes: FakeGoogle['writes'] = [];
  const copies: string[] = [];
  const revoked = new Set<string>();
  const requests: string[] = [];
  const tokens = new Map<string, string>(); // access → refresh
  let failing = { status: 0, times: 0 };
  let n = 0;

  const send = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const readBody = (req: http.IncomingMessage) => new Promise<string>((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });

  function cellRange(range: string) {
    const m = /^'((?:[^']|'')+)'!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(range);
    if (!m) throw new Error(`bad range ${range}`);
    return { title: m[1].replace(/''/g, "'"), c1: colIndex(m[2]), r1: +m[3] - 1, c2: m[4] ? colIndex(m[4]) : colIndex(m[2]), r2: m[5] ? +m[5] - 1 : +m[3] - 1 };
  }
  function render(c: SheetCell | undefined, how: string) {
    if (!c) return '';
    if (how === 'FORMULA') return c.f ?? (c.u !== undefined && c.u !== null ? c.u : c.v);
    if (how === 'UNFORMATTED_VALUE') return c.u !== undefined && c.u !== null ? c.u : c.v;
    return c.v;
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url!, 'http://x');
    requests.push(`${req.method} ${u.pathname}`);
    const body = req.method === 'POST' ? await readBody(req) : '';
    if (u.pathname === '/o/oauth2/v2/auth') {
      const back = new URL(u.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', 'fake-code'); back.searchParams.set('state', u.searchParams.get('state')!);
      res.writeHead(302, { location: back.toString() }); return res.end();
    }
    if (u.pathname === '/token') {
      const p = new URLSearchParams(body);
      if (p.get('grant_type') === 'authorization_code') {
        if (p.get('code') !== 'fake-code' || !p.get('client_secret')) return send(res, 400, { error: 'invalid_grant' });
        const refresh = `rt-${++n}`; const at = `at-${++n}`; tokens.set(at, refresh);
        return send(res, 200, { access_token: at, refresh_token: refresh, expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file', token_type: 'Bearer' });
      }
      const refresh = p.get('refresh_token')!;
      if (revoked.has(refresh)) return send(res, 400, { error: 'invalid_grant' });
      const at = `at-${++n}`; tokens.set(at, refresh);
      return send(res, 200, { access_token: at, expires_in: 3600 });
    }
    if (u.pathname === '/revoke') { revoked.add(new URLSearchParams(body).get('token')!); return send(res, 200, {}); }
    const at = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!at || !tokens.has(at) || revoked.has(tokens.get(at)!)) return send(res, 401, { error: { message: 'Invalid Credentials' } });
    if (failing.times > 0) { failing.times--; return send(res, failing.status, { error: { message: 'Injected failure' } }); }
    let m = /^\/v4\/spreadsheets\/([^/:]+)(.*)$/.exec(u.pathname);
    if (m) {
      const sh = sheets.get(decodeURIComponent(m[1]));
      if (!sh) return send(res, 404, { error: { message: 'Requested entity was not found.' } });
      if (!m[2]) return send(res, 200, { spreadsheetId: sh.id, properties: { title: sh.name }, sheets: sh.tabs.map((t, index) => ({ properties: { sheetId: t.gid, title: t.title, index, gridProperties: { rowCount: Math.max(1000, t.rows.length), columnCount: 26 } } })) });
      if (m[2] === '/values:batchGet') {
        const how = u.searchParams.get('valueRenderOption') ?? 'FORMATTED_VALUE';
        const valueRanges = u.searchParams.getAll('ranges').map((range) => {
          const r = cellRange(range);
          const tab = sh.tabs.find((t) => t.title === r.title);
          if (!tab) throw new Error('no tab');
          const values: any[][] = [];
          for (let row = r.r1; row <= Math.min(r.r2, tab.rows.length - 1); row++) {
            const out: any[] = [];
            for (let col = r.c1; col <= Math.min(r.c2, (tab.rows[row]?.length ?? 0) - 1); col++) out.push(render(tab.rows[row][col], how));
            while (out.length && out[out.length - 1] === '') out.pop();
            values.push(out);
          }
          while (values.length && !values[values.length - 1].length) values.pop();
          return { range, majorDimension: 'ROWS', values };
        });
        return send(res, 200, { spreadsheetId: sh.id, valueRanges });
      }
      if (m[2] === '/values:batchUpdate') {
        const b = JSON.parse(body);
        for (const d of b.data) {
          const r = cellRange(d.range);
          const tab = sh.tabs.find((t) => t.title === r.title)!;
          while (tab.rows.length <= r.r1) tab.rows.push([]);
          const row = tab.rows[r.r1];
          while (row.length <= r.c1) row.push({ v: '' });
          const v = d.values[0][0];
          writes.push({ range: d.range, value: v, input: b.valueInputOption });
          let cell: SheetCell;
          const date = b.valueInputOption === 'USER_ENTERED' && typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
          if (date) {
            const serial = Math.round((Date.UTC(+date[1], +date[2] - 1, +date[3]) - Date.UTC(1899, 11, 30)) / 86400000);
            cell = { v: `${+date[3]} ${MONTHS[+date[2] - 1]} ${date[1].slice(2)}`, u: serial };
          } else if (typeof v === 'boolean') cell = { v: v ? 'TRUE' : 'FALSE', u: v };
          else cell = { v: String(v), u: v };
          row[r.c1] = cell;
        }
        return send(res, 200, { spreadsheetId: sh.id, totalUpdatedCells: b.data.length });
      }
    }
    m = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(u.pathname);
    if (m) {
      const src = sheets.get(decodeURIComponent(m[1]));
      if (!src) return send(res, 404, { error: { message: 'File not found.' } });
      const id = `copy_${copies.length + 1}_of_${src.id}`;
      sheets.set(id, JSON.parse(JSON.stringify({ ...src, id, name: JSON.parse(body).name })));
      copies.push(id);
      return send(res, 200, { id, name: JSON.parse(body).name, webViewLink: `https://docs.google.com/spreadsheets/d/${id}/edit` });
    }
    send(res, 404, { error: { message: `fake google has no ${u.pathname}` } });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url, sheets, writes, copies, revoked, requests,
    failNext: (status, times = 1) => { failing = { status, times }; },
    close: () => new Promise((r) => server.close(() => r())),
  };
}

/** Environment for pointing Ribbonmere at the fake. */
export const fakeGoogleEnv = (url: string) => ({
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_API_KEY: 'test-key', GOOGLE_APP_ID: '123456',
  GOOGLE_TOKEN_SECRET: 'test-token-secret-0123456789abcdef',
  GOOGLE_TEST_AUTH_URL: `${url}/o/oauth2/v2/auth`, GOOGLE_TEST_TOKEN_URL: `${url}/token`, GOOGLE_TEST_REVOKE_URL: `${url}/revoke`, GOOGLE_TEST_API_BASE: url,
});
