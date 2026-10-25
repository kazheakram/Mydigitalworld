// Ribbonmere 2.0 end-to-end checks (home-server backend; the same screens run on the cloud backend).
//   npm run build && npm run test:v2            (or: npm run test:v2 -- appearance pets …  to run some sections)
import { chromium, type Page, type BrowserContext } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 8911;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = 'pink-ribbons-forever';
const OUT = path.resolve('docs/screenshots/v2');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ribbonmere-v2-'));
const only = process.argv.slice(2);
const want = (s: string) => !only.length || only.includes(s);
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir, OWNER_PASSWORD: PASSWORD, NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
await new Promise<void>((res, rej) => { const t = setTimeout(() => rej(new Error('server did not start')), 15000); server.stdout.on('data', (d) => { if (String(d).includes('awake')) { clearTimeout(t); res(); } }); });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const errors: string[] = [];
const watch = (p: Page, who: string) => {
  p.on('pageerror', (e) => errors.push(`${who} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(`${who} console: ${m.text()}`); });
};
export const step = (s: string) => console.log(`  ✓ ${s}`);
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`) });
const enter = async (p: Page) => {
  await p.locator('.world-page').waitFor();
  const b = p.getByRole('button', { name: /untie the ribbon/i });
  if (await b.waitFor({ timeout: 1500 }).then(() => true, () => false)) { await b.click(); await p.waitForTimeout(1000); }
};
async function api(p: Page, method: string, url: string, body?: any) {
  return p.evaluate(async ([m, u, b]) => {
    const r = await fetch(u as string, { method: m as string, headers: { 'x-ribbonmere': '1', 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    return r.json();
  }, [method, url, body] as const);
}

let ownerCtx: BrowserContext;
let o: Page;
try {
  ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  o = await ownerCtx.newPage(); watch(o, 'owner');
  await o.goto(`${BASE}/login`);
  await o.getByLabel('Password').fill(PASSWORD);
  await o.getByRole('button', { name: /step inside/i }).click();
  await o.waitForURL(/dollhouse/);
  step('owner signed in');
  const visitorCtx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const v = await visitorCtx.newPage(); watch(v, 'visitor');

  const sections: Record<string, () => Promise<void>> = (await import('./e2e-v2-sections')).sections({ o, v, BASE, browser, shot, enter, api, step, ownerCtx, visitorCtx });
  for (const [name, fn] of Object.entries(sections)) if (want(name)) { console.log(`— ${name}`); await fn(); }

  if (errors.length) { console.log('\nBrowser errors:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('\nAll Ribbonmere 2.0 checks passed, no browser errors.');
} catch (e) {
  console.error('\n✗', e);
  if (errors.length) console.log(errors.join('\n'));
  try { for (const c of browser.contexts()) for (const pg of c.pages()) await pg.screenshot({ path: path.join(os.tmpdir(), `rm-v2-fail-${Math.random().toString(36).slice(2, 6)}.png`) }); } catch { /* ignore */ }
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
