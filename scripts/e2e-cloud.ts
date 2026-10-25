// End-to-end test of the Cloudflare Pages + Firebase version, run entirely on this machine:
//   • Firebase Auth + Firestore → the official Firebase emulators (with the real security rules)
//   • Cloudflare Pages + Functions + KV → wrangler (Cloudflare's local runtime)
//   • the website → the real production build, driven in Chromium
//
//   npm run test:cloud
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PROJECT = 'demo-ribbonmere';
const PORT = 8899;
const BASE = `http://localhost:${PORT}`;
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const EMAIL = 'kira@example.com';
const PASSWORD = 'pink-ribbons-forever';
const OUT = path.resolve('docs/screenshots/cloud');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-cloud-e2e-'));
const procs: ChildProcess[] = [];
const step = (s: string) => console.log(`  ✓ ${s}`);
const errors: string[] = [];
fs.mkdirSync(OUT, { recursive: true });

function start(cmd: string, args: string[], ready: RegExp, env: Record<string, string> = {}, timeout = 120_000) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  procs.push(p);
  let log = '';
  return new Promise<ChildProcess>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${cmd} ${args[0]} did not start:\n${log.slice(-2000)}`)), timeout);
    const on = (d: Buffer) => { log += d; if (ready.test(log)) { clearTimeout(t); resolve(p); } };
    p.stdout!.on('data', on); p.stderr!.on('data', on);
  });
}
function stopAll() { for (const p of procs) { try { process.kill(-p.pid!, 'SIGTERM'); } catch { /* gone */ } } }

/** Read Firestore directly as an administrator (emulator only) to check what really got stored. */
async function adminList(col: string): Promise<{ id: string; f: any }[]> {
  const r = await fetch(`${FS}/${col}?pageSize=500`, { headers: { authorization: 'Bearer owner' } });
  const j = await r.json();
  return (j.documents ?? []).map((d: any) => ({ id: d.name.split('/').pop(), f: d.fields }));
}
const title = (f: any) => f?.data?.mapValue?.fields?.title?.stringValue;

let fixture: http.Server;
let browser: Browser;
try {
  // ── 1. Firebase emulators, owner account, real rules with the owner's ID ──
  console.log('Starting Firebase emulators…');
  await start('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT], /All emulators ready/);
  const signUp = await (await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  })).json();
  const OWNER = signUp.localId as string;
  assert.match(OWNER, /^[A-Za-z0-9]{10,128}$/);
  const rules = fs.readFileSync('firestore.rules', 'utf8').replaceAll('PASTE_YOUR_USER_ID_HERE', OWNER);
  const put = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
  });
  assert.equal(put.status, 200, 'rules loaded into the emulator');

  // ── 2. Build the site exactly as Cloudflare would, pointed at the emulators ──
  console.log('Building the cloud version…');
  const firebaseConfig = JSON.stringify({ apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:1:web:1' });
  execSync('npx vite build --outDir dist-cloud --emptyOutDir', {
    stdio: 'ignore',
    env: { ...process.env, VITE_BACKEND: 'firebase', VITE_FIREBASE_CONFIG: firebaseConfig, VITE_OWNER_UID: OWNER, VITE_USE_EMULATORS: '1' },
  });

  // A local RSS feed for the reader to follow.
  fixture = http.createServer((req, res) => {
    if (req.url === '/blog') { res.setHeader('content-type', 'text/html'); res.end('<html><head><title>Rosy Blog</title><link rel="alternate" type="application/rss+xml" href="/rss.xml"><meta property="og:description" content="A rosy blog"></head></html>'); return; }
    res.setHeader('content-type', 'application/rss+xml');
    res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Rosy Blog</title><link>https://rosy.example</link>
      <item><title>On pressed flowers</title><link>https://rosy.example/1</link><guid>1</guid><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate><description>Petals between pages</description></item>
      <item><title>A letter to autumn</title><link>https://rosy.example/2</link><guid>2</guid><pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate></item></channel></rss>`);
  }).listen(0);
  const feedBase = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;

  console.log('Starting Cloudflare Pages (wrangler)…');
  await start('npx', ['wrangler', 'pages', 'dev', 'dist-cloud', '--port', String(PORT), '--kv', 'MEDIA', '--persist-to', path.join(work, 'kv'),
    '--compatibility-date=2025-09-01', '--binding', `VITE_FIREBASE_CONFIG=${firebaseConfig}`, '--binding', `VITE_OWNER_UID=${OWNER}`,
    '--binding', 'MEDIA_SECRET=e2e-secret-value-that-is-long-enough', '--binding', 'AUTH_EMULATOR=1', '--binding', 'ALLOW_PRIVATE_FETCH=1'],
  /Ready on/, { WRANGLER_SEND_METRICS: 'false' });

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  const watch = (p: Page, who: string) => {
    p.on('pageerror', (e) => errors.push(`${who} pageerror: ${e.message}`));
    p.on('console', (m) => {
      const t = m.text();
      if (process.env.DEBUG_CONSOLE) console.log(`[${who}] ${m.type()}: ${t.slice(0, 300)}`);
      if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|emulator|WebChannelConnection|Could not reach Cloud Firestore|BloomFilter/i.test(t)) errors.push(`${who} console: ${t}`);
    });
  };
  const newPage = async (ctx: BrowserContext, who: string) => { const p = await ctx.newPage(); watch(p, who); return p; };
  const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`) });
  const enter = async (p: Page) => { const b = p.getByRole('button', { name: /untie the ribbon/i }); if (await b.isVisible().catch(() => false)) { await b.click(); await p.waitForTimeout(1000); } };

  // ── 3. Owner signs in on "device A"; the starting village is planted ──
  const deviceA = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  const a = await newPage(deviceA, 'owner A');
  await a.goto(`${BASE}/login`);
  await a.getByLabel('Email').fill(EMAIL);
  await a.getByLabel('Password').fill(PASSWORD);
  await a.getByRole('button', { name: /step inside/i }).click();
  await a.waitForURL(/dollhouse/);
  await a.getByRole('heading', { name: 'Dollhouse Mode', level: 1 }).waitFor();
  let planted = false;
  for (let i = 0; i < 40 && !planted; i++) { await a.waitForTimeout(500); planted = (await adminList('config')).some((d) => d.id === 'world_public'); }
  assert.ok(planted, 'village planted and published');
  await a.getByText('☁ synced').waitFor({ timeout: 20_000 });
  await shot(a, '01-dollhouse-cloud');
  step('owner signs in with email + password; starting village is planted; sync badge says synced');

  await a.goto(`${BASE}/setup`);
  await a.getByText('Firestore security rules contain your user ID').waitFor();
  await a.waitForTimeout(1500);
  const marks = await a.locator('.setup-mark').evaluateAll((els) => els.map((e) => e.textContent));
  assert.deepEqual(marks, ['✅', '✅', '✅', '✅', '✅', '✅', '✅'], `setup checklist all green (${marks.join(' ')})`);
  await shot(a, '02-setup-checklist');
  step('setup checklist: functions, Firebase, owner, rules, KV, secret all detected');

  // ── 4. Content: public + private books, owner-only notes ──
  await a.goto(`${BASE}/room/library`);
  const addBook = async (t: string, vis: RegExp, extra: Record<string, string> = {}) => {
    await a.getByRole('button', { name: '+ Add a book' }).click();
    await a.getByLabel('Title').fill(t);
    for (const [k, v] of Object.entries(extra)) await a.getByRole('textbox', { name: new RegExp(`^${k}`) }).fill(v);
    await a.getByRole('radio', { name: vis }).click();
    await a.getByRole('button', { name: 'Save', exact: true }).click();
    await a.getByRole('button', { name: new RegExp(t, 'i') }).waitFor();
  };
  await addBook('The Bell Jar', /public/i, { 'Private notes': 'Reread in winter. Only for me.' });
  await addBook('My Secret Reading List', /private/i);
  await a.reload();
  await a.getByRole('button', { name: /the bell jar/i }).waitFor();
  await a.getByRole('button', { name: /my secret reading list/i }).waitFor();
  await a.getByRole('button', { name: /the bell jar/i }).click();
  await a.getByText('Reread in winter. Only for me.').waitFor();
  await a.keyboard.press('Escape');
  step('books save to Firestore and survive a reload; owner sees private notes');

  await a.waitForTimeout(1500);
  const stored = await adminList('items');
  const bell = stored.find((d) => title(d.f) === 'The Bell Jar')!;
  const secret = stored.find((d) => title(d.f) === 'My Secret Reading List')!;
  assert.ok(bell && secret);
  assert.equal(bell.f.data.mapValue.fields.privateNotes, undefined, 'private notes are NOT inside the readable document');
  assert.ok((await adminList('items_private')).some((d) => d.id === bell.id), 'private notes live in the owner-only collection');

  // ── 5. A visitor ──
  const visitorCtx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const v = await newPage(visitorCtx, 'visitor');
  await v.goto(BASE);
  await enter(v);
  await shot(v, '03-village-visitor');
  assert.equal(await v.locator('[data-id="b-boudoir"]').count(), 0, 'no private-wing door for visitors');
  await v.goto(`${BASE}/room/library`);
  await v.getByRole('button', { name: /the bell jar/i }).waitFor({ timeout: 15_000 });
  assert.equal(await v.getByRole('button', { name: /my secret reading list/i }).count(), 0);
  await v.getByRole('button', { name: /the bell jar/i }).click();
  await v.getByText('No review written yet.').waitFor();
  assert.equal(await v.getByText('Reread in winter').count(), 0, 'visitor never sees private notes');
  await v.keyboard.press('Escape');
  // Straight at the database, the way an attacker would try:
  const raw = async (p: string) => (await fetch(`${FS}/${p}`)).status;
  assert.equal(await raw(`items/${secret.id}`), 403, 'private item refused by Firestore');
  assert.equal(await raw(`items_private/${bell.id}`), 403, 'owner-only notes refused by Firestore');
  assert.equal(await raw('config/world_draft'), 403, 'unpublished draft refused');
  assert.equal(await raw(`items/${bell.id}`), 200, 'public item readable');
  assert.equal((await fetch(`${FS}/items`)).status, 403, 'listing everything refused');
  step('visitor sees the public book only; Firestore itself refuses private items, private notes and drafts');

  // ── 6. Cross-device sync: device B sees device A's change live ──
  const deviceB = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const bpage = await newPage(deviceB, 'owner B');
  await bpage.goto(`${BASE}/login`);
  await bpage.getByLabel('Email').fill(EMAIL);
  await bpage.getByLabel('Password').fill(PASSWORD);
  await bpage.getByRole('button', { name: /step inside/i }).click();
  await bpage.waitForURL(/dollhouse/);
  await bpage.goto(`${BASE}/room/library`);
  await bpage.getByRole('button', { name: /the bell jar/i }).waitFor();
  await addBook('Letters to a Young Poet', /public/i);
  await bpage.getByRole('button', { name: /letters to a young poet/i }).waitFor({ timeout: 15_000 });
  step('a book added on device A appears on device B without reloading');

  // ── 7. Offline: changes wait on the device, then sync ──
  await deviceA.setOffline(true);
  await a.evaluate(() => window.dispatchEvent(new Event('offline')));
  await a.goto(`${BASE}/room/library`).catch(() => {});
  await a.getByRole('button', { name: '+ Add a book' }).click();
  await a.getByLabel('Title').fill('Written on a Train');
  await a.getByRole('button', { name: 'Save', exact: true }).click();
  await a.getByText(/☁ offline/).waitFor();
  await shot(a, '04-offline-badge');
  assert.ok(!(await adminList('items')).some((d) => title(d.f) === 'Written on a Train'), 'not in the cloud while offline');
  await deviceA.setOffline(false);
  await a.evaluate(() => window.dispatchEvent(new Event('online')));
  await a.getByText('☁ synced').waitFor({ timeout: 30_000 });
  await bpage.getByRole('button', { name: /written on a train/i }).waitFor({ timeout: 20_000 });
  step('offline edits are kept on the device, shown as waiting, and sync when back online');

  // ── 8. Images: private by default, public once used on a public page ──
  await a.goto(`${BASE}/atelier/media`);
  const png = path.join(work, 'bow.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAB0OAgFk9vBvAAAAAElFTkSuQmCC', 'base64'));
  await a.locator('input[type=file]').setInputFiles(png);
  await a.getByText(/1 image added/i).waitFor();
  await a.locator('.media-card img').first().waitFor();
  await a.waitForTimeout(500);
  const imgUrl = await a.locator('.media-card img').first().getAttribute('src');
  assert.match(imgUrl!, /^\/media\/[a-f0-9]{32}$/);
  const ownerSees = await a.evaluate(async () => { const img = document.querySelector('.media-card img') as HTMLImageElement; await img.decode(); return img.naturalWidth; });
  assert.equal(ownerSees, 2, 'owner sees the private image');
  assert.equal((await fetch(BASE + imgUrl)).status, 404, 'visitor cannot fetch a private image');
  const vSees = await v.evaluate(async (u) => (await fetch(u)).status, imgUrl!);
  assert.equal(vSees, 404, 'visitor browser cannot fetch a private image');
  await shot(a, '05-media-private');
  // Use it as the cover of a public book → it becomes public.
  await a.goto(`${BASE}/room/library`);
  await a.getByRole('button', { name: '+ Add a book' }).click();
  await a.getByLabel('Title').fill('Pressed Violets');
  await a.getByPlaceholder('…or paste an image link (https://)').waitFor();
  await a.getByRole('button', { name: 'From my media' }).click();
  await a.locator('.media-grid.mini button').first().click();
  await a.getByRole('radio', { name: /public/i }).click();
  await a.getByRole('button', { name: 'Save', exact: true }).click();
  await a.getByRole('button', { name: /pressed violets/i }).waitFor();
  let pubStatus = 0;
  for (let i = 0; i < 20 && pubStatus !== 200; i++) { await a.waitForTimeout(500); pubStatus = (await fetch(BASE + imgUrl)).status; }
  assert.equal(pubStatus, 200, 'image became public when used on a public book');
  step('uploads are private (404 for visitors) until used on something public, then visible');

  // ── 9. RSS reader through the Cloudflare function ──
  await a.goto(`${BASE}/dollhouse/favorites`);
  await a.getByRole('button', { name: '+ Follow someone' }).click();
  await a.getByLabel(/website, feed or youtube/i).fill(`${feedBase}/blog`);
  await a.getByRole('button', { name: 'Follow', exact: true }).click();
  await a.getByText(/now following rosy blog/i).waitFor({ timeout: 20_000 });
  await a.getByRole('link', { name: 'A letter to autumn' }).waitFor();
  await a.getByRole('button', { name: '♡ Save' }).first().click();
  await a.getByRole('button', { name: '♥ Saved' }).waitFor();
  await a.getByRole('button', { name: '↻ Refresh' }).click();
  await a.getByText(/all feeds refreshed/i).waitFor({ timeout: 20_000 });
  await shot(a, '06-reader-cloud');
  step('feed discovery, posts, saving and refresh all work through the Cloudflare function');

  // ── 10. Letterbox, bookmarks with previews, expeditions ──
  await a.goto(`${BASE}/dollhouse/inbox`);
  await a.getByLabel(/save a link/i).fill(`${feedBase}/blog`);
  await a.getByRole('button', { name: /save ✉/i }).click();
  await a.getByText(/tucked into the letterbox/i).waitFor();
  await a.getByRole('tab', { name: /resting/i }).click();
  await a.getByRole('button', { name: 'Peek anyway' }).click();
  await a.getByRole('link', { name: 'Rosy Blog' }).waitFor({ timeout: 15_000 });
  step('letterbox capture + cooldown; link preview fetched through the function');
  await a.goto(`${BASE}/stargirl/rabbit-holes`);
  await a.getByLabel('Name this expedition').fill('Letters of women writers');
  await a.getByRole('button', { name: /set out/i }).click();
  await a.getByLabel('Link or thought').fill('Read about epistolary novels');
  await a.getByRole('button', { name: 'Pocket it' }).click();
  await a.getByText('Read about epistolary novels').waitFor();
  step('expeditions work');

  // ── 11. Autosave: editing an existing item saves without pressing Save ──
  await a.goto(`${BASE}/room/library`);
  await a.getByRole('button', { name: /letters to a young poet/i }).click();
  await a.getByRole('button', { name: 'Edit book' }).click();
  await a.getByLabel('Author').fill('Rainer Maria Rilke');
  await a.getByText('autosaved ✓').waitFor({ timeout: 10_000 });
  await a.locator('form .btn.ghost', { hasText: 'Close' }).click();
  await a.waitForTimeout(1200);
  assert.ok((await adminList('items')).some((d) => d.f.data.mapValue.fields.author?.stringValue === 'Rainer Maria Rilke'), 'autosaved to Firestore');
  step('editing autosaves to the cloud');

  // ── 12. Map editor → draft → publish; theme ──
  await a.goto(`${BASE}/atelier`);
  const cottage = a.locator('.editor [data-id="b-welcome"] .hitbox');
  await cottage.waitFor();
  const box = (await cottage.boundingBox())!;
  await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await a.mouse.down();
  await a.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 40, { steps: 8 });
  await a.mouse.up();
  await a.getByRole('button', { name: 'Save draft' }).click();
  await a.getByText('draft saved ✓').waitFor();
  const publicX = async () => { const d = await (await fetch(`${FS}/config/world_public`)).json(); return JSON.parse(d.fields.json.stringValue).objects.find((o: any) => o.id === 'b-welcome').x; };
  assert.equal(await publicX(), 690, 'visitors still see the published position');
  await a.getByRole('button', { name: 'Publish', exact: true }).first().click();
  await a.getByText(/your village is published/i).waitFor({ timeout: 15_000 });
  assert.ok((await publicX()) > 690, 'published position updated');
  step('map edits stay drafts until published, then visitors see them');
  await a.goto(`${BASE}/atelier/theme`);
  await a.getByRole('button', { name: /try winter sugarplum/i }).click();
  await a.getByRole('button', { name: 'Saved ✓' }).waitFor({ timeout: 10_000 });
  await bpage.getByText(/theme was updated from another device/i).waitFor({ timeout: 20_000 });
  await a.getByRole('button', { name: /try ribbonmere coquette/i }).click();
  await a.getByRole('button', { name: 'Saved ✓' }).waitFor({ timeout: 10_000 });
  step('theme autosaves and syncs to the other device');

  // ── 13. Guestbook with moderation and rate limit ──
  await v.goto(`${BASE}/room/postoffice`);
  await v.getByLabel('Your name').fill('Rose');
  await v.getByLabel('Your letter').fill('Your village is lovely');
  await v.getByRole('button', { name: /seal with a kiss/i }).click();
  await v.getByText('Sealed & sent ✉').waitFor({ timeout: 15_000 });
  await v.getByRole('button', { name: 'Write another' }).click();
  await v.getByLabel('Your name').fill('Rose');
  await v.getByLabel('Your letter').fill('A second letter straight away');
  await v.getByRole('button', { name: /seal with a kiss/i }).click();
  await v.getByText(/only a few minutes ago/i).waitFor({ timeout: 15_000 });
  await a.goto(`${BASE}/room/postoffice`);
  await a.getByText('Your village is lovely').waitFor({ timeout: 15_000 });
  await a.getByRole('button', { name: 'Pin it up' }).click();
  await a.waitForTimeout(2500);
  await v.reload();
  await v.locator('.letter-board').getByText('Your village is lovely').waitFor({ timeout: 15_000 });
  step('guestbook: letters wait for approval, repeat letters are rate-limited, approved letters appear');

  // ── 14. Search ──
  await v.goto(`${BASE}/search?q=bell`);
  await v.getByRole('link', { name: 'The Bell Jar' }).waitFor({ timeout: 15_000 });
  await v.goto(`${BASE}/search?q=secret%20reading`);
  await v.getByText('Nothing found').waitFor();
  await a.goto(`${BASE}/search?q=secret%20reading`);
  await a.getByRole('link', { name: 'My Secret Reading List' }).waitFor();
  step('search: visitors find public things only; the owner finds private ones too');

  // ── 15. Backups: download (with images), restore with safety backup ──
  await a.goto(`${BASE}/atelier/backup`);
  const [dl] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: '…including all images' }).click()]);
  const backupPath = path.join(work, 'cloud-backup.json');
  await dl.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(backup.format, 'ribbonmere-backup');
  assert.ok(backup.items.some((i: any) => i.data?.privateNotes === 'Reread in winter. Only for me.'), 'backup keeps private notes');
  assert.ok(backup.media.length >= 1, 'backup includes images');
  assert.ok(backup.savedEntries.length >= 1, 'backup includes saved posts');
  step('backup downloads in the shared format, with private notes, images and saved posts');

  // ── 16. Migration from the original SQLite version ──
  const oldData = path.join(work, 'old-server');
  const { createApp } = await import('../server/app');
  const old = createApp({ dataDir: oldData, ownerPassword: 'old-password-123', log: () => {} });
  const oldSrv = old.app.listen(0);
  const oldBase = `http://127.0.0.1:${(oldSrv.address() as AddressInfo).port}`;
  const login = await fetch(`${oldBase}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ribbonmere': '1' }, body: JSON.stringify({ password: 'old-password-123' }) });
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const oldPost = (p: string, body: any, h: Record<string, string> = {}) => fetch(oldBase + p, { method: 'POST', headers: { 'x-ribbonmere': '1', cookie, ...(body instanceof Buffer ? {} : { 'content-type': 'application/json' }), ...h }, body: body instanceof Buffer ? body : JSON.stringify(body) }).then((r) => r.json());
  const oldImg = await oldPost('/api/media', fs.readFileSync(png), { 'content-type': 'application/octet-stream', 'x-filename': 'old-bow.png' });
  await oldPost('/api/items', { kind: 'book', roomId: 'library', visibility: 'public', data: { title: 'Migrated From SQLite', cover: oldImg.data.url, privateNotes: 'old secret' } });
  await oldPost('/api/items', { kind: 'entry', roomId: 'journal', visibility: 'private', data: { title: 'An old diary page', body: 'from the home server' } });
  oldSrv.close();
  execSync(`npx tsx scripts/export-sqlite.ts ${oldData}`, { cwd: process.cwd(), stdio: 'ignore' });
  const exported = fs.readdirSync(process.cwd()).find((f) => f.startsWith('ribbonmere-from-sqlite-'))!;
  const sqlitePath = path.join(work, exported);
  fs.renameSync(exported, sqlitePath);
  await a.goto(`${BASE}/atelier/backup`);
  await a.locator('input[type=file]').nth(1).setInputFiles(sqlitePath); // "Merge a backup in"
  await a.getByText(/Migrated From SQLite|items ·/).first().waitFor();
  const [safety] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: /download a safety backup/i }).click()]);
  assert.match(safety.suggestedFilename(), /before-restore/);
  await a.getByText('✓ Safety backup saved').waitFor({ timeout: 20_000 });
  await a.getByLabel(/I have my safety backup/).check();
  await a.getByRole('button', { name: /merge this backup in/i }).click();
  await a.getByText('Backup restored ♡').waitFor({ timeout: 60_000 });
  await a.goto(`${BASE}/room/library`);
  await a.getByRole('button', { name: /migrated from sqlite/i }).waitFor({ timeout: 15_000 });
  await a.getByRole('button', { name: /the bell jar/i }).waitFor();
  await a.goto(`${BASE}/dollhouse/diary`);
  await a.getByText('An old diary page').waitFor();
  const migrated = (await adminList('items')).find((d) => title(d.f) === 'Migrated From SQLite')!;
  const cover = migrated.f.data.mapValue.fields.cover.stringValue;
  assert.match(cover, /^\/media\/[a-f0-9]{32}$/, 'image address rewritten to the new storage');
  let coverStatus = 0;
  for (let i = 0; i < 20 && coverStatus !== 200; i++) { await a.waitForTimeout(500); coverStatus = (await fetch(BASE + cover)).status; }
  assert.equal(coverStatus, 200, 'migrated public cover is visible to visitors');
  assert.ok((await adminList('items_private')).some((d) => d.id === migrated.id), 'migrated private notes stayed private');
  step('SQLite database → export script → safety backup → merge: books, diary, images and private notes all migrated');

  // ── 16b. Every room template, bookmarks, widgets, rooms, checkpoints ──
  const addIn = async (room: string, button: RegExp, fields: Record<string, string>, vis?: RegExp) => {
    await a.goto(`${BASE}/room/${room}`);
    await a.getByRole('button', { name: button }).click();
    for (const [k, val] of Object.entries(fields)) await a.getByRole('textbox', { name: new RegExp(`^${k}`) }).first().fill(val);
    if (vis) await a.getByRole('radio', { name: vis }).click();
    await a.getByRole('button', { name: 'Save', exact: true }).click();
    await a.waitForTimeout(400);
  };
  await addIn('journal', /write a new page/i, { Title: 'A private page', Writing: 'Only for me' });
  await addIn('journal', /write a new page/i, { Title: 'A shared essay', Writing: 'Hello readers' }, /public/i);
  await addIn('gallery', /hang a new piece/i, { Title: 'Rose study' });
  await addIn('music', /add a record/i, { Title: 'Blue Banisters', Artist: 'Someone' });
  await addIn('garden', /plant a seed/i, { Title: 'Seed of an idea', Note: 'Links to [[How this garden works]]' }, /public/i);
  await addIn('observatory', /place a new star/i, { Title: 'Visit Florence' });
  await addIn('webring', /add a link/i, { Address: 'https://example.org', Title: 'An example site' });
  await addIn('cafe', /add to the menu/i, { Name: 'Lavender Milk' });
  await a.waitForTimeout(1500);
  for (const [room, t] of [['journal', 'A shared essay'], ['gallery', 'Rose study'], ['music', 'Blue Banisters'], ['observatory', 'Visit Florence'], ['webring', 'An example site'], ['cafe', 'Lavender Milk']]) {
    await v.goto(`${BASE}/room/${room}`);
    await v.getByText(t).first().waitFor({ timeout: 15_000 });
  }
  await v.goto(`${BASE}/room/journal`);
  assert.equal(await v.getByText('A private page').count(), 0, 'private journal page hidden from visitors');
  await v.goto(`${BASE}/room/garden`);
  await v.getByText('Seed of an idea').click();
  await v.getByRole('link', { name: 'How this garden works' }).waitFor();
  step('journal, gallery, music, garden (with [[links]]), observatory, webring and café all save and show to visitors as intended');

  await a.goto(`${BASE}/dollhouse/bookmarks`);
  await a.getByRole('button', { name: '+ Save a link' }).click();
  await a.getByRole('textbox', { name: 'Address' }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await a.getByLabel('Title', { exact: true }).fill('A video for a rainy day');
  await a.getByLabel('Collection', { exact: true }).fill('Watch Later');
  await a.getByRole('button', { name: 'Save', exact: true }).click();
  await a.getByText('A video for a rainy day').waitFor();
  await a.goto(`${BASE}/dollhouse`);
  await a.getByRole('button', { name: 'Arrange widgets' }).click();
  await a.getByRole('button', { name: '+ A note to myself' }).click();
  await a.getByRole('button', { name: 'Done arranging' }).click();
  await a.waitForTimeout(3000);
  await a.reload();
  await a.getByRole('heading', { name: 'A note to myself' }).waitFor();
  await a.getByText('A video for a rainy day').waitFor();
  step('bookmarks and dashboard widgets save and come back after a reload');

  await a.goto(`${BASE}/atelier/rooms`);
  await a.getByRole('button', { name: /freeform room/i }).click();
  await a.getByLabel('Room name').fill('Vanity Corner');
  await a.getByRole('button', { name: 'Build it' }).click();
  await a.getByText(/vanity corner is built/i).waitFor();
  await a.getByText('☁ synced').waitFor({ timeout: 15_000 });
  await a.goto(`${BASE}/atelier/room/vanity-corner`);
  await a.getByRole('button', { name: 'Add Gilded mirror' }).click();
  await a.getByRole('button', { name: 'Save draft' }).click();
  await a.getByText('draft saved ✓').waitFor();
  await a.getByRole('button', { name: 'Publish', exact: true }).first().click();
  await a.getByText(/your village is published/i).waitFor({ timeout: 15_000 });
  const pubWorld = JSON.parse((await (await fetch(`${FS}/config/world_public`)).json()).fields.json.stringValue);
  assert.ok(!pubWorld.rooms.some((r: any) => r.id === 'vanity-corner'), 'new rooms start private, even after publishing');
  await v.goto(`${BASE}/room/vanity-corner`);
  await v.getByText('This door is locked').waitFor();
  step('new rooms start private and stay hidden from visitors after publishing');

  await a.goto(`${BASE}/atelier/backup`);
  await a.getByText('Before publishing').first().waitFor({ timeout: 15_000 });
  a.once('dialog', (d) => { console.log('    (dialog:', d.message().slice(0, 40), ')'); d.accept(); });
  await a.getByRole('button', { name: 'Load', exact: true }).first().click();
  await a.getByText(/checkpoint loaded as your draft|couldn't load that checkpoint/i).waitFor();
  assert.equal(await a.getByText(/couldn't load that checkpoint/i).count(), 0, 'checkpoint loaded without error');
  const [opml] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Feeds as OPML' }).click()]);
  assert.match(fs.readFileSync(await opml.path(), 'utf8'), /Rosy Blog/);
  step('checkpoints restore as drafts; OPML export works');

  // Replace-restore the earlier cloud backup: the safety backup is enforced first.
  await a.locator('input[type=file]').first().setInputFiles(backupPath); // "Restore from a backup (replace)"
  assert.equal(await a.getByRole('button', { name: /replace with this backup/i }).isDisabled(), true, 'cannot replace before saving a safety backup');
  const [safety2] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: /download a safety backup/i }).click()]);
  const safetyFile = JSON.parse(fs.readFileSync(await safety2.path(), 'utf8'));
  assert.ok(safetyFile.items.some((i: any) => i.data?.title === 'Migrated From SQLite'), 'safety backup contains the current content');
  await a.getByLabel(/I have my safety backup/).check();
  await a.getByRole('button', { name: /replace with this backup/i }).click();
  await a.getByText('Backup restored ♡').waitFor({ timeout: 60_000 });
  await a.goto(`${BASE}/room/library`);
  await a.getByRole('button', { name: /the bell jar/i }).waitFor({ timeout: 15_000 });
  assert.equal(await a.getByRole('button', { name: /migrated from sqlite/i }).count(), 0, 'replace mode replaced the content');
  step('replace-restore requires a safety backup first, then restores the earlier state');

  // ── 16b. Ribbonmere 2.0 on the cloud: features, privacy of the new kinds, sharing, resets ──
  const kindDocs = async (kind: string) => (await adminList('items')).filter((d) => d.f.kind?.stringValue === kind);
  const fmSet = async (name: string, mode: 'On' | 'Hidden' | 'Resting') => {
    await a.goto(`${BASE}/atelier/features`);
    const card = a.getByRole('article', { name });
    await card.getByRole('radio', { name: mode, exact: true }).click();
    await card.locator('.fm-badge').filter({ hasText: mode }).waitFor();
    await a.waitForTimeout(800);
  };
  await fmSet('The Letterbox', 'Hidden');
  const draft = JSON.parse((await (await fetch(`${FS}/config/world_draft`, { headers: { authorization: 'Bearer owner' } })).json()).fields.json.stringValue);
  assert.equal(draft.features?.letterbox?.mode, 'hidden', 'feature mode saved to the cloud draft');
  await fmSet('The Letterbox', 'On');
  step('2.0: Feature Manager choices save to Firestore');

  await a.goto(`${BASE}/dollhouse/pets`);
  await a.getByRole('button', { name: /white bunny/i }).click();
  await a.getByLabel(/what will you call them/i).fill('Clover');
  await a.getByRole('button', { name: 'Bring them home' }).click();
  await a.getByRole('article', { name: 'Clover' }).waitFor({ timeout: 15_000 });
  await a.locator('.companion').waitFor({ timeout: 15_000 });
  await a.waitForTimeout(1500);
  const pets = await kindDocs('pet');
  assert.equal(pets.length, 1); assert.equal(pets[0].f.visibility.stringValue, 'private', 'pets stored private');
  assert.equal(await raw(`items/${pets[0].id}`), 403, 'visitors cannot read a pet');
  step('2.0: a companion is adopted and follows the owner; the record is private in Firestore');

  await a.goto(`${BASE}/dollhouse/capsules`);
  await a.getByRole('button', { name: '+ A new time capsule' }).click();
  await a.getByLabel('Name').fill('Cloud capsule');
  await a.getByLabel('A letter to the future').fill('Hello from the cloud.');
  await a.getByRole('button', { name: 'Seal the capsule' }).click();
  await a.getByRole('article', { name: 'Cloud capsule' }).waitFor({ timeout: 15_000 });
  await a.goto(`${BASE}/dollhouse/commonplace`);
  await a.getByRole('button', { name: 'Open a commonplace book' }).click();
  await a.getByRole('button', { name: '+ A new entry' }).click();
  await a.getByLabel('The words').fill('A cloud is a pressed flower of the sky.');
  await a.getByRole('button', { name: /^save/i }).click();
  await a.locator('.cp-entry').first().waitFor({ timeout: 15_000 });
  await a.goto(`${BASE}/dollhouse/scrapbook`);
  await a.getByRole('button', { name: '+ A new scrapbook' }).click();
  await a.getByLabel('Title').fill('Cloud scrapbook');
  await a.getByRole('button', { name: 'Begin' }).click();
  await a.getByRole('button', { name: 'Add Satin bow' }).click();
  await a.getByText('saved ♡').waitFor({ timeout: 15_000 });
  await a.waitForTimeout(2000);
  const [caps, cps, sbs] = [await kindDocs('capsule'), await kindDocs('excerpt'), await kindDocs('scrapbook')];
  assert.equal(caps.length, 1); assert.equal(caps[0].f.visibility.stringValue, 'private');
  assert.equal(await raw(`items/${caps[0].id}`), 403, 'capsules refused to visitors');
  assert.equal(cps.length, 1); assert.equal(await raw(`items/${cps[0].id}`), 403, 'private commonplace entry refused');
  assert.equal(sbs.length, 1);
  assert.equal(sbs[0].f.data.mapValue.fields.pages.arrayValue.values[0].mapValue.fields.objects.arrayValue.values.length, 1, 'scrapbook page saved');
  step('2.0: capsules, commonplace entries and scrapbooks save to Firestore and stay private');

  await a.goto(`${BASE}/dollhouse/letters`);
  await a.getByRole('button', { name: '+ Write a letter' }).click();
  await a.getByLabel('To').fill('Clementine');
  await a.getByLabel('Your letter').fill('Written in the cloud.');
  await a.getByText('saved ♡').waitFor({ timeout: 15_000 });
  await a.waitForTimeout(1200);
  const letter = (await kindDocs('letter'))[0];
  assert.equal(await raw(`items/${letter.id}`), 403, 'draft letter refused');
  await a.getByRole('button', { name: 'Share by link…' }).click();
  await a.getByLabel('Link to this letter').waitFor({ timeout: 15_000 });
  await a.waitForTimeout(1500);
  assert.equal(await raw(`items/${letter.id}`), 200, 'shared letter readable by its id');
  await v.goto(`${BASE}/letter/${letter.id}`);
  await v.getByRole('button', { name: /break the seal/i }).click({ timeout: 15_000 });
  await v.getByText('Written in the cloud.').waitFor();
  await a.getByRole('button', { name: 'Stop sharing' }).click();
  await a.waitForTimeout(1500);
  assert.equal(await raw(`items/${letter.id}`), 403, 'stop sharing closes the letter at once');
  step('2.0: a letter is private until shared by link, readable by its link only, and closes again at once');

  await a.goto(`${BASE}/atelier/features`);
  await a.getByRole('article', { name: 'Pet companions' }).getByRole('button', { name: 'reset…' }).click();
  await a.getByLabel(/type RESET/i).fill('RESET');
  await a.getByRole('button', { name: 'Reset', exact: true }).click();
  await a.getByText(/was reset/).waitFor({ timeout: 20_000 });
  await a.waitForTimeout(1000);
  assert.equal((await kindDocs('pet')).length, 0, 'pets reset in Firestore');
  assert.equal((await kindDocs('capsule')).length, 1, 'capsules untouched by the pets reset');
  const prog = await kindDocs('progress');
  assert.ok(prog.length === 1 && prog[0].f.visibility.stringValue === 'private' && await raw(`items/${prog[0].id}`) === 403, 'achievements and pearls stored privately');
  step('2.0: resetting a feature deletes only its own documents; progress is private');

  await a.goto(`${BASE}/atelier/village`);
  await a.getByLabel('Current password').fill(PASSWORD);
  await a.getByLabel(/New password/).fill('new-pink-ribbons-2');
  await a.getByRole('button', { name: 'Change password' }).click();
  await a.getByText(/password changed/i).waitFor({ timeout: 15_000 });
  step('password change works');

  // ── 17. Phones, motion, sign-out ──
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await newPage(phone, 'phone');
  await m.goto(BASE);
  await enter(m);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'no sideways scroll');
  await shot(m, '07-mobile-cloud');
  const still = await browser.newContext({ reducedMotion: 'reduce' });
  const s = await newPage(still, 'still');
  await s.goto(BASE);
  await s.waitForFunction(() => document.documentElement.dataset.motion === 'off');
  await a.goto(`${BASE}/dollhouse`);
  await a.getByRole('button', { name: /comfort settings/i }).click();
  await a.getByRole('button', { name: 'Sign out' }).click();
  await a.getByText(/signed out/i).waitFor();
  await a.goto(`${BASE}/dollhouse`);
  await a.getByText('The curtains are drawn').waitFor();
  await a.goto(`${BASE}/login`);
  await a.getByLabel('Email').fill(EMAIL);
  await a.getByLabel('Password').fill(PASSWORD);
  await a.getByRole('button', { name: /step inside/i }).click();
  await a.getByText(/don.t match/i).waitFor();
  await a.getByLabel('Password').fill('new-pink-ribbons-2');
  await a.getByRole('button', { name: /step inside/i }).click();
  await a.waitForURL(/dollhouse/);
  step('phone layout, reduced motion, signing out, and signing in with the new password (old one refused) work');

  if (errors.length) { console.log('\nBrowser errors:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('\nAll cloud end-to-end checks passed, no browser errors.');
} catch (e) {
  console.error('\n✗', e);
  try {
    const pr = await adminList('public_rooms');
    console.log('public_rooms:', pr.map((d) => `${d.id}=${(d.f.json?.stringValue ?? '').slice(0, 120)}`).join('\n  '));
    const cfg = await adminList('config');
    console.log('world_public publicRoomIds:', JSON.stringify(cfg.find((d) => d.id === 'world_public')?.f.publicRoomIds));
  } catch (err) { console.log('diag failed', err); }
  if (errors.length) console.log(errors.join('\n'));
  try { for (const c of browser!.contexts()) for (const p of c.pages()) await p.screenshot({ path: path.join(work, `fail-${Math.random().toString(36).slice(2, 6)}.png`) }); console.log(`failure screenshots in ${work}`); } catch { /* ignore */ }
  process.exitCode = 1;
} finally {
  await browser!?.close().catch(() => {});
  fixture?.close();
  stopAll();
}
