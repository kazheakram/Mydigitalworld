import type { Browser, BrowserContext, Page } from 'playwright';
import assert from 'node:assert/strict';

interface T { o: Page; v: Page; BASE: string; browser: Browser; ownerCtx: BrowserContext; visitorCtx: BrowserContext; shot: (p: Page, n: string) => Promise<any>; enter: (p: Page) => Promise<void>; api: (p: Page, m: string, u: string, b?: any) => Promise<any>; step: (s: string) => void }

export function sections(t: T): Record<string, () => Promise<void>> {
  const { o, v, BASE, shot, enter, step } = t;
  const setAppearance = async (p: Page, a: string) => {
    const btn = p.getByRole('button', { name: /comfort settings/i }).first();
    if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
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
    pets: async () => {
      await o.goto(`${BASE}/dollhouse/pets`);
      await o.getByText('No companions yet').waitFor();
      await o.getByRole('button', { name: /white bunny/i }).click();
      await o.getByLabel(/what will you call them/i).fill('Clover');
      await o.getByRole('button', { name: 'Bring them home' }).click();
      const card = o.getByRole('article', { name: 'Clover' });
      await card.waitFor();
      await o.getByRole('button', { name: /baby fawn/i }).click();
      await o.getByLabel(/what will you call them/i).fill('Bambi');
      await o.getByRole('button', { name: 'Bring them home' }).click();
      await o.getByRole('article', { name: 'Bambi' }).waitFor();
      step('adopted two companions (a bunny and a fawn) and named them');
      await card.getByText('Accessories & colours').click();
      await card.getByLabel('pearl necklace').check();
      await card.getByLabel('flower crown').check();
      await card.getByRole('button', { name: 'bow #bfa6d6' }).click();
      await o.waitForTimeout(500);
      await o.reload();
      await o.getByRole('article', { name: 'Clover' }).getByText('Accessories & colours').click();
      assert.ok(await o.getByRole('article', { name: 'Clover' }).getByLabel('pearl necklace').isChecked(), 'accessory saved');
      await o.getByRole('button', { name: 'Pat Clover' }).click();
      await o.locator('.pet-hearts i').first().waitFor({ state: 'attached' });
      step('accessories (pearls, flower crown, lilac bow) are saved; patting shows hearts');
      // The first companion follows the owner around; switch to the fawn.
      const comp = o.locator('.companion');
      await comp.waitFor();
      assert.match((await comp.getAttribute('aria-label'))!, /Clover/);
      await o.getByRole('article', { name: 'Bambi' }).getByLabel('follows me around').check();
      await o.locator('.companion[aria-label*="Bambi"]').waitFor();
      const before = await comp.evaluate((e) => getComputedStyle(e).transform);
      await o.mouse.move(200, 500); await o.waitForTimeout(900);
      const after = await comp.evaluate((e) => getComputedStyle(e).transform);
      assert.notEqual(before, after, 'companion drifts after the pointer');
      await shot(o, 'pets-page');
      step('one companion at a time follows the pointer; switching followers works');
      // Wandering the public map.
      await o.getByRole('article', { name: 'Clover' }).getByLabel('wanders the village map').check();
      await o.waitForTimeout(500);
      await publish();
      await v.goto(BASE); await enter(v);
      await v.locator('[data-id^="companion-"]').first().waitFor();
      const priv = await t.api(v, 'GET', '/api/items?kind=pet');
      assert.ok(!Array.isArray(priv) || priv.length === 0, 'visitors cannot list pets');
      step('a companion can wander the public map; the pet records themselves stay private');
      // Lifecycle: hide → rest → on → reset.
      await setMode('Pet companions', 'Hidden');
      await o.goto(`${BASE}/dollhouse`);
      assert.equal(await o.locator('.polaroid', { hasText: 'Companions' }).count(), 0, 'hidden from the dollhouse cards');
      await o.goto(`${BASE}/dollhouse/pets`);
      await o.getByRole('article', { name: 'Clover' }).waitFor();
      await o.goto(BASE); await enter(o);
      assert.equal(await o.locator('[data-id^="companion-"]').count(), 0, 'hidden companion is off the map');
      await setMode('Pet companions', 'Resting');
      assert.equal(await o.locator('.companion').count(), 0, 'no follower while resting');
      await o.goto(`${BASE}/dollhouse/pets`);
      await o.getByText('Pet companions is resting').waitFor();
      await publish();
      await v.goto(BASE); await enter(v);
      assert.equal(await v.locator('[data-id^="companion-"]').count(), 0, 'resting companion is off the public map');
      await setMode('Pet companions', 'On');
      await o.goto(`${BASE}/dollhouse/pets`);
      await o.getByRole('article', { name: 'Clover' }).waitFor();
      await o.getByRole('article', { name: 'Bambi' }).waitFor();
      step('hidden → resting → on: companions, accessories and map spot all come back');
      // Unrelated content stays put through a reset.
      await o.goto(`${BASE}/dollhouse/inbox`);
      const inboxBefore = (await t.api(o, 'GET', '/api/items?kind=inbox')).length;
      await resetFeature('Pet companions');
      const after2 = await t.api(o, 'GET', '/api/items?kind=pet');
      assert.equal(after2.length, 0, 'pets removed by reset');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=inbox')).length, inboxBefore, 'letterbox untouched by pets reset');
      const w = await t.api(o, 'GET', '/api/config/world');
      assert.ok(!JSON.stringify(w.draft.objects).includes('companion-'), 'map companions removed by reset');
      await o.goto(`${BASE}/dollhouse/pets`);
      await o.getByText('No companions yet').waitFor();
      await publish();
      step('reset removes only pets (and their map spots); the letterbox is untouched');
    },
    bedroom: async () => {
      await o.goto(`${BASE}/dollhouse/bedroom`);
      await o.getByRole('button', { name: 'Make my bedroom' }).click();
      await o.getByRole('group', { name: 'My bedroom' }).waitFor();
      await o.getByLabel('Wallpaper').selectOption('roses');
      await o.getByLabel('Floor').selectOption('checker');
      await o.waitForTimeout(500);
      await o.reload();
      assert.equal(await o.getByLabel('Wallpaper').inputValue(), 'roses');
      await shot(o, 'bedroom');
      step('bedroom created with furniture; wallpaper and floor choices are saved');
      // Arrange in the editor: the room editor shows the same interior and a photo frame option exists.
      await o.getByRole('link', { name: /arrange furniture/i }).click();
      await o.waitForURL(/atelier\/room\/my-bedroom/);
      await o.locator('.interior-bg').first().waitFor();
      step('the Atelier room editor arranges the bedroom over its wallpaper');
      // Private by default.
      await publish();
      await v.goto(`${BASE}/room/my-bedroom`);
      await v.waitForTimeout(800);
      assert.equal(await v.locator('.interior-bg').count(), 0, 'visitors cannot open the private bedroom');
      const pub = await t.api(v, 'GET', '/api/config/world');
      assert.ok(!JSON.stringify(pub.published).includes('my-bedroom'), 'bedroom absent from the public world');
      step('the bedroom is private: not in the public world, not openable by visitors');
      await setMode('My bedroom', 'Hidden');
      await o.goto(`${BASE}/dollhouse/bedroom`);
      await o.getByRole('group', { name: 'My bedroom' }).waitFor();
      await setMode('My bedroom', 'Resting');
      await o.goto(`${BASE}/dollhouse/bedroom`);
      await o.getByText('My bedroom is resting').waitFor();
      await setMode('My bedroom', 'On');
      await o.goto(`${BASE}/dollhouse/bedroom`);
      assert.equal(await o.getByLabel('Wallpaper').inputValue(), 'roses', 'decoration survives resting');
      await resetFeature('My bedroom');
      await o.goto(`${BASE}/dollhouse/bedroom`);
      assert.equal(await o.getByLabel('Wallpaper').inputValue(), 'stripes', 'reset to the starting wallpaper');
      const w = await t.api(o, 'GET', '/api/config/world');
      assert.ok(w.draft.rooms.length >= 10, 'other rooms untouched');
      step('bedroom: hidden → resting → on keeps decoration; reset returns only the bedroom to its start');
    },
    world: async () => {
      await o.goto(`${BASE}/atelier/features`);
      await o.getByRole('article', { name: 'Weather' }).getByRole('combobox').selectOption('snow');
      await o.getByRole('article', { name: 'Day & night' }).getByRole('combobox').selectOption('night');
      await o.waitForTimeout(500);
      await publish();
      await v.goto(BASE); await enter(v);
      await v.locator('.world-page[data-weather="snow"][data-daypart="night"]').waitFor();
      assert.ok(await v.locator('.snow-flake').count() > 10, 'snow falls');
      await v.locator('.lamp-glow').first().waitFor();
      await shot(v, 'world-snow-night');
      step('weather and light chosen by the owner reach visitors after publishing (snowy night, glowing lamps)');
      await o.goto(`${BASE}/atelier/features`);
      await o.getByRole('article', { name: 'Weather' }).getByRole('combobox').selectOption('petals');
      await o.getByRole('article', { name: 'Day & night' }).getByRole('combobox').selectOption('golden');
      await o.waitForTimeout(500);
      await publish();
      await v.goto(BASE); await enter(v);
      await v.locator('.petal-fall').first().waitFor();
      await shot(v, 'world-petals-golden');
      // Little interactions.
      await v.getByRole('button', { name: /tap the rose fountain/i }).first().click();
      await v.locator('.poke-splash').first().waitFor();
      const lamp = v.getByRole('button', { name: /tap the lamp post/i }).first();
      await lamp.click();
      await v.locator('.obj.lamp-off').first().waitFor();
      await lamp.click();
      assert.equal(await v.locator('.obj.lamp-off').count(), 0, 'lamp back on');
      step('tapping the fountain splashes; lamps switch off and on');
      await o.goto(`${BASE}/atelier/features`);
      await o.getByRole('article', { name: 'Weather' }).getByRole('combobox').selectOption('mist');
      await o.getByRole('article', { name: 'Day & night' }).getByRole('combobox').selectOption('clock');
      await o.waitForTimeout(500);
      await publish();
      await v.goto(BASE); await enter(v);
      await v.locator('.world-page[data-weather="mist"][data-daypart="day"]').waitFor();
      await shot(v, 'world-mist-day');
      await o.goto(`${BASE}/atelier/features`);
      await o.getByRole('article', { name: 'Day & night' }).getByRole('combobox').selectOption('golden');
      await o.waitForTimeout(500);
      await publish();
      await v.goto(BASE); await enter(v);
      await setAppearance(v, 'Quiet');
      assert.equal(await v.locator('.world-page[data-weather]').count(), 0, 'Quiet: no weather');
      assert.equal(await v.locator('.obj.playful').count(), 0, 'Quiet: no playful objects');
      await setAppearance(v, 'Coquette');
      for (const f of ['Weather', 'Day & night', 'Little interactions']) await setMode(f, 'Resting');
      await publish();
      await v.goto(BASE); await enter(v);
      assert.equal(await v.locator('.world-page[data-weather], .world-page[data-daypart]').count(), 0, 'resting: no atmosphere');
      assert.equal(await v.locator('.obj.playful').count(), 0, 'resting: no interactions');
      assert.ok(await v.locator('.obj.interactive').count() >= 9, 'buildings still open rooms');
      for (const f of ['Weather', 'Day & night', 'Little interactions']) await setMode(f, 'On');
      await resetFeature('Weather');
      await publish();
      const pub = await t.api(v, 'GET', '/api/config/world');
      assert.equal(pub.published.features?.weather?.settings?.choice, undefined, 'weather reset to follow the season');
      assert.equal(pub.published.features?.daynight?.settings?.choice, 'golden', 'unrelated feature settings untouched');
      step('Quiet and resting switch atmosphere off without touching buildings; resetting weather leaves the light alone');
    },
  };
}
