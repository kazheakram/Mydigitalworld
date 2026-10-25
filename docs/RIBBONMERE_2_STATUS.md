# Ribbonmere 2.0: build status

This is an honest record of what's built, what's been tested, and what's still to come. It's updated at the end of every work session.

Work happens on branch `claude/ribbonmere-2`. Your live site keeps running from `claude/cloudflare-firebase-migration` until you choose to switch.

## Done and tested

### Phase 1: foundations
- **Feature Manager** (*Atelier → Features*): every optional feature can be On, Hidden or Resting, or Reset after typing `RESET`. A reset clears only that feature's own data. There is also a "Restore every feature" button.
- **Appearance modes:** Coquette, Quiet, Pixie and Midnight. Each device remembers its own choice, the owner chooses the default visitors see, and Alt + Q toggles Quiet.
- **Progress engine** for the optional achievements and pearls. It never decays.

### Phase 2: living world
- **Companions:**
  - Adopt a bunny, fawn, kitten or swan, and name them.
  - Accessories: fur, collar, bow, pearls, crown, bonnet. Each companion has a home and can be patted for hearts.
  - One follower that drifts after your cursor.
  - Optional wandering on the public map; the pet records themselves stay private.
  - Tuck away, or rehome with confirmation.
- **My Bedroom:**
  - A private room with wallpapers, floors, wall colour and default furniture.
  - Arranged in the existing room editor.
- **Framed photos** in any freeform room: gilded, lace, polaroid or oval.
- **New artwork:** four companions with idle animations, four pet homes, and twelve furniture and trinket pieces. All appear in the editor's artwork library.
- **Atmosphere:**
  - Weather, either season-following or chosen: clear, sunshine, rain, snow, mist, petals.
  - Day & night light that follows the clock, with lamp and window glow at dusk and night.
  - Little interactions: fountain splash, falling petals, lamp switches, creature hops.
- **Security:**
  - The Firestore rules accept every 2.0 kind, and the always-private kinds (capsules, editions, challenges, progress) can't be made public. A test keeps the rules in step with the code.
  - Restoring a backup keeps always-private kinds private on both backends.

### Phase 3: personal internet
- **Morning Paper:**
  - Daily editions printed from your RSS posts: lead story, category sections, at most two per feed, videos excluded.
  - Read/unread is remembered in the edition and in the reader; posts can be saved.
  - Settings: name, number of stories, sections, include read posts.
  - Reprint and archive.
- **Video Parlour:**
  - YouTube channel videos from your feeds, played in the privacy-enhanced embed.
  - Watch later, favourites, playlists, notes, watched, search and paste-a-link.
  - Saved videos are Cabinet bookmarks, collection "Video Parlour".
- **Reading Journal:**
  - Built from library books: year statistics, monthly chart, authors, genres, formats, favourite and longest book.
  - Monthly wrap-ups, history, series, reviews and margin notes.
  - Optional, pressure-free challenges.
  - New book fields: started on, genre, series, number in series, format, margin notes.
- **Commonplace Book:**
  - A new room template, private by default.
  - Entries hold words, kind, source, author, page, link, reflection, tags, favourite and a link to your own book, page or note.
  - Search, filters and Markdown export.

### Phase 4: creative spaces
- **New room templates, each with its own map building:**
  - **Picture House:** films, painted or uploaded posters, watchlist, favourites, collections, marquee, reviews.
  - **Record Shop:** crates, sleeves, formats, reviews, players for YouTube, Spotify and SoundCloud.
  - **Bookshop:** themed displays, recommendation cards, wishlist, pressed-flower secrets, no payments.
  - **Memory Museum:** exhibition halls, timeline, private by default.
- **Scrapbook Studio:**
  - Multi-page books arranged with the Atelier editor, with five papers and autosave.
  - PNG and SVG export with fonts and images embedded.
- **Writing Desk:**
  - Six stationeries, four letterings, stamps, ribbon, wax seal and mark.
  - Autosaving private drafts.
  - Optional share-by-link (unlisted), with an envelope that opens for the reader, and stop sharing at any time.
  - PNG download of the letter and envelope.
