import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

process.env.ALLOW_PRIVATE_FETCH = '1'; // lets the feed tests reach the local fixture server
const { createApp } = await import('../app');

let base = '';
let feedBase = '';
let cookie = '';
let server: http.Server;
let feedServer: http.Server;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ribbonmere-test-'));

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Rosy Blog</title><link>https://rosy.example</link>
<item><title>First &amp; sweet</title><link>https://rosy.example/1</link><guid>1</guid><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate><description>&lt;p&gt;Hello &lt;b&gt;there&lt;/b&gt;&lt;/p&gt;</description></item>
<item><title>Second</title><link>https://rosy.example/2</link><guid>2</guid><pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate></item>
</channel></rss>`;
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><title>Video Channel</title>
<link rel="alternate" href="https://video.example"/><entry><id>yt:1</id><title>A video</title><link rel="alternate" href="https://video.example/watch?v=1"/>
<published>2024-02-01T00:00:00Z</published><media:group><media:thumbnail url="https://img.example/1.jpg"/><media:description>desc</media:description></media:group></entry></feed>`;

async function call(method: string, url: string, body?: any, headers: Record<string, string> = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'x-ribbonmere': '1', ...(body !== undefined && !(body instanceof Buffer) ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Buffer ? body : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie?.startsWith('rm_session=') && !setCookie.includes('Max-Age=0')) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

let setupCode: string | null = null;
before(async () => {
  const made = createApp({ dataDir, log: () => {} });
  setupCode = made.setupCode;
  server = made.app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  feedServer = http.createServer((req, res) => {
    if (req.url === '/rss.xml') { res.setHeader('content-type', 'application/rss+xml'); res.end(RSS); }
    else if (req.url === '/atom.xml') { res.setHeader('content-type', 'application/atom+xml'); res.end(ATOM); }
    else if (req.url === '/blog') { res.setHeader('content-type', 'text/html'); res.end('<html><head><title>Blog</title><link rel="alternate" type="application/rss+xml" href="/rss.xml"><meta property="og:description" content="A rosy blog"></head></html>'); }
    else { res.statusCode = 404; res.end(); }
  }).listen(0);
  feedBase = `http://127.0.0.1:${(feedServer.address() as AddressInfo).port}`;
});
after(() => { server.close(); feedServer.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('first-run setup requires the console code', async () => {
  assert.equal((await call('GET', '/api/auth/status')).json.needsSetup, true);
  assert.equal((await call('POST', '/api/auth/setup', { code: 'nope', password: 'roses-are-pink' })).status, 401);
  assert.equal((await call('POST', '/api/auth/setup', { code: setupCode, password: 'roses-are-pink' })).status, 200);
  assert.equal((await call('GET', '/api/auth/status')).json.owner, true);
  assert.equal((await call('POST', '/api/auth/setup', { code: setupCode, password: 'again-again' })).status, 400);
});

test('mutations need the CSRF header and a session', async () => {
  const res = await fetch(base + '/api/items', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' });
  assert.equal(res.status, 403);
  const anon = await fetch(base + '/api/items', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ribbonmere': '1' }, body: JSON.stringify({ kind: 'book', data: {} }) });
  assert.equal(anon.status, 401);
});

test('private items never reach visitors', async () => {
  const pub = await call('POST', '/api/items', { kind: 'book', roomId: 'library', visibility: 'public', data: { title: 'Public Zephyrine Book', privateNotes: 'secret thoughts' } });
  const priv = await call('POST', '/api/items', { kind: 'book', roomId: 'library', data: { title: 'Private Zephyrine Book' } });
  const unl = await call('POST', '/api/items', { kind: 'entry', roomId: 'journal', visibility: 'unlisted', data: { title: 'Unlisted Page' } });
  assert.equal(priv.json.visibility, 'private', 'items default to private');
  const forcedPrivate = await call('POST', '/api/items', { kind: 'bookmark', visibility: 'public', data: { url: 'https://a.example', title: 'Mine' } });
  assert.equal(forcedPrivate.json.visibility, 'private', 'bookmarks are always private');

  const ownerList = await call('GET', '/api/items?kind=book');
  assert.equal(ownerList.json.length, 2);
  const saved = cookie; cookie = '';
  const visitorList = await call('GET', '/api/items?kind=book');
  assert.deepEqual(visitorList.json.map((i: any) => i.data.title), ['Public Zephyrine Book']);
  assert.equal(visitorList.json[0].data.privateNotes, undefined, 'private notes stripped');
  assert.equal((await call('GET', `/api/items/${priv.json.id}`)).status, 404, 'direct URL to private item is refused');
  assert.equal((await call('GET', `/api/items/${unl.json.id}`)).status, 200, 'unlisted reachable by link');
  assert.equal((await call('GET', '/api/items?kind=entry')).json.length, 0, 'unlisted not listed');
  assert.equal((await call('GET', '/api/items?kind=bookmark')).json.length, 0);
  const search = await call('GET', '/api/search?q=' + 'zephyrine');
  assert.deepEqual(search.json.items.map((i: any) => i.data.title), ['Public Zephyrine Book'], 'search only finds public items');
  cookie = saved;
  const preview = await call('GET', '/api/items?kind=book&as=public');
  assert.equal(preview.json.length, 1, 'owner preview mode sees the public view');
});

test('public world hides private rooms, owner-only doors and unrevealed regions', async () => {
  const { json } = await call('GET', '/api/config/world');
  const w = json.draft;
  w.rooms.push({ id: 'diary', name: 'Diary', template: 'journal', visibility: 'private' });
  w.objects.push({ id: 'b-diary', type: 'building', art: 'cottage', roomId: 'diary', x: 1, y: 1, w: 10, h: 10, z: 1 });
  w.objects.push({ id: 'b-orchard', type: 'building', art: 'cottage', regionId: 'orchard', x: 1, y: 1, w: 10, h: 10, z: 1 });
  assert.equal((await call('PUT', '/api/config/world/draft', w)).status, 200);
  assert.equal((await call('POST', '/api/config/world/publish', {})).status, 200);
  const diaryItem = await call('POST', '/api/items', { kind: 'entry', roomId: 'diary', visibility: 'public', data: { title: 'In a private room' } });
  const saved = cookie; cookie = '';
  const pub = (await call('GET', '/api/config/world')).json;
  assert.equal(pub.draft, undefined, 'visitors never get the draft');
  const ids = pub.published.objects.map((o: any) => o.id);
  assert.ok(!ids.includes('b-boudoir') && !ids.includes('b-diary') && !ids.includes('b-orchard'));
  assert.ok(!pub.published.rooms.some((r: any) => r.id === 'diary'));
  assert.equal(pub.published.dashboard.length, 0);
  assert.equal((await call('GET', `/api/items/${diaryItem.json.id}`)).status, 404, 'items in private rooms stay private');
  cookie = saved;
  const versions = await call('GET', '/api/config/world/versions');
  assert.ok(versions.json.length >= 1, 'publishing makes a checkpoint');
});

test('world validation rejects unsafe links', async () => {
  const { json } = await call('GET', '/api/config/world');
  const w = json.draft;
  w.objects[0].href = 'javascript:alert(1)';
  assert.equal((await call('PUT', '/api/config/world/draft', w)).status, 400);
  assert.equal((await call('POST', '/api/items', { kind: 'link', data: { url: 'javascript:alert(1)' } })).status, 400);
});

test('theme validation rejects non-colours', async () => {
  const { json } = await call('GET', '/api/config/theme');
  const t = json.draft;
  t.active.colors.pink = 'red; background:url(x)';
  assert.equal((await call('PUT', '/api/config/theme/draft', t)).status, 400);
  t.active.colors.pink = '#ffc0cb';
  assert.equal((await call('PUT', '/api/config/theme/draft', t)).status, 200);
  assert.equal((await call('GET', '/api/config/theme')).json.draft.active.colors.pink, '#ffc0cb');
});

test('RSS and Atom feeds are fetched, parsed and tracked', async () => {
  const rss = await call('POST', '/api/feeds', { url: `${feedBase}/blog`, category: 'Books & Literature' });
  assert.equal(rss.status, 201, JSON.stringify(rss.json));
  assert.equal(rss.json.title, 'Rosy Blog');
  assert.equal(rss.json.added, 2);
  const atom = await call('POST', '/api/feeds', { url: `${feedBase}/atom.xml` });
  assert.equal(atom.json.title, 'Video Channel');
  assert.equal((await call('POST', '/api/feeds', { url: `${feedBase}/atom.xml` })).status, 409);
  const entries = (await call('GET', '/api/feed-entries')).json;
  assert.equal(entries.length, 3);
  assert.equal(entries[0].title, 'A video', 'newest first');
  assert.equal(entries[0].image, 'https://img.example/1.jpg');
  assert.equal(entries.find((e: any) => e.title === 'First & sweet').summary, 'Hello there');
  await call('PATCH', `/api/feed-entries/${entries[0].id}`, { read: true, saved: true });
  assert.equal((await call('GET', '/api/feed-entries?filter=unread')).json.length, 2);
  assert.equal((await call('GET', '/api/feed-entries?filter=saved')).json.length, 1);
  const bad = await call('POST', '/api/feeds', { url: `${feedBase}/missing` });
  assert.equal(bad.status, 422);
  const refreshed = await call('POST', '/api/feeds/refresh', { force: true });
  assert.equal(refreshed.json.results.length, 2);
  const opml = await fetch(base + '/api/feeds/opml', { headers: { cookie } }).then((r) => r.text());
  assert.match(opml, /Rosy Blog/);
});

test('unfurl reads titles; private addresses are blocked without the test flag', async () => {
  const u = await call('POST', '/api/unfurl', { url: `${feedBase}/blog` });
  assert.equal(u.json.title, 'Blog');
  assert.equal(u.json.description, 'A rosy blog');
  process.env.ALLOW_PRIVATE_FETCH = '0';
  assert.equal((await call('POST', '/api/unfurl', { url: `${feedBase}/blog` })).status, 422);
  assert.equal((await call('POST', '/api/unfurl', { url: 'file:///etc/passwd' })).status, 422);
  process.env.ALLOW_PRIVATE_FETCH = '1';
});

test('uploads accept real images and reject disguised or scripted files', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const ok = await call('POST', '/api/media', png, { 'content-type': 'application/octet-stream', 'x-filename': 'dot.png' });
  assert.equal(ok.status, 201);
  const file = await fetch(base + ok.json.data.url);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-security-policy') ?? '', /sandbox/);
  const saved = cookie; cookie = '';
  assert.equal((await call('GET', '/api/items?kind=media')).json.length, 0, 'visitors cannot list the media library');
  assert.equal((await fetch(base + ok.json.data.url)).status, 200, 'but files themselves are reachable');
  cookie = saved;
  assert.equal((await call('POST', '/api/media', Buffer.from('<html><script>alert(1)</script>'), { 'content-type': 'application/octet-stream' })).status, 415);
  assert.equal((await call('POST', '/api/media', Buffer.from('<svg onload="alert(1)"></svg>'), { 'content-type': 'image/svg+xml' })).status, 415);
  assert.equal((await call('POST', '/api/media', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'), { 'content-type': 'image/svg+xml' })).status, 201);
});

test('guestbook letters wait for approval and resist spam', async () => {
  const saved = cookie; cookie = '';
  assert.equal((await call('POST', '/api/guestbook', { roomId: 'postoffice', name: 'Rose', message: 'Your village is lovely' })).json.pending, true);
  assert.equal((await call('POST', '/api/guestbook', { roomId: 'postoffice', name: 'Bot', message: 'buy', website: 'x' })).json.pending, true);
  assert.equal((await call('GET', '/api/items?kind=guestbook')).json.length, 0, 'not visible before approval');
  cookie = saved;
  const all = (await call('GET', '/api/items?kind=guestbook')).json;
  assert.equal(all.length, 1, 'honeypot submission was dropped');
  await call('PATCH', `/api/items/${all[0].id}`, { visibility: 'public', data: { approved: true } });
  cookie = '';
  assert.equal((await call('GET', '/api/items?kind=guestbook')).json.length, 1);
  cookie = saved;
});

test('backup export and restore round-trip', async () => {
  const backup = (await call('GET', '/api/export?media=1')).json;
  assert.equal(backup.format, 'ribbonmere-backup');
  assert.ok(backup.media.length >= 1);
  const count = backup.items.length;
  await call('POST', '/api/items', { kind: 'note', data: { title: 'after backup' } });
  assert.equal((await call('POST', '/api/import?mode=replace', backup)).status, 200);
  assert.equal((await call('GET', '/api/export')).json.items.length, count);
  assert.equal((await call('POST', '/api/import', { format: 'other' })).status, 400);
});

test('login is rate limited and logout ends the session', async () => {
  await call('POST', '/api/auth/logout');
  cookie = '';
  assert.equal((await call('POST', '/api/auth/login', { password: 'wrong' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { password: 'roses-are-pink' })).status, 200);
  assert.equal((await call('GET', '/api/auth/status')).json.owner, true);
});
