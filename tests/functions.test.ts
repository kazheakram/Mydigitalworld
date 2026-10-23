// Tests for the Cloudflare Pages Functions, run inside Cloudflare's local runtime (wrangler/workerd)
// with a local KV store. Run with:  npm run build && npm run test:functions
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = 'Ow9nerUid0000000000000000000a';
const STRANGER = 'SomeoneElse0000000000000000a';
const PROJECT = 'demo-ribbonmere';
const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
let wrangler: ChildProcess;
let fixture: http.Server;
let fixtureBase = '';
const state = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-wrangler-'));

// Same shape as the Firebase Auth emulator's tokens (unsigned), accepted only because AUTH_EMULATOR=1.
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub: string, o: Record<string, unknown> = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub, iat: now, exp: now + 3600, ...o })}.`;
};
const auth = (sub = OWNER) => ({ authorization: `Bearer ${token(sub)}` });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  fixture = http.createServer((req, res) => {
    if (req.url === '/feed.xml') { res.setHeader('content-type', 'application/rss+xml'); res.end('<rss><channel><title>T</title></channel></rss>'); }
    else if (req.url === '/redirect') { res.statusCode = 302; res.setHeader('location', '/feed.xml'); res.end(); }
    else { res.statusCode = 404; res.end(); }
  }).listen(0);
  fixtureBase = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  wrangler = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', String(PORT), '--kv', 'MEDIA', '--persist-to', state,
    '--compatibility-date=2025-09-01',
    '--binding', `VITE_FIREBASE_CONFIG={"apiKey":"k","projectId":"${PROJECT}"}`,
    '--binding', `VITE_OWNER_UID=${OWNER}`, '--binding', 'MEDIA_SECRET=test-secret-that-is-long-enough-123',
    '--binding', 'AUTH_EMULATOR=1', '--binding', 'ALLOW_PRIVATE_FETCH=1'],
  { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('wrangler did not start')), 90_000);
    wrangler.stdout!.on('data', (d) => { if (String(d).includes('Ready on')) { clearTimeout(t); resolve(); } });
  });
});
after(() => {
  try { process.kill(-wrangler.pid!, 'SIGTERM'); } catch { /* already gone */ }
  fixture?.close();
  fs.rmSync(state, { recursive: true, force: true });
});

const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('health check reports configuration without secrets', async () => {
  const h = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(h.ownerConfigured, true);
  assert.equal(h.mediaStorage, true);
  assert.equal(h.mediaSecret, true);
  assert.ok(!JSON.stringify(h).includes('test-secret'));
});

test('feed fetcher is owner-only and refuses bad tokens', async () => {
  const url = `${fixtureBase}/feed.xml`;
  assert.equal((await post('/api/fetch', { url })).status, 401);
  assert.equal((await post('/api/fetch', { url }, auth(STRANGER))).status, 403);
  const wrongProject = { authorization: `Bearer ${token(OWNER, { aud: 'other-project', iss: 'https://securetoken.google.com/other-project' })}` };
  assert.equal((await post('/api/fetch', { url }, wrongProject)).status, 401);
  const expired = { authorization: `Bearer ${token(OWNER, { exp: Math.floor(Date.now() / 1000) - 10 })}` };
  assert.equal((await post('/api/fetch', { url }, expired)).status, 401);
  const ok = await post('/api/fetch', { url: `${fixtureBase}/redirect` }, auth());
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.match(body.text, /<rss>/);
  assert.match(body.finalUrl, /feed\.xml$/);
  assert.equal((await post('/api/fetch', { url: 'file:///etc/passwd' }, auth())).status, 422);
  assert.equal((await post('/api/fetch', { url: `${fixtureBase}/missing` }, auth())).status, 422);
});

test('uploads are owner-only, validated, private by default, and private images stay private', async () => {
  const up = (body: Buffer, headers: Record<string, string> = {}) => fetch(`${BASE}/api/media`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', ...headers }, body });
  assert.equal((await up(PNG)).status, 401);
  assert.equal((await up(PNG, auth(STRANGER))).status, 403);
  assert.equal((await up(Buffer.from('<html><script>alert(1)</script></html>'), auth())).status, 415);
  assert.equal((await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="4"/></svg>'), auth())).status, 415);
  const res = await up(PNG, auth());
  assert.equal(res.status, 201);
  const { id, url, visibility } = await res.json();
  assert.match(id, /^[a-f0-9]{32}$/, 'random, unguessable id');
  assert.equal(visibility, 'private');

  // A visitor (no cookie) cannot see it — and gets the same 404 as for an image that doesn't exist.
  assert.equal((await fetch(BASE + url)).status, 404);
  assert.equal((await fetch(`${BASE}/media/${'0'.repeat(32)}`)).status, 404);
  // Forged or stolen-from-another-account cookies don't work.
  assert.equal((await fetch(BASE + url, { headers: { cookie: `rm_media=${OWNER}.9999999999.forged` } })).status, 404);
  assert.equal((await post('/api/session', {}, auth(STRANGER))).status, 403);

  // The owner gets a signed cookie and can see it; it is never cached publicly.
  const s = await post('/api/session', {}, auth());
  assert.equal(s.status, 200);
  const setCookie = s.headers.get('set-cookie')!;
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Path=\/media/);
  const cookie = setCookie.split(';')[0];
  const mine = await fetch(BASE + url, { headers: { cookie } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get('content-type'), 'image/png');
  assert.match(mine.headers.get('cache-control')!, /private, no-store/);
  assert.match(mine.headers.get('content-security-policy')!, /sandbox/);

  // Publishing makes it visible to everyone; un-publishing hides it again.
  assert.equal((await fetch(`${BASE}/api/media/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visibility: 'public' }) })).status, 401);
  assert.equal((await post('/api/media/visibility', { ids: [id], visibility: 'public' }, auth(STRANGER))).status, 403);
  assert.equal((await post('/api/media/visibility', { ids: [id], visibility: 'public' }, auth())).status, 200);
  const pub = await fetch(BASE + url);
  assert.equal(pub.status, 200);
  assert.match(pub.headers.get('cache-control')!, /public/);
  assert.equal((await fetch(`${BASE}/api/media/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...auth() }, body: JSON.stringify({ visibility: 'private' }) })).status, 200);
  assert.equal((await fetch(BASE + url)).status, 404, 'private again (local edge cache cleared)');

  // Deleting is owner-only.
  assert.equal((await fetch(`${BASE}/api/media/${id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await fetch(`${BASE}/api/media/${id}`, { method: 'DELETE', headers: auth() })).status, 200);
  assert.equal((await fetch(BASE + url, { headers: { cookie } })).status, 404);
});

test('the website itself is served, with single-page fallback for deep links', async () => {
  const home = await fetch(`${BASE}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<div id="root">/);
  const deep = await fetch(`${BASE}/room/library`);
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /<div id="root">/);
});