- **Photo frames** in rooms and scrapbooks (see Phase 2).
- **Image exporter:** theme colours are resolved; HTML text is redrawn as SVG text so browsers allow PNGs.

### Phase 5: discovery & regions
- **Time Capsules:**
  - A letter, photos and links, with an open date. Contents stay hidden while sealed.
  - You can open early, reseal or unseal to change. Capsules are always private.
- **Rabbit-hole Map:** expeditions as stars with their discoveries, drag to arrange, threads across expeditions, pan/zoom, search, topic filters; saved on each expedition.
- **Paths beyond the village:**
  - Seven illustrated landscapes as region rooms, opened privately, revealed when you choose, arranged in the room editor.
  - A visitor-facing postcards page with a cloudy teaser that leaks nothing.
  - The *Every Path* achievement.

### Phase 6: gentle gamification
- **Charms page:** every achievement (earned or how to find it), your pearl purse, the Charm Shop (each charm says where it is free anyway), the charm bracelet, kept bouquets.
- **Games Parlour room template:** memory cards, hidden objects, post sorting, the flower table (keepsake bouquets) and a sliding picture puzzle. All untimed, and none of them gate anything.
- The Discoverer achievement is now awarded when you pocket a discovery (it was defined but never given).
- Visitors' progress stays on their device; the owner's is a private item.

### Phase 7: polish, cloud verification, safety
- **Accessibility audit:** an automated check runs on 22 pages (14 Dollhouse and Stargirl pages, every new room template with content, a path and a shared letter) in all four appearances. It confirms that every button, link and field has a name and that text meets the WCAG AA contrast standard. It also checks every page at phone width for sideways scrolling.
- **Problems it found and fixed:**
  - Midnight, Pixie and Quiet never reached room pages or Stargirl Mode. Those pages rebuilt their colours and fonts from the raw theme, so in Midnight some text nearly vanished. In Midnight, a room's own custom colours now step aside and come back when you switch out of it.
  - Midnight contrast: paper cards, postcards, the active Atelier tab, Stargirl's title and buttons, and the "undiscovered" clouds.
  - Painted posters, record sleeves and book covers: their words now sit on cream labels, readable on any paint colour. Crate labels are darker.
  - The top navigation labels, plus Stargirl's soft text and deep rose (`#6b6f8c` → `#5c607e`, `#8d5568` → `#865064`), are a little darker to reach 4.5 : 1.
- **Cloud bug fixed (Rabbit-hole Map):** threads were saved as lists inside a list, which Firestore refuses. On the cloud version, every thread failed to save, and the badge showed "⚠ not synced". Threads are now stored as `{from, to}`, and old pairs are still read. Both versions now refuse lists inside lists with a clear message, so data stays portable between them. Restoring an older backup into the cloud converts such data instead of failing.
- **Proof that optional features never delete unrelated data:** the *isolation* test seeds something of every kind (books, pages, notes, bookmarks, letterbox, expeditions, shop items and more).
  - It rests and wakes all 32 features and checks that nothing at all changes.
  - It then resets each of the 19 resettable features in turn and checks that only what that feature's own description promises disappears. All rooms, the map, the theme and every other item stay byte-for-byte the same.
  - This runs on both the home-server and the cloud version.

## How it was tested

All cloud testing uses the official **Firebase emulators** with the real security rules, under the emulator-only project id `demo-ribbonmere`. A `demo-` project cannot reach a real Firebase database, so **your production Firebase was never used**. Cloudflare Pages Functions and KV run in **wrangler**, Cloudflare's local runtime. The test hook the cloud tests use (`window.__rmApi`) exists only in builds made with `VITE_USE_EMULATORS=1`. Real Cloudflare builds never set that, so the hook is never present.

