import type { Browser, BrowserContext, Page } from 'playwright';
import assert from 'node:assert/strict';

interface T { o: Page; v: Page; BASE: string; browser: Browser; ownerCtx: BrowserContext; visitorCtx: BrowserContext; shot: (p: Page, n: string) => Promise<any>; enter: (p: Page) => Promise<void>; api: (p: Page, m: string, u: string, b?: any) => Promise<any>; step: (s: string) => void }

export function sections(t: T): Record<string, () => Promise<void>> {
  const { o, v, BASE, shot, enter, step } = t;
  const setAppearance = async (p: Page, a: string) => {
    await p.getByRole('button', { name: /comfort settings/i }).first().click();
    await p.getByRole('radio', { name: new RegExp(`^${a}$`, 'i') }).first().click();
    await p.keyboard.press('Escape');
    await p.mouse.click(5, 300);
  };
  /** Drive a feature through on → hidden → off → on in the Feature Manager. */
  const setMode = async (featureName: string, mode: 'On' | 'Hidden' | 'Resting') => {
    await o.goto(`${BASE}/atelier/features`);
    const card = o.getByRole('article', { name: featureName });
    await card.getByRole('radio', { name: mode, exact: true }).click();
    await card.locator(`.fm-badge`).filter({ hasText: mode }).waitFor();
    await o.waitForTimeout(400);
  };
  const publish = async () => { await t.api(o, 'POST', '/api/config/world/publish', { label: 'test' }); };
  (t as any).publish = publish;
  const resetFeature = async (featureName: string) => {
    await o.goto(`${BASE}/atelier/features`);
    await o.getByRole('article', { name: featureName }).getByRole('button', { name: 'reset…' }).click();
    await o.getByLabel(/type RESET/i).fill('RESET');
    await o.getByRole('button', { name: 'Reset', exact: true }).click();
    await o.getByText(/was reset/).waitFor();
  };
  (t as any).setMode = setMode; (t as any).resetFeature = resetFeature;
  return {
    lifecycle: async () => {
      // A core feature with data: the Letterbox.
      await o.goto(`${BASE}/dollhouse/inbox`);
      await o.getByLabel(/save a link/i).fill('An idea to keep');
      await o.getByRole('button', { name: /save ✉/i }).click();
      await o.getByText(/tucked into the letterbox/i).waitFor();
      await setMode('The Letterbox', 'Hidden');
      await o.goto(`${BASE}/dollhouse`);
      assert.equal(await o.locator('.ribbon-nav').getByRole('link', { name: 'Inbox' }).count(), 0, 'hidden: out of the menu');
      await o.goto(`${BASE}/dollhouse/inbox`);
      await o.getByRole('heading', { name: 'The Letterbox' }).waitFor();
      step('hidden: out of the menu, still works by its address');
      await setMode('The Letterbox', 'Resting');
      await o.goto(`${BASE}/dollhouse/inbox`);
      await o.getByText('The Letterbox is resting').waitFor();
      step('resting: shows a gentle resting page');
      await setMode('The Letterbox', 'On');
      await o.goto(`${BASE}/dollhouse/inbox`);
      await o.getByRole('tab', { name: /resting/i }).click();
      await o.getByRole('button', { name: 'Peek anyway' }).click();
      await o.getByText('An idea to keep').waitFor();
      await o.goto(`${BASE}/dollhouse`);
      await o.locator('.ribbon-nav').getByRole('link', { name: 'Inbox' }).waitFor();
      step('back on: in the menu again, and the saved idea is still there');
      // Stamps: reset only forgets stamps on this device.
      await v.goto(BASE); await enter(v);
      await v.evaluate(() => localStorage.setItem('rm-stamps', JSON.stringify(['bunny', 'bow'])));
      await setMode('Easter eggs & stamps', 'Resting');
      await publish();
      await v.goto(BASE); await enter(v);
      assert.equal(await v.locator('.stamp-book').count(), 0, 'stamp book hidden while resting');
      await setMode('Easter eggs & stamps', 'On');
      await publish();
      await v.goto(BASE); await enter(v);
      await v.locator('.stamp-book').waitFor();
      step('a resting feature disappears from the village and returns intact');
    },
    appearance: async () => {
      for (const a of ['Coquette', 'Quiet', 'Pixie', 'Midnight']) {
        await v.goto(BASE); await enter(v);
        await setAppearance(v, a);
        await v.waitForTimeout(600);
        assert.equal(await v.evaluate(() => document.documentElement.dataset.appearance), a.toLowerCase());
        await shot(v, `appearance-${a.toLowerCase()}-village`);
        await o.goto(`${BASE}/dollhouse`);
        await o.evaluate((x) => localStorage.setItem('rm-appearance', x), a.toLowerCase());
        await o.reload();
        await o.getByRole('heading', { name: 'Dollhouse Mode', level: 1 }).waitFor();
        await shot(o, `appearance-${a.toLowerCase()}-dollhouse`);
      }
      // Quiet hides decorations but never content: every place is still listed.
      await v.goto(`${BASE}/places`);
      await setAppearance(v, 'Quiet');
      const n = await v.locator('.places-list li').count();
      assert.ok(n >= 9, `all places still reachable in Quiet (${n})`);
      await v.keyboard.press('Alt+q');
      await v.waitForTimeout(200);
      assert.equal(await v.evaluate(() => document.documentElement.dataset.appearance), 'coquette', 'Alt+Q toggles Quiet off');
      await o.evaluate(() => localStorage.removeItem('rm-appearance'));
      step('four appearance modes switch instantly from any screen; Quiet keeps every place reachable; Alt+Q toggles');
    },
  };
}
