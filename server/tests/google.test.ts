// The Book Tracker connection on the home server, against a local fake Google: OAuth with a signed
// state, the encrypted token, owner-only routes, reading the sheet, and every write safeguard.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { googleConfigFromEnv } from '../google';
import { seal, unseal } from '../../shared/googleServer';
import { planSync, suggestMapping, type SheetGrid } from '../../shared/bookSync';
import { fakeGoogleEnv, startFakeGoogle, TRACKER_ID, type FakeGoogle } from './fixtures/fakeGoogle';

let g: FakeGoogle;
let server: http.Server;
let base = '';
let cookie = '';
let db: any;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ribbonmere-google-'));

async function call(method: string, url: string, body?: any, extra: Record<string, string> = {}, jar = true) {
  const res = await fetch(base + url, {
    method, redirect: 'manual',
    headers: { 'x-ribbonmere': '1', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(jar && cookie ? { cookie } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const name = pair.split('=')[0];
    cookie = [...cookie.split('; ').filter((x) => x && !x.startsWith(`${name}=`)), ...(c.includes('Max-Age=0') ? [] : [pair])].join('; ');
  }
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, location: res.headers.get('location'), headers: res.headers };
}

before(async () => {
  g = await startFakeGoogle();
  const made = createApp({ dataDir, ownerPassword: 'correct horse', log: () => {}, google: googleConfigFromEnv(fakeGoogleEnv(g.url) as any, dataDir) });
  db = made.db;
  server = made.app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { server.close(); await g.close(); });

const tracker = () => g.sheets.get(TRACKER_ID)!.tabs.find((t) => t.title === 'Tracker')!;

test('visitors can do nothing; the owner sees an unconnected, configured status', async () => {
  for (const [m, r] of [['GET', 'status'], ['POST', 'connect'], ['POST', 'read'], ['POST', 'write'], ['POST', 'disconnect'], ['POST', 'picker-token']] as const) {
    assert.equal((await call(m, `/api/google/${r}`, m === 'POST' ? {} : undefined)).status, 401, r);
  }
  assert.equal((await call('POST', '/api/auth/login', { password: 'correct horse' })).status, 200);
  const st = await call('GET', '/api/google/status');
  assert.equal(st.json.configured, true);
  assert.equal(st.json.connected, false);
  assert.match(st.json.redirectUri, /\/api\/google\/callback$/);
  // POSTs without the custom header are refused (CSRF).
  assert.equal((await call('POST', '/api/google/connect', {}, { 'x-ribbonmere': '0' })).status, 403);
});

test('the OAuth return is refused without the matching state and cookie', async () => {
  const forged = await call('GET', '/api/google/callback?code=fake-code&state=abc.9999999999.sig', undefined, {}, false);
  assert.equal(forged.status, 302);
  assert.match(forged.location!, /google=error&reason=state/);
  // A real state, but from a different browser (no cookie): refused too.
  const { json } = await call('POST', '/api/google/connect', {});
  const state = new URL(json.url).searchParams.get('state')!;
  const stolen = await call('GET', `/api/google/callback?code=fake-code&state=${encodeURIComponent(state)}`, undefined, {}, false);
  assert.match(stolen.location!, /reason=state/);
  assert.equal((await call('GET', '/api/google/status')).json.connected, false);
});

test('connecting asks only for drive.file and keeps the token encrypted on the server', async () => {
  const { json } = await call('POST', '/api/google/connect', {});
  const auth = new URL(json.url);
  assert.equal(auth.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file');
  assert.equal(auth.searchParams.get('access_type'), 'offline');
  const toGoogle = await fetch(json.url, { redirect: 'manual' });
  const back = new URL(toGoogle.headers.get('location')!);
  const done = await call('GET', back.pathname + back.search);
  assert.equal(done.status, 302);
  assert.equal(done.location, '/atelier/books?google=connected');
  const st = await call('GET', '/api/google/status');
  assert.equal(st.json.connected, true);
  assert.equal(JSON.stringify(st.json).includes('rt-'), false, 'the refresh token never leaves the server');
  const stored = (db.prepare("SELECT value FROM meta WHERE key = 'google'").get() as any).value as string;
  assert.ok(stored.startsWith('v1.') && !stored.includes('rt-'), 'stored sealed');
  // …and isn't part of a backup.
  assert.equal(JSON.stringify((await call('GET', '/api/export')).json).includes(stored.slice(4, 30)), false);
  const pick = await call('POST', '/api/google/picker-token', {});
  assert.match(pick.json.accessToken, /^at-/);
  assert.equal(pick.json.appId, '123456');
});

test('sealed values only open with the right secret', async () => {
  const s = await seal('one secret', { a: 1 });
  assert.deepEqual(await unseal('one secret', s), { a: 1 });
  assert.equal(await unseal('another secret', s), null);
});

test('choosing the spreadsheet lists its tabs; reading returns values, formulas and raw values', async () => {
  assert.equal((await call('POST', '/api/google/select', { spreadsheet: 'not a link' })).status, 400);
  assert.equal((await call('POST', '/api/google/select', { spreadsheet: 'https://docs.google.com/spreadsheets/d/1NotPickedNotPickedNotPicked/edit' })).status, 404);
  const sel = await call('POST', '/api/google/select', { spreadsheet: `https://docs.google.com/spreadsheets/d/${TRACKER_ID}/edit#gid=1234` });
  assert.equal(sel.status, 200);
  assert.deepEqual(sel.json.tabs.map((t: any) => t.title), ['Dashboard', 'Tracker', 'Wishlist']);
  const grid = (await call('POST', '/api/google/read', { gid: 1234 })).json as SheetGrid;
  assert.equal(grid.title, 'Tracker');
  assert.equal(grid.rows[2][1].v, 'BOOK TITLE');
  assert.equal(grid.rows[3][0].f, '=ROW()-3');
  assert.equal(grid.rows[3][6].u, 45933);
  assert.match(grid.rows[3][2].f!, /^=IMAGE\("https:/);
  assert.equal(g.writes.length, 0, 'reading never writes');
});

test('writes are refused until two-way is on, and two-way needs a Drive backup first', async () => {
  const one = { gid: 1234, writes: [{ row: 5, col: 19, value: 'x', input: 'RAW', expect: 'Soft and salty.', guard: { col: 1, expect: 'Lanterns at Low Tide' } }] };
  assert.equal((await call('POST', '/api/google/write', one)).status, 403);
  assert.equal((await call('POST', '/api/google/writes', { allow: true })).status, 409);
  const b = await call('POST', '/api/google/backup', {});
  assert.equal(b.status, 200);
  assert.match(b.json.name, /^My book tracker <3 — Ribbonmere backup /);
  assert.equal(g.copies.length, 1);
  assert.equal((await call('POST', '/api/google/writes', { allow: true })).json.allowWrites, true);
  assert.equal((await call('GET', '/api/google/status')).json.backup.id, g.copies[0]);
});

test('every write safeguard holds: moved rows, changed cells, formulas, blanking, formula injection', async () => {
  const w = (o: any) => ({ row: 5, col: 19, value: 'Lovely.', input: 'RAW', expect: 'Soft and salty.', guard: { col: 1, expect: 'Lanterns at Low Tide' }, ...o });
  const r = await call('POST', '/api/google/write', { gid: 1234, writes: [
    w({}),
    w({ row: 6, guard: { col: 1, expect: 'Lanterns at Low Tide' } }), // that row holds another book now
    w({ row: 4, expect: 'Old words', guard: { col: 1, expect: 'The Glass Orchard' } }), // changed in the sheet since
    w({ row: 4, col: 0, expect: '1', guard: { col: 1, expect: 'The Glass Orchard' } }), // NO. is a formula
    w({ row: 6, value: '', expect: '', guard: { col: 1, expect: 'Hollow Crown Hymns' } }), // empty → empty is fine
    w({ row: 7, col: 19, value: '', expect: '', guard: { col: 1, expect: 'A Study in Quiet' } }),
  ] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.results.map((x: any) => x.reason ?? 'ok'), ['ok', 'moved', 'changed', 'formula', 'ok', 'ok']);
  assert.equal(tracker().rows[4][19].v, 'Lovely.');
  assert.equal(tracker().rows[3][0].f, '=ROW()-3', 'formula untouched');
  // Emptying a filled cell needs an explicit yes.
  const blank = await call('POST', '/api/google/write', { gid: 1234, writes: [w({ value: '', expect: 'Lovely.' })] });
  assert.equal(blank.json.results[0].reason, 'clear');
  assert.equal(tracker().rows[4][19].v, 'Lovely.');
  // Text is always written raw, so "=..." from Ribbonmere can never become a formula…
  await call('POST', '/api/google/write', { gid: 1234, writes: [w({ value: '=IMPORTXML("https://evil.example","//a")', expect: 'Lovely.' })] });
  assert.equal(g.writes[g.writes.length - 1].input, 'RAW');
  // …and parsed input is only accepted for plain dates and times.
  assert.equal((await call('POST', '/api/google/write', { gid: 1234, writes: [w({ value: '=1+1', input: 'USER_ENTERED' })] })).status, 400);
  assert.equal((await call('POST', '/api/google/write', { gid: 1234, writes: [w({ col: 6, value: '2025-09-02', input: 'USER_ENTERED', expect: '1 Sept 25' })] })).json.results[0].ok, true);
  assert.equal(tracker().rows[4][6].v, '2 Sep 25', 'the cell keeps its own date format');
  // No route deletes or clears anything.
  for (const route of ['delete', 'clear', 'rows', 'overwrite']) assert.equal((await call('POST', `/api/google/${route}`, {})).status, 404);
});

test('a failed Google request changes nothing and is reported', async () => {
  const before = JSON.stringify(tracker().rows);
  g.failNext(500, 3);
  const r = await call('POST', '/api/google/read', { gid: 1234 });
  assert.equal(r.status, 502);
  assert.match(r.json.error, /Google/);
  assert.equal(JSON.stringify(tracker().rows), before);
  g.failNext(0, 0);
});

test('a plan from the real handler output round-trips: a Ribbonmere edit lands in the right cell', async () => {
  const grid = (await call('POST', '/api/google/read', { gid: 1234 })).json as SheetGrid;
  const m = suggestMapping(grid, ['Read', 'Currently Reading']);
  const config = { spreadsheetId: TRACKER_ID, spreadsheetName: 'x', gid: 1234, sheetTitle: 'Tracker', headerRow: m.headerRow, columns: m.columns, roomId: 'library', visibility: 'private' as const };
  const first = planSync({ config, grid, books: [], twoWay: true });
  const books = first.creates.map((c, i) => ({ id: `b${i}`, roomId: 'library', data: { ...c.data, sheetLink: c.link } as Record<string, any> }));
  books.find((b) => b.data.title === 'Paper Swans')!.data.spice = 4;
  const plan = planSync({ config, grid, books, twoWay: true });
  assert.equal(plan.writes.length, 1);
  const res = await call('POST', '/api/google/write', { gid: 1234, writes: plan.writes });
  assert.deepEqual(res.json.results, [{ ok: true }]);
  assert.equal(tracker().rows[7][17].v, '🌶️🌶️🌶️🌶️');
});

test('disconnecting revokes the token and forgets it; the sheet is untouched', async () => {
  const before = JSON.stringify(tracker().rows);
  const r = await call('POST', '/api/google/disconnect', {});
  assert.deepEqual(r.json, { ok: true, revoked: true });
  assert.equal(g.revoked.size, 1);
  assert.equal((await call('GET', '/api/google/status')).json.connected, false);
  assert.equal(db.prepare("SELECT 1 FROM meta WHERE key = 'google'").get(), undefined);
  assert.equal((await call('POST', '/api/google/read', { gid: 1234 })).status, 409);
  assert.equal(JSON.stringify(tracker().rows), before);
});

test('the picker page carries its own strict policy', async () => {
  const r = await call('GET', '/api/google/picker');
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy')!;
  assert.match(csp, /script-src 'nonce-[\w-]+' https:\/\/apis\.google\.com/);
  assert.match(csp, /default-src 'none'/);
  assert.match(String(r.json), /rm-picker-ready/);
  assert.match(String(r.json), /e\.origin !== location\.origin/);
});