| Command | What it covers | Result (final code) |
|---|---|---|
| `npm run typecheck` / `npm run build` | TypeScript for client and server; production build | ✅ clean |
| `npm test` | 12 home-server API tests (auth, privacy, feeds, uploads, guestbook, backups) + 2 nested-list tests | ✅ 14 / 14 |
| `npm run test:rules` | Firestore security rules on the emulator: outsiders, other accounts, guests, owner, new kinds, shared letters | ✅ 8 / 8 groups |
| `npm run test:functions` | Pages Functions in wrangler + real RS256 token checks | ✅ 6 / 6 |
| `npm run screenshots` | the original 17 end-to-end browser checks (home server) | ✅ 17 / 17 |
| `npm run test:v2` | **every 2.0 feature's full lifecycle**, isolation, accessibility and phone checks (home server) | ✅ 63 / 63, no browser errors |
| `npm run test:cloud` | cloud end-to-end: sign-in, live sync between two devices, offline edits, private images, RSS through the function, guestbook moderation and rate limit, search, backups and safety-backup restore, SQLite migration, checkpoints, password change, phone layout, reduced motion, plus 5 checks of 2.0 data privacy | ✅ 29 / 29 |
| `npm run test:v2:cloud` | **the same 2.0 lifecycle, isolation, accessibility and phone sections, unchanged, against the cloud version** | ✅ 63 / 63 in one clean run, no browser errors |

**`test:v2` and `test:v2:cloud` drive each feature through the same steps:** use → configure (where it has settings) → hide → open by its address → rest → show its resting page and disappear for visitors → wake → data intact → reset → only its own data gone. Covered:
- the Letterbox and stamps;
- all four appearances;
- Companions and the Bedroom;
- the Morning Paper, Video Parlour, Reading Journal and Commonplace Book;
- the Picture House, Record Shop, Bookshop and Memory Museum;
- the Scrapbook and Writing Desk;
- Time Capsules, the Rabbit-hole Map and Paths;
- the Games Parlour and Charms;
- weather, light and interactions.

The full home run (`test:v2`) finished just before two final colour fixes (the Paths clouds, and Stargirl's buttons in Midnight). The sections those fixes touch, *polish* and *paths*, were re-run on the home version afterwards and pass. The cloud run above is of the final code.

Screenshots are in `docs/screenshots/v2/` (home) and `docs/screenshots/v2-cloud/` (cloud).

## Known limitations

- **Leaving the page in the same instant as a change (cloud version):**
  - **What happens:** a change is queued and written to the browser's own storage a few milliseconds after it's made. A page reload or close in exactly that instant can lose that one change. The tests reproduced this once, with a script that saved and reloaded with no pause in between.
  - **Normal use is safe:** clicking, typing and even a fraction of a second's pause before reloading all kept every change in the tests.
  - **The protection already in place:** the "☁" badge shows *saving…* until the cloud has the change, and the site asks before you leave while anything is still saving. Browsers only show that question after you've clicked on the page.
  - **What to do:** if you see *saving…*, give it a moment before closing the tab.
- **A one-off live-sync timeout:** once, earlier this session, the cloud test of a book added on one device appearing on a second device within 15 seconds timed out. It passed on the immediate rerun and in every run since (all of the Phase 7 runs). It looks like emulator load, but it's recorded here rather than hidden.
- **Real feeds and YouTube:** the sandbox can't reach the internet. The Newspaper and Parlour were tested with feeds placed directly in the test database, and the reader's fetching was tested against local fixtures. YouTube embeds were checked by address only. Check a few of your real subscriptions after deploying.
- **Real Firebase and Cloudflare accounts:** these can't be tested from here. The emulators run the same rules and functions code, but your own project's settings (the owner ID in the rules, KV binding and environment variables) are checked by the setup checklist at `/setup` once deployed.
- **By design:** the follower companion is owner-only, and the day & night light follows each visitor's clock.

## Commands to run elsewhere

These need Node 22.13+, Chromium (or `npx playwright install chromium`, then set `CHROMIUM_PATH`), and Java for the Firebase emulators. Each runs locally and never touches a real Firebase project.

```bash
npm ci
npm run typecheck && npm run build
npm test                      # API and logic tests
npm run test:rules            # Firestore rules (emulator)
npm run test:functions        # Pages Functions (wrangler)
npm run screenshots           # original browser checks
npm run test:v2               # 2.0 lifecycles, isolation, accessibility, phone (home server)
npm run test:cloud            # cloud end-to-end (emulators + wrangler)
npm run test:v2:cloud         # 2.0 lifecycles etc. on the cloud version
```
