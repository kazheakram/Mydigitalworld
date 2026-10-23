// End-to-end check + screenshots for the owner's guide.
// Starts the real server on a throwaway data folder, drives Chromium through the main flows,
// asserts that things persist, and saves screenshots to docs/screenshots.
//   npm run build && npm run screenshots
import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 8899;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = 'pink-ribbons-forever';
const OUT = path.resolve('docs/screenshots');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ribbonmere-e2e-'));
const only = process.argv.slice(2);

const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir, OWNER_PASSWORD: PASSWORD, NODE_NO_WARNINGS: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('server did not start')), 15000);
  server.stdout.on('data', (d) => { if (String(d).includes('awake')) { clearTimeout(t); resolve(); } });
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const errors: string[] = [];
const watch = (p: Page) => {
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
};
const shot = async (p: Page, name: string) => { if (!only.length || only.includes(name)) await p.screenshot({ path: path.join(OUT, `${name}.png`) }); };
const step = (s: string) => console.log(`  ✓ ${s}`);

try {
  // ── visitor ──
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const v = await visitor.newPage(); watch(v);
  await v.goto(BASE);
  await v.getByRole('button', { name: /untie the ribbon/i }).waitFor();
  await shot(v, '01-intro');
  await v.getByRole('button', { name: /untie the ribbon/i }).click();
  await v.waitForTimeout(1100);
  await shot(v, '02-village');
  assert.equal(await v.locator('[data-id="b-boudoir"]').count(), 0, 'visitors never receive the private wing door');
  step('visitor sees the village without the private door');
  await v.locator('[data-id="b-library"]').click();
  await v.waitForURL(/room\/library/);
  await v.getByText('The shelves are waiting').waitFor();
  step('building opens its room');
  await v.goto(`${BASE}/room/cafe`);
  await v.getByRole('button', { name: /rosewater latte/i }).click();
  await v.getByText(/pairs perfectly/i).waitFor();
  await shot(v, '05-cafe');
  step('café drinks are interactive');
  await v.goto(`${BASE}/dollhouse`);
  await v.getByText('The curtains are drawn').waitFor();
  step('private wing refuses visitors');

  // ── owner ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const o = await ctx.newPage(); watch(o);
  await o.goto(`${BASE}/login`);
  await o.getByLabel('Password').fill(PASSWORD);
  await o.getByRole('button', { name: /step inside/i }).click();
  await o.waitForURL(/dollhouse/);
  await o.getByRole('heading', { name: 'Dollhouse Mode', level: 1 }).waitFor();
  await shot(o, '10-dollhouse');
  step('owner signs in to Dollhouse Mode');

  // Add a private book and a public one
  await o.goto(`${BASE}/room/library`);
  await o.getByRole('button', { name: '+ Add a book' }).click();
  await o.getByLabel('Title').fill('The Bell Jar');
  await o.getByLabel('Author').fill('Sylvia Plath');
  await o.getByLabel('Total pages').fill('294');
  await o.getByLabel('Pages read').fill('120');
  await o.getByRole('radio', { name: /public/i }).click();
  await o.getByRole('button', { name: 'Save', exact: true }).click();
  await o.getByRole('button', { name: /the bell jar/i }).waitFor();
  await o.getByRole('button', { name: '+ Add a book' }).click();
  await o.getByLabel('Title').fill('My Secret Reading List');
  await o.getByRole('radio', { name: /private/i }).click();
  await o.getByRole('button', { name: 'Save', exact: true }).click();
  await o.getByRole('button', { name: /my secret reading list/i }).waitFor();
  await o.reload();
  await o.getByRole('button', { name: /the bell jar/i }).waitFor();
  await shot(o, '06-library');
  await o.getByRole('button', { name: /the bell jar/i }).click();
  await shot(o, '07-book');
  await o.keyboard.press('Escape');
  step('books save and survive a reload');

  await v.goto(`${BASE}/room/library`);
  await v.getByRole('button', { name: /the bell jar/i }).waitFor();
  assert.equal(await v.getByRole('button', { name: /my secret reading list/i }).count(), 0, 'private book hidden from visitors');
  const leaked = await v.evaluate(async () => (await fetch('/api/items?kind=book').then((r) => r.text())).includes('Secret Reading'));
  assert.equal(leaked, false, 'private book not in the public API');
  step('private book invisible to visitors (page and API)');

  // Letterbox
  await o.goto(`${BASE}/dollhouse/inbox`);
  await o.getByLabel(/save a link/i).fill('https://example.com/an-essay-about-roses');
  await o.getByRole('button', { name: /save ✉/i }).click();
  await o.getByText(/tucked into the letterbox/i).waitFor();
  await o.getByRole('tab', { name: /resting/i }).click();
  await o.getByRole('button', { name: 'Peek anyway' }).click();
  await o.getByText('https://example.com/an-essay-about-roses').waitFor();
  await o.getByRole('button', { name: 'Later' }).first().click();
  await o.getByRole('tab', { name: /read & watch later/i }).click();
  await o.getByText('https://example.com/an-essay-about-roses').waitFor();
  await shot(o, '11-letterbox');
  step('letterbox capture, cooldown and review work');

  // Bookmark
  await o.goto(`${BASE}/dollhouse/bookmarks`);
  await o.getByRole('button', { name: '+ Save a link' }).click();
  await o.getByRole('textbox', { name: 'Address' }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await o.getByLabel('Title', { exact: true }).fill('A video for a rainy day');
  await o.getByLabel('Collection', { exact: true }).fill('Watch Later');
  await o.getByRole('button', { name: 'Save', exact: true }).click();
  await o.getByText('A video for a rainy day').waitFor();
  await shot(o, '12-cabinet');
  step('bookmarks save into collections');

  // Garden note with a wiki link
  await o.goto(`${BASE}/room/garden`);
  await shot(o, '08-garden');
  await o.goto(`${BASE}/dollhouse/favorites`);
  await shot(o, '13-reader');
  await o.goto(`${BASE}/stargirl`);
  await shot(o, '14-stargirl');
  await o.goto(`${BASE}/stargirl/rabbit-holes`);
  await o.getByLabel('Name this expedition').fill('Letters of women writers');
  await o.getByRole('button', { name: /set out/i }).click();
  await o.getByLabel('Link or thought').fill('Read about epistolary novels');
  await o.getByRole('button', { name: 'Pocket it' }).click();
  await o.getByText('Read about epistolary novels').waitFor();
  await shot(o, '15-expedition');
  step('expeditions start, collect discoveries');

  // Dashboard widgets: add one, persists
  await o.goto(`${BASE}/dollhouse`);
  await o.getByRole('button', { name: 'Arrange widgets' }).click();
  await o.getByRole('button', { name: '+ A note to myself' }).click();
  await o.getByRole('button', { name: 'Done arranging' }).click();
  await o.waitForTimeout(400);
  await o.reload();
  await o.getByRole('heading', { name: 'A note to myself' }).waitFor();
  await o.evaluate(() => window.scrollTo(0, 900));
  await shot(o, '16-dashboard');
  step('dashboard widgets persist');

  // Atelier: move a building, save, reload, check position
  await o.goto(`${BASE}/atelier`);
  const cottage = o.locator('.editor [data-id="b-welcome"] .hitbox');
  await cottage.waitFor();
  const box = (await cottage.boundingBox())!;
  await o.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await o.mouse.down();
  await o.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 40, { steps: 8 });
  await o.mouse.up();
  await shot(o, '20-atelier-map');
  await o.getByRole('button', { name: 'Save draft' }).click();
  await o.getByText('draft saved ✓').waitFor();
  const draft = await o.evaluate(async () => (await fetch('/api/config/world').then((r) => r.json())).draft.objects.find((x: any) => x.id === 'b-welcome'));
  assert.ok(draft.x > 690, `cottage moved right (x=${draft.x})`);
  const pub = await v.evaluate(async () => (await fetch('/api/config/world').then((r) => r.json())).published.objects.find((x: any) => x.id === 'b-welcome'));
  assert.equal(pub.x, 690, 'visitors still see the published position until publishing');
  await o.getByRole('button', { name: 'Publish', exact: true }).first().click();
  await o.getByText(/your village is published/i).waitFor();
  const pub2 = await v.evaluate(async () => (await fetch('/api/config/world').then((r) => r.json())).published.objects.find((x: any) => x.id === 'b-welcome'));
  assert.equal(pub2.x, draft.x, 'published position matches after publishing');
  step('map editor drag → draft → publish works');

  // Theme: change a colour, save, reload
  await o.goto(`${BASE}/atelier/theme`);
  await o.getByRole('button', { name: /try winter sugarplum/i }).click();
  await o.getByRole('button', { name: 'Save theme' }).click();
  await o.getByText(/theme saved/i).waitFor();
  await o.reload();
  await o.locator('.theme-closet').waitFor();
  const pink = await o.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-pink').trim());
  assert.equal(pink, '#e7cde6', 'theme persisted');
  await shot(o, '21-theme-closet');
  await o.goto(`${BASE}/`);
  await o.waitForTimeout(500);
  await shot(o, '22-village-winter');
  await o.goto(`${BASE}/atelier/theme`);
  await o.getByRole('button', { name: /try ribbonmere coquette/i }).click();
  await o.getByRole('button', { name: 'Save theme' }).click();
  await o.getByText(/theme saved/i).waitFor();
  step('theme changes persist');

  // Upload image
  await o.goto(`${BASE}/atelier/media`);
  const png = path.join(dataDir, 'bow.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAB0OAgFk9vBvAAAAAElFTkSuQmCC', 'base64'));
  await o.locator('input[type=file]').setInputFiles(png);
  await o.getByText(/1 image added/i).waitFor();
  await o.locator('.media-card img').first().waitFor();
  const ok = await o.evaluate(async () => { const img = document.querySelector('.media-card img') as HTMLImageElement; await img.decode(); return img.naturalWidth; });
  assert.equal(ok, 2, 'uploaded image displays');
  step('image upload displays');

  await o.goto(`${BASE}/atelier/rooms`);
  await o.getByRole('button', { name: /freeform room/i }).click();
  await o.getByLabel('Room name').fill('Vanity Corner');
  await o.getByRole('button', { name: 'Build it' }).click();
  await o.getByText(/vanity corner is built/i).waitFor();
  await shot(o, '23-rooms');
  await o.goto(`${BASE}/atelier/room/vanity-corner`);
  await o.getByRole('button', { name: 'Add Gilded mirror' }).click();
  await o.getByRole('button', { name: 'Add Bow armchair' }).click();
  await o.getByRole('button', { name: 'Save draft' }).click();
  await o.getByText('draft saved ✓').waitFor();
  await o.goto(`${BASE}/room/vanity-corner`);
  await o.locator('.freeform-stage svg.scene').waitFor();
  step('new freeform room created & arranged');
  const vanityPublic = await v.evaluate(async () => (await fetch('/api/config/world').then((r) => r.json())).published.rooms.some((r: any) => r.id === 'vanity-corner'));
  assert.equal(vanityPublic, false, 'new rooms start private');

  // Mobile
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await phone.newPage(); watch(m);
  await m.goto(BASE);
  await m.getByRole('button', { name: /untie the ribbon/i }).click();
  await m.waitForTimeout(1100);
  await shot(m, '30-mobile-village');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, 'no horizontal page scroll on phones');
  await m.goto(`${BASE}/room/postoffice`);
  await shot(m, '31-mobile-postoffice');
  step('mobile layout has no sideways scroll');

  // Reduced motion
  const still = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1200, height: 800 } });
  const s = await still.newPage();
  await s.goto(BASE);
  const motion = await s.evaluate(() => document.documentElement.dataset.motion);
  assert.equal(motion, 'off', 'reduced motion respected');
  step('reduced-motion preference turns animation off');

  if (errors.length) { console.log('\nBrowser errors:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('\nAll end-to-end checks passed, no browser errors.');
} catch (e) {
  console.error(e);
  for (const c of browser.contexts()) for (const pg of c.pages()) await pg.screenshot({ path: path.join(os.tmpdir(), `rm-fail-${c.pages().indexOf(pg)}-${browser.contexts().indexOf(c)}.png`) }).catch(() => {});
  console.log(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
