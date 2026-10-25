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
  /** Cloud writes land a moment after the screen updates, so state checks wait (up to 15 s) instead of racing. */
  const until = async (check: () => Promise<boolean>, msg: string, ms = 15_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await check().catch(() => false)) return; await o.waitForTimeout(400); }
    assert.fail(msg);
  };
  (t as any).until = until;
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
      await until(async () => !JSON.stringify((await t.api(o, 'GET', '/api/config/world')).draft.objects).includes('companion-'), 'map companions removed by reset');
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
    newspaper: async () => {
      await (t as any).seedFeeds();
      await o.goto(`${BASE}/dollhouse/newspaper`);
      const paper = o.locator('article.newspaper');
      await paper.waitFor();
      await paper.getByText('On rereading Persuasion').waitFor();
      await paper.getByText('Pressing violets').waitFor();
      assert.equal(await paper.getByText('A slow morning in Bath').count(), 0, 'videos stay in the parlour');
      assert.equal(await paper.getByText('Third teacup post').count(), 0, 'at most two stories per feed');
      await shot(o, 'newspaper');
      step('today’s edition is printed from the feeds: blogs in, videos out, two per feed at most');
      await paper.getByRole('button', { name: 'mark read' }).first().click();
      await paper.getByText('read ✓').first().waitFor();
      await o.reload();
      await o.locator('article.newspaper').getByText('read ✓').first().waitFor();
      const entries = await t.api(o, 'GET', '/api/feed-entries?limit=50');
      assert.ok(entries.some((e: any) => e.read), 'reading in the paper marks the post read in the reader');
      step('read/unread is remembered in the edition and in the reader');
      await o.getByRole('button', { name: 'Paper settings' }).click();
      await o.getByLabel('Name of the paper').fill('The Bunny Bulletin');
      await o.getByLabel('Stories per edition').click();
      await o.waitForTimeout(500);
      await o.getByRole('button', { name: 'Print a fresh edition' }).click();
      await o.locator('.paper-name', { hasText: 'The Bunny Bulletin' }).waitFor();
      const yesterday = new Date(Date.now() - 86400_000); const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      await t.api(o, 'POST', '/api/items', { kind: 'edition', visibility: 'private', roomId: null, data: { date: key, title: 'Yesterday’s Gazette', generatedAt: yesterday.toISOString(), stories: [{ entryId: 'x', title: 'An older story', link: 'https://tea.example.com/old', summary: 'From yesterday.', image: null, feedTitle: 'Teacup Letters', category: 'Books & Literature', published: null }] } });
      await o.reload();
      await o.locator('.paper-archive li').nth(1).waitFor();
      await o.locator('.paper-archive li').nth(1).getByRole('button').click();
      await o.locator('article.newspaper').getByText('An older story').waitFor();
      step('the paper can be renamed and reprinted; past editions stay in the archive');
      await v.goto(`${BASE}/places`);
      const vis = await t.api(v, 'GET', '/api/items?kind=edition');
      assert.ok(!Array.isArray(vis) || vis.length === 0, 'visitors never see editions');
      await setMode('The Morning Paper', 'Hidden');
      await o.goto(`${BASE}/dollhouse/newspaper`);
      await o.locator('article.newspaper').waitFor();
      await setMode('The Morning Paper', 'Resting');
      await o.goto(`${BASE}/dollhouse/newspaper`);
      await o.getByText('The Morning Paper is resting').waitFor();
      await setMode('The Morning Paper', 'On');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=edition')).length, 2, 'editions survive resting');
      await resetFeature('The Morning Paper');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=edition')).length, 0, 'reset clears editions');
      assert.equal((await t.api(o, 'GET', '/api/feeds')).length, 3, 'subscriptions untouched by reset');
      step('hidden → resting → on keeps editions; reset clears only editions, never subscriptions');
    },
    parlour: async () => {
      await (t as any).seedFeeds();
      await o.goto(`${BASE}/dollhouse/parlour`);
      const card = o.getByRole('article', { name: 'A slow morning in Bath' });
      await card.waitFor();
      assert.equal(await o.getByRole('article', { name: 'Pressing violets' }).count(), 0, 'only video channels in the parlour');
      await card.getByRole('button', { name: 'watch later' }).click();
      await card.getByText('in watch later ✓').waitFor();
      await o.getByRole('tab', { name: 'Watch later' }).click();
      await o.getByRole('button', { name: 'Play A slow morning in Bath' }).click();
      const frame = o.locator('.tv-set iframe');
      await frame.waitFor({ state: 'attached' });
      assert.match((await frame.getAttribute('src'))!, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
      await o.getByLabel('My notes').fill('The light in the Pump Room.');
      await o.getByLabel('Playlist').fill('Rainy afternoons');
      await o.getByRole('button', { name: 'Save notes' }).click();
      await o.waitForTimeout(400);
      await o.keyboard.press('Escape');
      await o.getByRole('tab', { name: '▸ Rainy afternoons' }).click();
      await o.getByText('“The light in the Pump Room.”').waitFor();
      await shot(o, 'parlour');
      step('channel videos play in a privacy-friendly embed; watch later, notes and playlists are saved');
      await o.getByLabel('YouTube link to save').fill('https://youtu.be/abcdefghijk');
      await o.getByRole('button', { name: 'Save video' }).click();
      await o.getByRole('tab', { name: 'Everything saved' }).click();
      await o.locator('.tv-card').nth(1).waitFor();
      await o.getByLabel('Search videos').fill('slow morning');
      assert.equal(await o.locator('.tv-card').count(), 1, 'search narrows the shelf');
      const bms = await t.api(o, 'GET', '/api/items?kind=bookmark');
      assert.equal(bms.filter((b: any) => b.data.collection === 'Video Parlour').length, 2, 'saved videos are bookmarks in the Video Parlour collection');
      step('pasting a link saves it; search works; saved videos live in the Cabinet too');
      await setMode('YouTube channel feeds', 'Resting');
      await o.goto(`${BASE}/dollhouse/parlour`);
      await o.getByText(/channel feeds are switched off/).waitFor();
      await setMode('YouTube channel feeds', 'On');
      await setMode('The Video Parlour', 'Resting');
      await o.goto(`${BASE}/dollhouse/parlour`);
      await o.getByText('The Video Parlour is resting').waitFor();
      await setMode('The Video Parlour', 'On');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=bookmark')).filter((b: any) => b.data.collection === 'Video Parlour').length, 2, 'videos kept while resting');
      step('switching the parlour or YouTube feeds off and on keeps every saved video');
    },
    journal: async () => {
      const y = new Date().getFullYear();
      const book = (data: any) => t.api(o, 'POST', '/api/items', { kind: 'book', roomId: 'library', visibility: 'public', data });
      await book({ title: 'Persuasion', author: 'Jane Austen', shelf: 'Read', pages: 280, rating: 5, finishedOn: `${y}-02-10`, genre: 'Classics', quotes: ['You pierce my soul.'] });
      await book({ title: 'Emma', author: 'Jane Austen', shelf: 'Read', pages: 470, rating: 4, finishedOn: `${y}-02-24`, genre: 'Classics' });
      await book({ title: 'The Bell Jar', author: 'Sylvia Plath', shelf: 'Read', pages: 240, rating: 4, finishedOn: `${y}-05-01`, genre: 'Modern', review: 'Luminous and sad.' });
      await book({ title: 'Anne of Green Gables', author: 'L. M. Montgomery', shelf: 'Read', series: 'Anne', seriesNumber: 1, finishedOn: `${y - 1}-11-01` });
      await book({ title: 'Anne of Avonlea', author: 'L. M. Montgomery', shelf: 'Want to Read', series: 'Anne', seriesNumber: 2 });
      await o.goto(`${BASE}/dollhouse/reading-journal`);
      const wrap = o.getByRole('region', { name: `${y} in books` });
      await wrap.waitFor();
      await wrap.locator('.rj-figures p', { hasText: 'books finished' }).getByText('3', { exact: true }).waitFor();
      await wrap.locator('.rj-figures p', { hasText: 'pages' }).getByText('990').waitFor();
      await o.getByText('Jane Austen').first().waitFor();
      await o.getByText('Most loved:').waitFor();
      await shot(o, 'reading-journal');
      step('year statistics come from your library: books, pages, hearts, authors, genres, months');
      await o.getByRole('button', { name: '+ A gentle challenge' }).click();
      await o.getByLabel('Name').fill('Twelve gentle books');
      await o.getByRole('button', { name: 'Begin' }).click();
      await o.getByText('3 of 12 books').waitFor();
      await o.getByRole('tab', { name: 'Monthly wrap-up' }).click();
      await o.getByLabel('Month').selectOption('1');
      await o.getByText('“You pierce my soul.”').waitFor();
      await o.getByRole('tab', { name: 'Series' }).click();
      await o.getByText('#2').waitFor();
      await o.getByRole('tab', { name: 'Reviews & notes' }).click();
      await o.getByText('Luminous and sad.').waitFor();
      await o.getByLabel('Year').selectOption(String(y - 1));
      await o.getByRole('tab', { name: 'The year' }).click();
      await o.getByRole('region', { name: `${y - 1} in books` }).waitFor();
      step('challenges count without pressure; monthly wrap-ups, series, reviews and past years work');
      await setMode('Reading Journal', 'Resting');
      await o.goto(`${BASE}/dollhouse/reading-journal`);
      await o.getByText('Reading Journal is resting').waitFor();
      await setMode('Reading Journal', 'On');
      await resetFeature('Reading Journal');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=challenge')).length, 0, 'reset clears challenges');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=book')).length, 5, 'books untouched by the reset');
      step('resting and reset touch only the journal’s own challenges, never your books');
    },
    commonplace: async () => {
      await o.goto(`${BASE}/dollhouse/commonplace`);
      await o.getByRole('button', { name: 'Open a commonplace book' }).click();
      await o.getByRole('button', { name: '+ A new entry' }).click();
      await o.getByLabel('The words').fill('I am half agony, half hope.');
      await o.getByLabel('From (book, article, film…)').fill('Persuasion');
      await o.getByLabel('By', { exact: true }).fill('Jane Austen');
      await o.getByLabel('Tags').fill('love, letters');
      await o.getByLabel('Linked to one of my things').fill('Book: Persuasion');
      await o.getByLabel('Favourite ♥').check();
      await o.getByRole('button', { name: /^save/i }).click();
      const entry = o.locator('.cp-entry', { hasText: 'half agony' });
      await entry.waitFor();
      await entry.getByRole('link', { name: 'Book: Persuasion' }).waitFor();
      await o.getByRole('button', { name: '+ A new entry' }).click();
      await o.getByLabel('The words').fill('A note on violets.');
      await o.getByRole('button', { name: /^save/i }).click();
      await o.locator('.cp-entry', { hasText: 'violets' }).waitFor();
      await shot(o, 'commonplace');
      step('entries keep their words, source, author, tags and a link to one of my books');
      await o.getByRole('button', { name: '♥ favourites' }).click();
      assert.equal(await o.locator('.cp-entry').count(), 1, 'favourites filter');
      await o.getByRole('button', { name: '♥ favourites' }).click();
      await o.getByRole('button', { name: '#letters' }).first().click();
      assert.equal(await o.locator('.cp-entry').count(), 1, 'tag filter');
      await o.getByRole('button', { name: '#letters' }).first().click();
      await o.getByLabel('Search the commonplace book').fill('violets');
      assert.equal(await o.locator('.cp-entry').count(), 1, 'search');
      await o.getByLabel('Search the commonplace book').fill('');
      const [dl] = await Promise.all([o.waitForEvent('download'), o.getByRole('button', { name: 'Export as text' }).click()]);
      const text = (await import('node:fs')).readFileSync((await dl.path())!, 'utf8');
      assert.match(text, /> I am half agony, half hope\.[\s\S]*Jane Austen, \*Persuasion\*/);
      step('favourites, tags and search filter the book; export produces a tidy text file');
      await publish();
      await v.goto(`${BASE}/room/commonplace-book`);
      await v.waitForTimeout(800);
      assert.equal(await v.locator('.cp-entry').count(), 0, 'private commonplace book stays private');
      await setMode('The Commonplace Book', 'Resting');
      await o.goto(`${BASE}/dollhouse/commonplace`);
      await o.getByText('The Commonplace Book is resting').waitFor();
      await setMode('The Commonplace Book', 'On');
      await o.goto(`${BASE}/dollhouse/commonplace`);
      await o.locator('.cp-entry').nth(1).waitFor();
      await resetFeature('The Commonplace Book');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=excerpt')).length, 0, 'reset clears entries');
      assert.ok((await t.api(o, 'GET', '/api/items?kind=book')).length >= 1, 'books untouched');
      step('private by default; resting keeps entries; reset clears only commonplace entries');
    },
    shops: async () => {
      const build = async (template: string, name: string) => {
        await o.goto(`${BASE}/atelier/rooms`);
        await o.locator('.template-card', { hasText: template }).click();
        await o.getByLabel('Room name').fill(name);
        await o.getByRole('button', { name: 'Build it' }).click();
        await o.locator('.room-rows li', { hasText: name }).waitFor();
      };
      const save = async () => { await o.getByRole('button', { name: /^save/i }).click(); await o.waitForTimeout(300); };
      await build('Picture house', 'Picture House');
      await o.goto(`${BASE}/room/picture-house`);
      await o.getByRole('button', { name: '+ A film' }).click();
      await o.getByLabel('Title').fill('Roman Holiday');
      await o.getByLabel('Year').fill('1953');
      await o.getByLabel('Director').fill('William Wyler');
      await o.getByLabel('Status').fill('Favourite');
      await o.getByLabel('Review').fill('Gelato, Vespas and a bittersweet goodbye.');
      await save();
      await o.getByRole('button', { name: '+ To the watchlist' }).click();
      await o.getByLabel('Title').fill('Brief Encounter');
      await save();
      await o.getByRole('button', { name: 'Roman Holiday (1953)' }).waitFor();
      await o.locator('.marquee', { hasText: 'Roman Holiday' }).waitFor();
      await o.getByRole('button', { name: 'Watchlist', exact: true }).click();
      assert.equal(await o.locator('.poster').count(), 1, 'watchlist filter');
      await o.getByRole('button', { name: 'every film' }).click();
      await o.getByRole('button', { name: 'Roman Holiday (1953)' }).click();
      await o.getByText('Gelato, Vespas').waitFor();
      await o.keyboard.press('Escape');
      await shot(o, 'picture-house');
      step('Picture House: films with posters, reviews, favourites, a watchlist and a marquee');
      await build('Record shop', 'Record Shop');
      await o.goto(`${BASE}/room/record-shop`);
      await o.getByRole('button', { name: '+ A record' }).click();
      await o.getByLabel('Title').fill('Blue');
      await o.getByLabel('Artist').fill('Joni Mitchell');
      await o.getByLabel('Review').fill('Every song a pressed flower.');
      await save();
      await o.getByRole('region', { name: 'Crate: New arrivals' }).getByRole('button', { name: 'Blue by Joni Mitchell' }).click();
      await o.getByText('Every song a pressed flower.').waitFor();
      await o.keyboard.press('Escape');
      await t.api(o, 'POST', '/api/items', { kind: 'music', roomId: 'music', visibility: 'public', data: { title: 'Pavilion record' } });
      await shot(o, 'record-shop');
      step('Record Shop: records in crates with reviews');
      await build('Bookshop', 'Bookshop');
      await o.goto(`${BASE}/room/bookshop`);
      await o.getByRole('button', { name: '+ A book for the shop' }).click();
      await o.getByLabel('Title').fill('I Capture the Castle');
      await o.getByLabel('Author').fill('Dodie Smith');
      await o.getByLabel('Bookshop note (handwritten card)').fill('For anyone who has ever sat in a kitchen sink to write.');
      await o.getByLabel('On my wishlist').check();
      await o.getByLabel('Secret message tucked inside').fill('Cassandra would approve of you.');
      await save();
      await o.getByRole('region', { name: 'Display: Staff picks' }).getByText('For anyone who has ever sat').waitFor();
      await o.getByRole('region', { name: 'Wishlist' }).getByText('I Capture the Castle').waitFor();
      await o.getByRole('button', { name: /something is tucked inside/i }).click();
      await o.getByText('Cassandra would approve of you.').waitFor();
      await o.keyboard.press('Escape');
      await shot(o, 'bookshop');
      step('Bookshop: displays, handwritten recommendation cards, a wishlist and a pressed-flower secret');
      // Visitors see a shop once it's public and published; private ones stay hidden.
      await o.goto(`${BASE}/atelier/rooms`);
      await o.locator('.room-rows li', { hasText: 'Picture House' }).getByRole('radio', { name: /public/i }).click();
      await o.waitForTimeout(500);
      await publish();
      await v.goto(`${BASE}/room/picture-house`);
      await v.getByRole('button', { name: 'Roman Holiday (1953)' }).waitFor();
      assert.equal(await v.getByText('Only you see this').count(), 0, 'no owner tools for visitors');
      await v.goto(`${BASE}/room/bookshop`);
      await v.waitForTimeout(800);
      assert.equal(await v.locator('.shop-book').count(), 0, 'private bookshop stays private');
      step('a public Picture House is visible to visitors; the private Bookshop is not');
      // Lifecycle and resets that leave the rest alone.
      await setMode('The Picture House', 'Resting');
      await o.goto(`${BASE}/room/picture-house`);
      await o.getByText('The Picture House is resting').waitFor();
      await publish();
      const pub = await t.api(v, 'GET', '/api/config/world');
      assert.ok(!JSON.stringify(pub.published.rooms).includes('picture-house'), 'resting room left out of the public world');
      await setMode('The Picture House', 'On');
      await publish();
      await o.goto(`${BASE}/room/picture-house`);
      await o.getByRole('button', { name: 'Roman Holiday (1953)' }).waitFor();
      const booksBefore = (await t.api(o, 'GET', '/api/items?kind=book')).length;
      await resetFeature('The Picture House');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=film')).length, 0, 'films reset');
      await resetFeature('The Record Shop');
      const music = await t.api(o, 'GET', '/api/items?kind=music');
      assert.ok(music.some((m: any) => m.data.title === 'Pavilion record') && !music.some((m: any) => m.data.title === 'Blue'), 'record shop reset spares the Gramophone Pavilion');
      await resetFeature('The Bookshop');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=book')).length, booksBefore - 1, 'bookshop reset removes only bookshop books');
      step('resting hides a shop everywhere; each reset clears only its own shop (library and pavilion untouched)');
    },
    museum: async () => {
      await o.goto(`${BASE}/atelier/rooms`);
      await o.locator('.template-card', { hasText: 'Memory museum' }).click();
      await o.getByLabel('Room name').fill('Memory Museum');
      await o.getByRole('button', { name: 'Build it' }).click();
      await o.goto(`${BASE}/room/memory-museum`);
      for (const [title, date, ex] of [['The first snow', '2019-12-02', 'Firsts'], ['Lavender fields', '2022-07-14', 'Summers'], ['Grandmother’s kitchen', '2015-04-01', 'People I love']]) {
        await o.getByRole('button', { name: '+ A memory' }).click();
        await o.getByLabel('Title').fill(title);
        await o.getByLabel('When').fill(date);
        await o.locator('input[list="opts-exhibition"]').fill(ex);
        await o.getByLabel('The story').fill(`About ${title}.`);
        await o.getByRole('button', { name: /^save/i }).click();
        await o.waitForTimeout(300);
      }
      await o.getByRole('region', { name: 'Exhibition: Summers' }).getByRole('button', { name: 'Lavender fields' }).waitFor();
      await o.getByRole('tab', { name: 'Timeline' }).click();
      const years = await o.locator('.museum-year').allTextContents();
      assert.deepEqual(years, ['2015', '2019', '2022'], 'timeline in order');
      await o.getByRole('button', { name: 'The first snow' }).click();
      await o.getByText('About The first snow.').waitFor();
      await o.keyboard.press('Escape');
      await shot(o, 'museum');
      const mems = await t.api(o, 'GET', '/api/items?kind=memory');
      assert.ok(mems.every((m: any) => m.visibility === 'private'), 'memories are private by default');
      await publish();
      await v.goto(`${BASE}/room/memory-museum`);
      await v.waitForTimeout(800);
      assert.equal(await v.locator('.museum-frame').count(), 0, 'visitors cannot see the museum');
      step('Memory Museum: exhibitions and a timeline, private by default');
      await setMode('The Memory Museum', 'Resting');
      await o.goto(`${BASE}/room/memory-museum`);
      await o.getByText('The Memory Museum is resting').waitFor();
      await setMode('The Memory Museum', 'On');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=memory')).length, 3, 'memories survive resting');
      await resetFeature('The Memory Museum');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=memory')).length, 0, 'reset clears memories');
      step('resting keeps memories; reset clears only memories');
    },
    scrapbook: async () => {
      await o.goto(`${BASE}/dollhouse/scrapbook`);
      await o.getByRole('button', { name: '+ A new scrapbook' }).click();
      await o.getByLabel('Title').fill('Summer by the sea');
      await o.getByRole('button', { name: 'Begin' }).click();
      await o.getByRole('button', { name: 'Add Satin bow' }).click();
      await o.getByRole('button', { name: 'Add Heart' }).click();
      await o.getByRole('button', { name: '+ Text' }).click();
      await o.getByText('saved ♡').waitFor();
      await o.waitForTimeout(1200);
      await o.getByRole('button', { name: '+ page' }).click();
      await o.getByLabel('Paper').selectOption('kraft');
      await o.getByRole('button', { name: 'Add Butterfly' }).click();
      await o.waitForTimeout(1200);
      await o.reload();
      await o.getByRole('button', { name: 'Open Summer by the sea' }).click();
      assert.equal(await o.locator('.editor .scene .obj').count(), 3, 'page 1 kept its three things');
      await o.getByRole('tab', { name: 'page 2' }).click();
      assert.equal(await o.getByLabel('Paper').inputValue(), 'kraft');
      assert.equal(await o.locator('.editor .scene .obj').count(), 1, 'page 2 kept its butterfly');
      await o.getByRole('tab', { name: 'page 1' }).click();
      await shot(o, 'scrapbook');
      step('scrapbook pages are arranged with the Atelier editor and saved automatically, page by page');
      const [svgDl] = await Promise.all([o.waitForEvent('download'), o.getByRole('button', { name: '…as SVG' }).click()]);
      const svgText = (await import('node:fs')).readFileSync((await svgDl.path())!, 'utf8');
      assert.ok(svgText.startsWith('<svg') && !svgText.includes('var(--'), 'SVG export is standalone, with theme colours resolved');
      const [pngDl] = await Promise.all([o.waitForEvent('download', { timeout: 10000 }), o.getByRole('button', { name: 'Download page as PNG' }).click()]);
      const png = (await import('node:fs')).readFileSync((await pngDl.path())!);
      assert.equal(png.subarray(1, 4).toString(), 'PNG', 'PNG export');
      (await import('node:fs')).writeFileSync('docs/screenshots/v2/scrapbook-export.png', png);
      step('a page downloads as a PNG picture or a standalone SVG');
      await setMode('Scrapbook studio', 'Resting');
      await o.goto(`${BASE}/dollhouse/scrapbook`);
      await o.getByText('Scrapbook studio is resting').waitFor();
      await setMode('Scrapbook studio', 'On');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=scrapbook')).length, 1, 'kept while resting');
      await resetFeature('Scrapbook studio');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=scrapbook')).length, 0, 'reset clears scrapbooks');
      step('resting keeps scrapbooks; reset clears only scrapbooks');
    },
    letters: async () => {
      await o.goto(`${BASE}/dollhouse/letters`);
      await o.getByRole('button', { name: '+ Write a letter' }).click();
      await o.getByLabel('To').fill('Clementine');
      await o.getByLabel('Your letter').fill('The roses came up this morning.\n\nI thought of you at once.');
      await o.getByLabel('From').fill('Rosalind');
      await o.getByLabel('Stationery').selectOption('rose');
      await o.getByLabel('Seal mark').selectOption('R');
      await o.getByText('saved ♡').waitFor();
      await o.waitForTimeout(900);
      await shot(o, 'letter-desk');
      const [dl] = await Promise.all([o.waitForEvent('download', { timeout: 10000 }), o.getByRole('button', { name: 'Download letter (PNG)' }).click()]);
      const letterPng = (await import('node:fs')).readFileSync((await dl.path())!);
      assert.equal(letterPng.subarray(1, 4).toString(), 'PNG');
      (await import('node:fs')).writeFileSync('docs/screenshots/v2/letter-export.png', letterPng);
      step('a letter on rose stationery with a wax seal; it downloads as a picture');
      const all = await t.api(o, 'GET', '/api/items?kind=letter');
      assert.equal(all[0].visibility, 'private', 'letters start private');
      const id = all[0].id;
      await v.goto(`${BASE}/letter/${id}`);
      await v.getByText('No letter here').waitFor();
      await o.getByRole('button', { name: 'Share by link…' }).click();
      await o.getByLabel('Link to this letter').waitFor();
      assert.match(await o.getByLabel('Link to this letter').inputValue(), new RegExp(`/letter/${id}$`));
      await v.goto(`${BASE}/letter/${id}`);
      await v.getByRole('button', { name: /break the seal/i }).click();
      await v.getByText('Dear Clementine,').waitFor();
      await v.getByText('I thought of you at once.').waitFor();
      await shot(v, 'letter-opened');
      const listed = await t.api(v, 'GET', '/api/items?kind=letter');
      assert.ok(!Array.isArray(listed) || listed.length === 0, 'shared letters are never listed');
      const gb = await t.api(v, 'GET', '/api/items?kind=guestbook');
      assert.ok(!JSON.stringify(gb).includes('Clementine'), 'letters never appear in the guestbook');
      step('private until shared; a shared letter opens by its link only, never listed and never in the guestbook');
      await o.getByRole('button', { name: 'Stop sharing' }).click();
      await o.waitForTimeout(400);
      await v.goto(`${BASE}/letter/${id}`);
      await v.getByText('No letter here').waitFor();
      await o.getByRole('button', { name: 'Share by link…' }).click();
      await o.waitForTimeout(300);
      await setMode('Letter-writing desk', 'Resting');
      await publish();
      await v.goto(`${BASE}/letter/${id}`);
      await v.getByText('Letter-writing desk is resting').waitFor();
      await setMode('Letter-writing desk', 'On');
      await publish();
      await v.goto(`${BASE}/letter/${id}`);
      await v.getByRole('button', { name: /break the seal/i }).waitFor();
      await resetFeature('Letter-writing desk');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=letter')).length, 0, 'reset clears letters');
      step('stop sharing works at once; resting hides shared links; reset clears only letters');
    },
    capsules: async () => {
      await o.goto(`${BASE}/dollhouse/capsules`);
      await o.getByRole('button', { name: '+ A new time capsule' }).click();
      await o.getByLabel('Name').fill('To me, next spring');
      await o.getByLabel('Open on').fill(`${new Date().getFullYear() + 1}-04-01`);
      await o.getByLabel('A letter to the future').fill('I hope the lilacs came back.');
      await o.getByLabel('Links to keep').fill('https://example.com/lilacs');
      await o.getByRole('button', { name: 'Add', exact: true }).click();
      await o.getByRole('button', { name: 'Seal the capsule' }).click();
      const sealed = o.getByRole('article', { name: 'To me, next spring' });
      await sealed.getByText(/opens .* in \d+ days/).waitFor();
      assert.equal(await o.getByText('I hope the lilacs came back.').count(), 0, 'sealed contents stay hidden');
      await o.getByRole('button', { name: '+ A new time capsule' }).click();
      await o.getByLabel('Name').fill('For today');
      await o.getByLabel('Open on').fill(new Date(Date.now() - 86400_000).toISOString().slice(0, 10));
      await o.getByLabel('A letter to the future').fill('Surprise from the past.');
      await o.getByRole('button', { name: 'Seal the capsule' }).click();
      await o.getByRole('article', { name: 'For today' }).getByText('ready to open').waitFor();
      await shot(o, 'capsules');
      step('capsules seal letters and links for a future day; contents stay hidden until then');
      await sealed.getByRole('button', { name: 'Open early…' }).click();
      await o.getByRole('button', { name: 'Open it now' }).click();
      await o.getByText('I hope the lilacs came back.').waitFor();
      await o.getByRole('button', { name: 'Seal it again' }).click();
      await sealed.getByRole('button', { name: 'Open early…' }).waitFor();
      await o.getByRole('article', { name: 'For today' }).getByRole('button', { name: 'Open the capsule' }).click();
      await o.getByText('Surprise from the past.').waitFor();
      await o.keyboard.press('Escape');
      await sealed.getByRole('button', { name: 'Unseal to change' }).click();
      await o.getByLabel('A letter to the future').fill('I hope the lilacs came back. And the swans.');
      await o.getByRole('button', { name: 'Seal it again' }).click();
      const caps = await t.api(o, 'GET', '/api/items?kind=capsule');
      assert.ok(caps.some((c: any) => c.data.letter.includes('swans')), 'unsealing to change works');
      assert.ok(caps.every((c: any) => c.visibility === 'private'), 'capsules are always private');
      step('nothing is ever locked: open early, seal again, or unseal to change; capsules are always private');
      await setMode('Time capsules', 'Resting');
      await o.goto(`${BASE}/dollhouse/capsules`);
      await o.getByText('Time capsules is resting').waitFor();
      await setMode('Time capsules', 'On');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=capsule')).length, 2, 'kept while resting');
      await resetFeature('Time capsules');
      assert.equal((await t.api(o, 'GET', '/api/items?kind=capsule')).length, 0, 'reset clears capsules');
      step('resting keeps capsules; reset clears only capsules');
    },
    rabbitmap: async () => {
      const now = new Date().toISOString();
      const exp = (title: string, finds: [string, string][]) => t.api(o, 'POST', '/api/items', { kind: 'expedition', visibility: 'private', roomId: null, data: { title, mode: 'wander', startedAt: now, endedAt: now, discoveries: finds.map(([id, ft]) => ({ id, title: ft, url: `https://example.com/${id}`, savedAt: now })) } });
      const e1 = await exp('Victorian flower language', [['tussie', 'Tussie-mussies'], ['greenaway', 'Kate Greenaway']]);
      await exp('Old seaside towns', [['piers', 'Pleasure piers'], ['huts', 'Bathing huts']]);
      await o.goto(`${BASE}/stargirl/map`);
      const node = (name: string) => o.getByRole('button', { name, exact: true });
      await node('Expedition: Victorian flower language').waitFor();
      assert.equal(await o.locator('.map-node').count(), 6, 'two stars and four discoveries');
      await o.locator('svg.rabbit-map').scrollIntoViewIfNeeded();
      const box = (await node('Discovery: Tussie-mussies').locator('circle').boundingBox())!;
      await o.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await o.mouse.down(); await o.mouse.move(box.x + 140, box.y + 90, { steps: 8 }); await o.mouse.up();
      await o.waitForTimeout(900);
      const saved = (await t.api(o, 'GET', `/api/items/${e1.id}`)).data.map;
      assert.ok(saved?.pos?.['d:tussie'], 'dragged position saved on the expedition');
      step('expeditions become stars with their discoveries around them; dragging a node is remembered');
      await node('Discovery: Kate Greenaway').locator('circle').click();
      await o.getByRole('button', { name: /draw a thread/i }).click();
      await node('Discovery: Bathing huts').locator('circle').click();
      await o.locator('.map-thread').waitFor({ state: 'attached' });
      await o.waitForTimeout(900);
      await o.reload();
      await o.locator('.map-thread').waitFor({ state: 'attached' });
      const stored = ((await t.api(o, 'GET', '/api/items?kind=expedition')) as any[]).flatMap((e) => e.data.map?.links ?? []);
      assert.ok(stored.length === 1 && !Array.isArray(stored[0]) && stored[0].from && stored[0].to, 'threads are stored as {from, to} (Firestore refuses arrays inside arrays)');
      const refused = await t.api(o, 'POST', '/api/items', { kind: 'expedition', visibility: 'private', roomId: null, data: { title: 'nested', mode: 'wander', startedAt: now, discoveries: [], map: { links: [['d:a', 'd:b']] } } });
      assert.match(JSON.stringify(refused), /list inside a list/, 'lists inside lists are refused on both versions, with a clear message');
      await o.getByLabel('Search the map').fill('greenaway');
      assert.equal(await o.locator('.map-node.dim').count(), 5, 'search highlights matching nodes');
      await o.getByLabel('Search the map').fill('');
      const vb = await o.locator('svg.rabbit-map').getAttribute('viewBox');
      await o.getByRole('button', { name: 'Zoom in' }).click();
      assert.notEqual(await o.locator('svg.rabbit-map').getAttribute('viewBox'), vb, 'zoom');
      await o.getByRole('button', { name: 'Old seaside towns', exact: true }).click();
      assert.equal(await o.locator('.map-node').count(), 3, 'topics can be hidden');
      await o.getByRole('button', { name: 'Old seaside towns', exact: true }).click();
      await shot(o, 'rabbit-map');
      step('threads connect ideas across expeditions and are kept; search, zoom and topic filters work');
      await setMode('Rabbit-hole map', 'Resting');
      await o.goto(`${BASE}/stargirl/map`);
      await o.getByText('Rabbit-hole map is resting').waitFor();
      await setMode('Rabbit-hole map', 'On');
      await resetFeature('Rabbit-hole map');
      const after = await t.api(o, 'GET', `/api/items/${e1.id}`);
      assert.equal(after.data.map, undefined, 'reset forgets map positions and threads');
      assert.equal(after.data.discoveries.length, 2, 'discoveries untouched');
      step('reset forgets only the map layout; expeditions and discoveries stay');
    },
    paths: async () => {
      await v.goto(`${BASE}/paths`);
      await v.getByText('The paths are still misty').waitFor();
      await o.goto(`${BASE}/paths`);
      const meadow = o.getByRole('article', { name: 'The Wildflower Meadow' });
      await meadow.getByRole('button', { name: 'Open this path' }).click();
      await meadow.getByRole('button', { name: 'Reveal to visitors' }).click();
      await o.getByRole('article', { name: 'The Swan Lake' }).getByRole('button', { name: 'Open this path' }).click();
      await o.waitForTimeout(500);
      await shot(o, 'paths-owner');
      await publish();
      await v.goto(`${BASE}/paths`);
      await v.getByRole('link', { name: 'Wander The Wildflower Meadow' }).click();
      await v.waitForURL(/room\/path-meadow/);
      await v.locator('.region-stage .scene').waitFor();
      await shot(v, 'path-meadow');
      assert.equal(await v.getByRole('article', { name: 'The Swan Lake' }).count(), 0);
      const pub = await t.api(v, 'GET', '/api/config/world');
      assert.ok(!JSON.stringify(pub.published.rooms).includes('path-lakeside'), 'unrevealed path is not sent to visitors');
      step('paths open privately, are revealed when you choose, and visitors wander them with no quests');
      await o.goto(`${BASE}/atelier/room/path-meadow`);
      await o.locator('.editor').waitFor();
      step('each path is arranged in the Atelier room editor');
      await o.goto(BASE); await enter(o);
      await o.getByRole('link', { name: 'Paths' }).first().waitFor();
      await setMode('Paths beyond the village', 'Hidden');
      await o.goto(BASE); await enter(o);
      assert.equal(await o.locator('nav').getByRole('link', { name: 'Paths', exact: true }).count(), 0, 'hidden from the menu');
      await setMode('Paths beyond the village', 'Resting');
      await publish();
      await v.goto(`${BASE}/paths`);
      await v.getByText('Paths beyond the village is resting').waitFor();
      const pub2 = await t.api(v, 'GET', '/api/config/world');
      assert.ok(!JSON.stringify(pub2.published.rooms).includes('path-meadow'), 'resting paths leave the public world');
      await setMode('Paths beyond the village', 'On');
      await publish();
      await v.goto(`${BASE}/room/path-meadow`);
      await v.locator('.region-stage .scene').waitFor();
      step('hidden takes Paths out of the menu; resting hides every path from visitors; on brings them back');
    },
    games: async () => {
      await o.goto(`${BASE}/atelier/rooms`);
      await o.locator('.template-card', { hasText: 'Games parlour' }).click();
      await o.getByLabel('Room name').fill('Games Parlour');
      await o.getByRole('button', { name: 'Build it' }).click();
      await o.locator('.room-rows li', { hasText: 'Games Parlour' }).getByRole('radio', { name: /public/i }).click();
      await o.waitForTimeout(500);
      await publish();
      await v.goto(`${BASE}/room/games-parlour`);
      await v.evaluate(() => { localStorage.removeItem('rm-achievements'); localStorage.removeItem('rm-pearls'); localStorage.removeItem('rm-games'); });
      await v.reload();
      await shot(v, 'games');
      // Memory: learn the cards two at a time, then match them up.
      await v.getByRole('button', { name: /memory cards/i }).click();
      const seen = new Map<number, string>();
      const card = (i: number) => v.locator('.memory-card').nth(i);
      for (let i = 0; i < 16; i += 2) {
        await card(i).click(); await card(i + 1).click();
        seen.set(i, (await card(i).getAttribute('aria-label'))!); seen.set(i + 1, (await card(i + 1).getAttribute('aria-label'))!);
        await v.waitForTimeout(1000);
      }
      const byArt = new Map<string, number[]>();
      for (const [i, a] of seen) byArt.set(a, [...(byArt.get(a) ?? []), i]);
      for (const [, [a, b]] of byArt) {
        if (await card(a).getAttribute('aria-pressed') === 'true' && (await card(a).getAttribute('class'))!.includes('matched')) continue;
        await card(a).click(); await card(b).click(); await v.waitForTimeout(250);
      }
      await v.getByText(/All pairs found in \d+ turns/).waitFor();
      await v.getByRole('button', { name: '← All games' }).click();
      // Hidden objects.
      await v.getByRole('button', { name: /hidden in the garden/i }).click();
      for (const thing of ['teacup', 'letter', 'heart', 'star', 'butterfly']) await v.getByRole('button', { name: `tap the ${thing}`, exact: true }).click({ force: true });
      await v.getByText('Everything found ✿').waitFor();
      await v.getByRole('button', { name: '← All games' }).click();
      // Sorting the post.
      await v.getByRole('button', { name: /sorting the post/i }).click();
      for (let k = 0; k < 8; k++) {
        const letter = v.locator('.post-letter').first();
        const house = (await letter.getAttribute('aria-label'))!.split(', ').pop()!;
        await letter.click();
        await v.getByRole('button', { name: `Pigeonhole: ${house}` }).click();
      }
      await v.getByText('All the post is sorted ✿').waitFor();
      await v.getByRole('button', { name: '← All games' }).click();
      // The flower table.
      await v.getByRole('button', { name: /the flower table/i }).click();
      for (const f of ['Rose', 'Peony', 'Daisy', 'Lavender']) await v.getByRole('button', { name: `Add a ${f}` }).click();
      await v.getByRole('button', { name: 'Glass bottle' }).click();
      await shot(v, 'flower-table');
      await v.getByRole('button', { name: 'Keep this bouquet' }).click();
      await v.getByRole('region', { name: 'Kept bouquets' }).locator('svg').first().waitFor();
      await v.getByRole('button', { name: '← All games' }).click();
      // Picture puzzle: read the board and solve it with a breadth-first search.
      await v.getByRole('button', { name: /picture puzzle/i }).click();
      const labels = await v.locator('.puzzle-tile').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      const start = labels.map((l) => (l === 'gap' ? 8 : Number(l!.split(' ')[1]) - 1));
      const goal = '0,1,2,3,4,5,6,7,8';
      const prev = new Map<string, [string, number] | null>([[start.join(), null]]);
      const queue = [start.join()];
      while (queue.length) {
        const cur = queue.shift()!; if (cur === goal) break;
        const t = cur.split(',').map(Number); const e = t.indexOf(8);
        for (const d of [-3, 3, -1, 1]) {
          const j = e + d; if (j < 0 || j > 8 || (Math.abs(d) === 1 && Math.floor(j / 3) !== Math.floor(e / 3))) continue;
          const n = [...t]; [n[e], n[j]] = [n[j], n[e]]; const key = n.join();
          if (!prev.has(key)) { prev.set(key, [cur, j]); queue.push(key); }
        }
      }
      const path: number[] = []; let at = goal;
      while (prev.get(at)) { const [p, j] = prev.get(at)!; path.unshift(j); at = p; }
      for (const j of path) await v.locator('.puzzle-tile').nth(j).click();
      await v.getByText(/The lake is whole again/).waitFor();
      step('a visitor can play all five games — memory, hidden objects, post sorting, flowers, puzzle — untimed');
      const ach = await v.evaluate(() => JSON.parse(localStorage.getItem('rm-achievements') ?? '{}'));
      for (const a of ['games-memory', 'games-hidden', 'games-letters', 'games-flowers', 'games-puzzle']) assert.ok(ach[a], `visitor earned ${a}`);
      const pearls = await v.evaluate(() => JSON.parse(localStorage.getItem('rm-pearls') ?? '{}').pearls);
      assert.ok(pearls > 0, 'visitor pearls are kept on their own device');
      step('a visitor’s achievements and pearls live only on their own device');
      await v.goto(`${BASE}/room/library`);
      await v.getByRole('heading', { level: 1 }).first().waitFor();
      step('games never gate anything: every room opens without playing');
    },
    charms: async () => {
      await o.goto(`${BASE}/dollhouse/charms`);
      await o.getByRole('region', { name: 'Achievements' }).waitFor();
      const before = Number(await o.locator('.pearl-purse strong').textContent());
      // Earn a few pearls at the flower table (the owner's progress saves privately).
      const room = (await t.api(o, 'GET', '/api/config/world')).draft.rooms.find((r: any) => r.template === 'games');
      await o.goto(`${BASE}/room/${room.id}`);
      await o.getByRole('button', { name: /the flower table/i }).click();
      for (const f of ['Rose', 'Tulip', 'Daisy']) await o.getByRole('button', { name: `Add a ${f}` }).click();
      await o.getByRole('button', { name: 'Keep this bouquet' }).click();
      await o.waitForTimeout(800);
      await o.goto(`${BASE}/dollhouse/charms`);
      await o.getByRole('region', { name: 'Kept bouquets' }).waitFor();
      const now = Number(await o.locator('.pearl-purse strong').textContent());
      assert.ok(now > before, `pearls grew (${before} → ${now})`);
      const prog = await t.api(o, 'GET', '/api/items?kind=progress');
      assert.equal(prog.length, 1); assert.equal(prog[0].visibility, 'private', 'owner progress is private');
      await o.getByRole('article', { name: 'Gilded frame' }).getByRole('button', { name: '8 pearls' }).click();
      await o.getByRole('article', { name: 'Gilded frame' }).getByText('on your bracelet ✓').waitFor();
      await o.getByRole('region', { name: 'Charm bracelet' }).waitFor();
      await shot(o, 'charms');
      step('pearls from playing buy keepsake charms for the bracelet; every charm is also free in the Atelier');
      const left = Number(await o.locator('.pearl-purse strong').textContent());
      if (left < 20) {
        await o.getByRole('article', { name: 'Vintage Valentine theme' }).getByRole('button', { name: '20 pearls' }).click();
        await o.getByText(/needs 20 pearls/).waitFor();
        step('not enough pearls: a gentle note, no pressure, nothing locked');
      }
      await setMode('Pearls & the Charm Shop', 'Resting');
      await o.goto(`${BASE}/dollhouse/charms`);
      await o.getByRole('region', { name: 'Achievements' }).waitFor();
      assert.equal(await o.locator('.pearl-purse').count(), 0, 'no purse while pearls rest');
      assert.equal(await o.getByRole('region', { name: 'The Charm Shop' }).count(), 0, 'no shop while pearls rest');
      await setMode('Pearls & the Charm Shop', 'On');
      await o.goto(`${BASE}/dollhouse/charms`);
      assert.equal(Number(await o.locator('.pearl-purse strong').textContent()), left, 'pearls kept while resting');
      await resetFeature('Achievements');
      await o.goto(`${BASE}/dollhouse/charms`);
      assert.equal(await o.locator('.achievement.earned').count(), 0, 'achievements reset');
      assert.equal(Number(await o.locator('.pearl-purse strong').textContent()), left, 'pearls untouched by the achievements reset');
      await resetFeature('Pearls & the Charm Shop');
      await o.goto(`${BASE}/dollhouse/charms`);
      assert.equal(Number(await o.locator('.pearl-purse strong').textContent()), 0, 'pearls reset');
      assert.equal(await o.getByRole('region', { name: 'Charm bracelet' }).count(), 0, 'charms reset');
      await o.getByRole('region', { name: 'Kept bouquets' }).waitFor();
      await resetFeature('Little games');
      await o.goto(`${BASE}/dollhouse/charms`);
      await o.getByRole('region', { name: 'Achievements' }).waitFor();
      assert.equal(await o.getByRole('region', { name: 'Kept bouquets' }).count(), 0, 'games reset clears bouquets');
      await setMode('Little games', 'Resting');
      await o.goto(`${BASE}/room/${room.id}`);
      await o.getByText('Little games is resting').waitFor();
      await setMode('Little games', 'On');
      step('achievements, pearls and games each rest and reset on their own without touching the others');
    },
    isolation: async () => {
      const { FEATURES } = await import('../shared/features');
      const { ITEM_KINDS } = await import('../shared/types');
      await o.goto(`${BASE}/dollhouse`);
      // Something of every kind of thing, so a careless reset would have something to destroy.
      const cfg0 = await t.api(o, 'GET', '/api/config/world');
      const extraRooms = [['iso-records', 'recordstore'], ['iso-books', 'bookstore'], ['iso-cinema', 'cinema'], ['iso-museum', 'museum'], ['iso-commonplace', 'commonplace']]
        .filter(([id]) => !cfg0.draft.rooms.some((r: any) => r.id === id)).map(([id, template]) => ({ id, name: id, template, visibility: 'private' }));
      await t.api(o, 'PUT', '/api/config/world/draft', { ...cfg0.draft, rooms: [...cfg0.draft.rooms, ...extraRooms] });
      const seedRoom: Record<string, string | null> = { book: 'library', music: 'music', entry: 'journal', artwork: 'gallery', note: 'garden', link: 'webring', drink: 'cafe', star: 'observatory', secret: 'secret-garden', film: 'iso-cinema', memory: 'iso-museum', excerpt: 'iso-commonplace' };
      for (const kind of ITEM_KINDS.filter((k) => !['media', 'progress', 'guestbook'].includes(k))) {
        await t.api(o, 'POST', '/api/items', { kind, roomId: seedRoom[kind] ?? null, visibility: 'private', data: { title: `iso ${kind}`, url: 'https://example.com/x', text: `iso ${kind}`, discoveries: [], map: { pos: {} }, stories: [], pages: [], date: '2020-01-01', openOn: '2030-01-01', target: 1, year: 2020, unit: 'books', letter: '', images: [], links: [] } });
      }
      // Kinds shared by several features also live in their shops, so each shop's reset must spare the originals.
      await t.api(o, 'POST', '/api/items', { kind: 'music', roomId: 'iso-records', visibility: 'private', data: { title: 'shop record' } });
      await t.api(o, 'POST', '/api/items', { kind: 'book', roomId: 'iso-books', visibility: 'private', data: { title: 'shop book' } });
      const snapshot = async () => {
        const items: Record<string, any> = {};
        for (const kind of ITEM_KINDS.filter((k) => k !== 'progress')) for (const it of (await t.api(o, 'GET', `/api/items?kind=${kind}`)) as any[]) items[it.id] = it;
        const c = await t.api(o, 'GET', '/api/config/world'); const th = await t.api(o, 'GET', '/api/config/theme');
        return { items, rooms: c.draft.rooms, objects: c.draft.objects, theme: JSON.stringify(th.draft) };
      };
      const strip = (it: any, keys: string[]) => { const d = { ...it.data }; for (const k of keys) delete d[k]; return JSON.stringify({ k: it.kind, r: it.roomId, v: it.visibility, d }); };
      const before = await snapshot();
      assert.ok(Object.keys(before.items).length >= 25, 'a full set of things to protect');
      // 1. Rest every feature, then wake them all: nothing at all may change.
      for (const mode of ['Resting', 'On'] as const) {
        await o.goto(`${BASE}/atelier/features`);
        for (const card of await o.locator('article.fm-card').all()) {
          await card.getByRole('radio', { name: mode, exact: true }).click();
          await card.locator('.fm-badge').filter({ hasText: mode }).waitFor();
        }
        await o.waitForTimeout(1500);
      }
      await until(async () => { const now = await snapshot(); return JSON.stringify(Object.keys(now.items).sort()) === JSON.stringify(Object.keys(before.items).sort()) && Object.keys(before.items).every((id) => strip(now.items[id], []) === strip(before.items[id], [])) && JSON.stringify(now.rooms) === JSON.stringify(before.rooms) && now.theme === before.theme; },
        'resting and waking every feature changed nothing');
      step(`resting and waking all ${FEATURES.length} features left every item, room and the theme untouched`);
      // 2. Reset each feature in turn: only what its own description promises may go.
      let prev = before;
      for (const f of FEATURES.filter((x) => x.reset)) {
        await resetFeature(f.name);
        const r = f.reset!;
        const scopedRooms = r.inTemplates ? new Set(prev.rooms.filter((x: any) => r.inTemplates!.includes(x.template)).map((x: any) => x.id)) : null;
        const mayGo = (it: any) => !!r.kinds?.includes(it.kind) && (!scopedRooms || scopedRooms.has(it.roomId));
        const fieldKeys = (it: any) => (r.fields ?? []).filter((x) => x.kind === it.kind).flatMap((x) => x.keys);
        let now = prev;
        await until(async () => {
          now = await snapshot();
          return Object.values(prev.items).every((it: any) => (mayGo(it) ? !now.items[it.id] : !!now.items[it.id] && strip(now.items[it.id], fieldKeys(it)) === strip(it, fieldKeys(it))));
        }, `reset of “${f.name}” removed only its own things`);
        const roomsSame = JSON.stringify(now.rooms.map((x: any) => (f.id === 'bedroom' && x.settings?.bedroom ? x.id : x))) === JSON.stringify(prev.rooms.map((x: any) => (f.id === 'bedroom' && x.settings?.bedroom ? x.id : x)));
        assert.ok(roomsSame, `reset of “${f.name}” left the rooms alone`);
        assert.equal(now.theme, prev.theme, `reset of “${f.name}” left the theme alone`);
        assert.ok(now.objects.every((x: any) => prev.objects.some((y: any) => y.id === x.id)) && prev.objects.every((x: any) => (r.objects && x.feature === f.id) || now.objects.some((y: any) => y.id === x.id)), `reset of “${f.name}” left the map alone`);
        prev = now;
      }
      const after = prev;
      for (const k of ['iso book', 'iso entry', 'iso note', 'iso bookmark', 'iso inbox', 'iso artwork', 'iso link'])
        assert.ok(Object.values(after.items).some((it: any) => it.data.title === k), `${k} survived every reset`);
      assert.ok(Object.values(after.items).some((it: any) => it.data.title === 'iso music') && !Object.values(after.items).some((it: any) => it.data.title === 'shop record'), 'pavilion record kept, shop record reset');
      assert.ok(Object.values(after.items).some((it: any) => it.data.title === 'iso book') && !Object.values(after.items).some((it: any) => it.data.title === 'shop book'), 'library book kept, bookshop book reset');
      step(`each of ${FEATURES.filter((x) => x.reset).length} resets removed only that feature’s own things; books, pages, notes, bookmarks, letterbox, rooms, map and theme survived`);
    },
    polish: async () => {
      const pages = ['/dollhouse', '/dollhouse/pets', '/dollhouse/bedroom', '/dollhouse/newspaper', '/dollhouse/parlour', '/dollhouse/reading-journal', '/dollhouse/commonplace',
        '/dollhouse/scrapbook', '/dollhouse/letters', '/dollhouse/capsules', '/dollhouse/charms', '/stargirl/map', '/paths', '/atelier/features'];
      // Rooms and content so the room templates are audited with real things in them.
      await o.goto(`${BASE}/dollhouse`);
      const cfg = await t.api(o, 'GET', '/api/config/world');
      const add = [['pol-cinema', 'cinema'], ['pol-records', 'recordstore'], ['pol-books', 'bookstore'], ['pol-museum', 'museum'], ['pol-games', 'games'], ['pol-commonplace', 'commonplace']]
        .filter(([id]) => !cfg.draft.rooms.some((r: any) => r.id === id))
        .map(([id, template]) => ({ id, name: `Polish ${template}`, template, visibility: 'private', subtitle: 'audit room' }));
      if (!cfg.draft.rooms.some((r: any) => r.id === 'path-meadow')) add.push({ id: 'path-meadow', name: 'The Wildflower Meadow', template: 'region', visibility: 'private', subtitle: 'clover', settings: { landscape: 'meadow' } } as any);
      await t.api(o, 'PUT', '/api/config/world/draft', { ...cfg.draft, rooms: [...cfg.draft.rooms, ...add] });
      const item = (kind: string, roomId: string | null, data: any, visibility = 'private') => t.api(o, 'POST', '/api/items', { kind, roomId, visibility, data });
      await item('film', 'pol-cinema', { title: 'Roman Holiday', year: 1953, status: 'Favourite', review: 'Gelato.' });
      await item('film', 'pol-cinema', { title: 'Brief Encounter', status: 'Watchlist' });
      await item('music', 'pol-records', { title: 'Blue', artist: 'Joni Mitchell', crate: 'New arrivals', format: 'Vinyl' });
      await item('book', 'pol-books', { title: 'I Capture the Castle', author: 'Dodie Smith', shelf: 'Staff picks', recommendation: 'For kitchen-sink writers.', wishlist: true, secretMessage: 'hello' });
      await item('memory', 'pol-museum', { title: 'The first snow', date: '2019-12-02', exhibition: 'Firsts', description: 'Cold and bright.' });
      await item('excerpt', 'pol-commonplace', { text: 'I am half agony, half hope.', author: 'Jane Austen', source: 'Persuasion', tags: ['love'], favorite: true });
      const letter = await item('letter', null, { to: 'Clementine', from: 'Rosalind', body: 'The roses came up.', stationery: 'rose', envelope: '#f3d9df', stamp: 'bunny', ribbon: '#c97b8a', seal: '#9e2f45', sealMark: '♥', font: 'hand' }, 'unlisted');
      await item('capsule', null, { title: 'Next spring', letter: 'Hello', images: [], links: [], openOn: '2030-01-01', sealedAt: new Date().toISOString() });
      pages.push('/room/pol-cinema', '/room/pol-records', '/room/pol-books', '/room/pol-museum', '/room/pol-games', '/room/pol-commonplace', '/room/path-meadow', `/letter/${letter.id}`);
      const phone = await t.ownerCtx.browser()!.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await t.ownerCtx.storageState() });
      const m = await phone.newPage();
      const wide: string[] = [];
      for (const pth of pages) {
        await m.goto(`${BASE}${pth}`);
        await m.locator('main, .world-page, .page-main').first().waitFor(); await m.waitForTimeout(600); // (the cloud version keeps a live connection open, so the network never goes idle)
        await m.waitForTimeout(400);
        const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        if (sw > iw + 1) wide.push(`${pth} (${sw} > ${iw})`);
      }
      // Accessibility audit on every page, in each appearance: every control has a name, and text
      // has enough contrast against the nearest solid background (WCAG AA: 4.5, or 3 for large text).
      const problems: string[] = [];
      for (const a of ['coquette', 'quiet', 'midnight', 'pixie']) {
        await m.evaluate((x) => localStorage.setItem('rm-appearance', x), a);
        for (const pth of pages) {
          await m.goto(`${BASE}${pth}`);
          await m.locator('main, .world-page, .page-main').first().waitFor(); await m.waitForTimeout(600); // (the cloud version keeps a live connection open, so the network never goes idle)
          await m.waitForTimeout(300);
          const found: string[] = await m.evaluate((await import('node:fs')).readFileSync('scripts/a11y-audit.js', 'utf8'));
          for (const f of found) problems.push(`[${a}] ${pth}: ${f}`);
        }
      }
      await m.evaluate(() => localStorage.removeItem('rm-appearance'));
      if (problems.length) console.log('A11Y\n' + [...new Set(problems)].slice(0, 120).join('\n'));
      assert.equal(problems.length, 0, `${problems.length} accessibility problems`);
      step(`every control is named and text meets contrast on all ${pages.length} pages in all four appearances`);
      await m.goto(`${BASE}/dollhouse/letters`); await shot(m, 'phone-letters');
      await m.goto(`${BASE}/paths`); await shot(m, 'phone-paths');
      await phone.close();
      assert.deepEqual(wide, [], `no sideways scrolling on a phone: ${wide.join(', ')}`);
      step(`all ${pages.length} new pages fit a phone screen without sideways scrolling`);
      for (const a of ['midnight', 'pixie', 'quiet']) {
        await o.goto(`${BASE}/dollhouse`);
        await o.evaluate((x) => localStorage.setItem('rm-appearance', x), a);
        for (const pth of ['/dollhouse/newspaper', '/dollhouse/charms', '/dollhouse/letters']) {
          await o.goto(`${BASE}${pth}`);
          await o.waitForTimeout(500);
          assert.equal(await o.evaluate(() => document.documentElement.dataset.appearance), a);
          await shot(o, `appearance-${a}-${pth.split('/').pop()}`);
        }
      }
      await o.goto(`${BASE}/dollhouse`);
      const quietNav = await o.locator('.ribbon-nav').innerText();
      assert.ok(!/charms/i.test(quietNav), 'Quiet tucks gamification out of the menus');
      await o.evaluate(() => localStorage.removeItem('rm-appearance'));
      step('new pages wear Midnight, Pixie and Quiet; Quiet hides gamification from the menus');
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
