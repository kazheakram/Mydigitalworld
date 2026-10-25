// Ribbonmere 2.0 lifecycle checks on the CLOUD version, run entirely on this machine:
//   Firebase Auth + Firestore → official emulators (real security rules)  ·  Pages + Functions + KV → wrangler
// The same test sections as `npm run test:v2` (scripts/e2e-v2-sections.ts) run here unchanged, so every
// feature is driven through enable → configure → use → hide → rest → on → reset against Firestore.
// Never touches a real Firebase project: the project id is the emulator-only "demo-ribbonmere".
//
//   npm run test:v2:cloud                (or: npm run test:v2:cloud -- pets letters   to run some sections)
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PROJECT = 'demo-ribbonmere';
const PORT = 8898;
const BASE = `http://localhost:${PORT}`;
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const EMAIL = 'kira@example.com';
const PASSWORD = 'pink-ribbons-forever';
const OUT = path.resolve('docs/screenshots/v2-cloud');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-v2-cloud-'));
const only = process.argv.slice(2);
const procs: ChildProcess[] = [];
const errors: string[] = [];
const step = (s: string) => console.log(`  ✓ ${s}`);
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
const stopAll = () => { for (const p of procs) { try { process.kill(-p.pid!, 'SIGTERM'); } catch { /* gone */ } } };

/** JS value → Firestore REST value (emulator admin writes only). */
const fsValue = (v: any): any => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(fsValue) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsValue(x)])) } };

let browser: Browser | undefined;
let fixture: http.Server | undefined;
try {
  console.log('Starting Firebase emulators…');
  await start('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT], /All emulators ready/);
  const signUp = await (await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  })).json();
  const OWNER = signUp.localId as string;
  const rules = fs.readFileSync('firestore.rules', 'utf8').replaceAll('PASTE_YOUR_USER_ID_HERE', OWNER);
  const put = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
  });
  assert.equal(put.status, 200, 'rules loaded into the emulator');

  console.log('Building the cloud version (emulator build)…');
  const firebaseConfig = JSON.stringify({ apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:1:web:1' });
  execSync('npx vite build --outDir dist-cloud --emptyOutDir', { stdio: 'ignore', env: { ...process.env, VITE_BACKEND: 'firebase', VITE_FIREBASE_CONFIG: firebaseConfig, VITE_OWNER_UID: OWNER, VITE_USE_EMULATORS: '1' } });
  fixture = http.createServer((_req, res) => { res.setHeader('content-type', 'application/rss+xml'); res.end('<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title></channel></rss>'); }).listen(0);
  console.log('Starting Cloudflare Pages (wrangler)…');
  await start('npx', ['wrangler', 'pages', 'dev', 'dist-cloud', '--port', String(PORT), '--kv', 'MEDIA', '--persist-to', path.join(work, 'kv'),
    '--compatibility-date=2025-09-01', '--binding', `VITE_FIREBASE_CONFIG=${firebaseConfig}`, '--binding', `VITE_OWNER_UID=${OWNER}`,
    '--binding', 'MEDIA_SECRET=e2e-secret-value-that-is-long-enough', '--binding', 'AUTH_EMULATOR=1', '--binding', 'ALLOW_PRIVATE_FETCH=1'],
  /Ready on/, { WRANGLER_SEND_METRICS: 'false' });

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  const watch = (p: Page, who: string) => {
    p.on('pageerror', (e) => errors.push(`${who} pageerror: ${e.message}`));
    p.on('console', (m) => { const t = m.text(); if (process.env.DEBUG_CONSOLE && /\[map\]/.test(t)) console.log(`[${who}] ${t}`); if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|emulator|WebChannelConnection|Could not reach Cloud Firestore|BloomFilter/i.test(t)) errors.push(`${who} console: ${t}`); });
  };
  const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`) });
  const enter = async (p: Page) => {
    await p.locator('.world-page').waitFor({ timeout: 20_000 });
    const b = p.getByRole('button', { name: /untie the ribbon/i });
    if (await b.waitFor({ timeout: 1500 }).then(() => true, () => false)) { await b.click(); await p.waitForTimeout(1000); }
  };
  // The tests read data the way the app does: through the app's own API layer (emulator build only).
  const api = async (p: Page, method: string, url: string, body?: any) => {
    for (let i = 0; i < 80 && !(await p.evaluate(() => typeof (window as any).__rmApi === 'function').catch(() => false)); i++) await p.waitForTimeout(250);
    return p.evaluate(async ([m, u, b]) => { try { return await (window as any).__rmApi(m, u, b ?? undefined); } catch (e: any) { return { error: String(e?.message ?? e), status: e?.status }; } }, [method, url, body] as const);
  };

  const ownerCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  const o = await ownerCtx.newPage(); watch(o, 'owner');
  await o.goto(`${BASE}/login`);
  await o.getByLabel('Email').fill(EMAIL);
  await o.getByLabel('Password').fill(PASSWORD);
  await o.getByRole('button', { name: /step inside/i }).click();
  await o.waitForURL(/dollhouse/);
  await o.getByRole('heading', { name: 'Dollhouse Mode', level: 1 }).waitFor();
  await o.getByText('☁ synced').waitFor({ timeout: 30_000 });
  step('owner signed in on the cloud version (emulators); village planted');
  // Like a person would, the owner's page waits for "☁ synced" before reloading or leaving: a change
  // queued a few milliseconds before the page unloads can be lost (see the status doc's known limitations).
  const waitSynced = async (p: Page) => {
    for (let i = 0; i < 75; i++) {
      const busy = await p.evaluate(() => /☁ saving…|waiting/.test(document.body?.innerText ?? '')).catch(() => false);
      if (!busy) break;
      await p.waitForTimeout(200);
    }
    await p.waitForTimeout(250);
  };
  const reload0 = o.reload.bind(o); const goto0 = o.goto.bind(o);
  o.reload = (async (opts?: any) => { await waitSynced(o); return reload0(opts); }) as any;
  o.goto = (async (url: string, opts?: any) => { await waitSynced(o); return goto0(url, opts); }) as any;
  const visitorCtx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  { const d = new Date(); d.setHours(11, 0, 0, 0); await visitorCtx.clock.setFixedTime(d); }
  const v = await visitorCtx.newPage(); watch(v, 'visitor');

  /** Feeds and posts written straight into the Firestore emulator (no internet here). */
  const seedFeeds = async () => {
    const day = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    const entry = (fid: string, i: number, title: string, link: string, summary: string, h: number) => ({ id: `${fid}~${i}`, guid: link, title, link, published: day(h), summary, image: null, read: false, saved: false });
    const docs: Record<string, any> = {
      'f-tea': { url: 'https://tea.example.com/feed', title: 'Teacup Letters', siteUrl: null, category: 'Books & Literature', entries: [
        entry('f-tea', 0, 'On rereading Persuasion', 'https://tea.example.com/persuasion', 'Every autumn I return to Anne Elliot and her quiet, patient heart.', 1),
        entry('f-tea', 1, 'A list of small comforts', 'https://tea.example.com/comforts', 'Warm bread, letters, the sound of rain on a skylight.', 2),
        entry('f-tea', 2, 'Third teacup post', 'https://tea.example.com/third', 'A third post from the same blog.', 3)] },
      'f-moss': { url: 'https://moss.example.com/rss', title: 'Moss & Lace', siteUrl: null, category: 'Design & Inspiration', entries: [entry('f-moss', 3, 'Pressing violets', 'https://moss.example.com/violets', 'How to press flowers between the pages of a heavy dictionary.', 4)] },
      'f-yt': { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCribbonmere000000000000', title: 'Rosewater Films', siteUrl: null, category: 'Music & Culture', entries: [entry('f-yt', 4, 'A slow morning in Bath', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'A video.', 5)] },
    };
    for (const [id, f] of Object.entries(docs)) {
      const r = await fetch(`${FS}/feeds/${id}`, { method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ fields: fsValue(f).mapValue.fields }) });
      assert.equal(r.status, 200, `seeded feed ${id}`);
    }
    await o.reload(); await o.waitForTimeout(1500);
  };

  const { sections } = await import('./e2e-v2-sections');
  const all = sections({ o, v, BASE, browser, shot, enter, api, step, ownerCtx, visitorCtx, seedFeeds, cloud: true } as any);
  for (const [name, fn] of Object.entries(all)) {
    if (only.length && !only.includes(name)) continue;
    console.log(`— ${name}`);
    await fn();
  }
  if (errors.length) { console.log('\nBrowser errors:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('\nAll Ribbonmere 2.0 cloud checks passed, no browser errors.');
} catch (e) {
  console.error('\n✗', e);
  if (errors.length) console.log(errors.join('\n'));
  try { for (const c of browser!.contexts()) for (const p of c.pages()) await p.screenshot({ path: path.join(work, `fail-${Math.random().toString(36).slice(2, 6)}.png`) }); console.log(`failure screenshots in ${work}`); } catch { /* ignore */ }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  fixture?.close();
  stopAll();
}
