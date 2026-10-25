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

**How it was tested:**

| Command | Result |
|---|---|
| `npm run test:v2` | 59 browser checks, all passing, no browser errors |
| `npm test` | 12 server tests |
| `npm run test:rules` | 8 rule groups, including the new kinds test and the shared-letter test |
| `npm run test:functions` | 6 |
| `npm run screenshots` | 17 original browser checks |
| `npm run test:cloud` | 29 cloud checks on the emulators, including 5 for 2.0 (see below) |

The `test:v2` run covers these lifecycles:
- **Letterbox:** hide → rest → on, data kept.
- **Stamps:** rest → on, as seen by visitors.
- **Appearance:** all four modes, Quiet keeps every place, Alt+Q.
- **Companions:** adopt → dress → follow → wander map → hide → rest → on, with data kept, then reset. The reset removes only pets and their map spots, and the letterbox is untouched.
- **Bedroom:** create → decorate → private to visitors → hide → rest → on, with decoration kept, then reset. The reset touches only the bedroom.
- **Newspaper / Parlour / Journal / Commonplace:** each one is used, hidden or rested and turned back on with data kept, then reset. The newspaper reset leaves subscriptions alone, the journal reset leaves books alone, the commonplace reset leaves books alone, and parlour videos survive resting both the Parlour and YouTube feeds. The Commonplace Book stays private to visitors.
- **Shops / Museum / Scrapbook / Letters:** each is created, used, rested and turned back on, then reset. Visitors see a public shop but never a private one, and the museum stays private. Each shop's reset spares the Library and the Gramophone Pavilion. PNG and SVG downloads are checked to be real image files. A shared letter opens only by its link and is never listed or shown in the guestbook, and stop sharing takes effect at once.
- **Capsules / Map / Paths:**
  - Sealed contents stay hidden; open early and reseal work; capsules are always private.
  - Dragged positions and threads are saved and survive a reload; search, zoom and filters work; the map reset leaves discoveries alone.
  - Unrevealed paths are never sent to visitors, revealed ones open for them, and hidden/resting work as described.
- **Games / Charms:**
  - A visitor plays all five games through to the end; the puzzle is solved by search, not by reading the app's state.
  - Achievements and pearls land in the visitor's own storage, and every room opens without playing.
  - The owner earns pearls and buys a charm; a gentle note appears when there aren't enough.
  - Achievements, pearls and games each rest and reset without touching the others.
- **World:** weather and light reach visitors after publish, interactions work, Quiet and resting turn them off without touching buildings, and resetting weather leaves the light setting alone.

Screenshots are in `docs/screenshots/v2/`.

**On the cloud version** (Firebase emulators with the real security rules, plus wrangler), `npm run test:cloud` now also checks Ribbonmere 2.0. It works through the real pages and then reads Firestore directly:
- Feature Manager choices are saved to the cloud draft.
- A companion is adopted and follows the owner. Its record is private, and visitors are refused.
- Capsules, commonplace entries and scrapbook pages are saved, and the private ones are refused to visitors.
- A letter stays private until it's shared by link. Once shared, it opens by its link. Stop sharing closes it again at once.
- Resetting Companions deletes only pet documents. Owner progress is stored privately.

## Still to do (Phase 7)

- **Cloud lifecycle coverage:** the cloud run checks the 2.0 features that store new kinds of data, plus a feature reset. The full hide → rest → on → reset lifecycle of *every* feature runs on the home-server version only. The screens are identical, so only the storage layer differs.
- **A phone and appearance pass over every new page:** the test is written (`npm run test:v2 -- polish`). It checks 14 new pages for sideways scrolling at phone width, takes screenshots in Midnight, Pixie and Quiet, and checks that Quiet tucks gamification out of the menus. It had **not been run yet** when this was written, because the sandbox briefly stopped allowing commands. If it hasn't been run, treat it as untested.

## Known limitations
- **One-off cloud sync timing failure:** in one of eight cloud runs this session, the cloud test's live-sync check (a book added on device A appearing on device B within 15 seconds on the local emulator) timed out once. It passed on the immediate rerun and in every other run. This is noted here rather than hidden; if it recurs, it is the first thing to look at in Phase 7.
- The sandbox can't fetch real feeds, so the Newspaper and Parlour were tested with feeds placed directly in the test database. Fetching itself is the reader's existing, already-tested code path. YouTube thumbnails and embeds load from YouTube, which the sandbox can't reach, so they couldn't be seen playing here. Only the embed address was checked.
- The follower companion is owner-only by design. Visitors only see companions you put on the map.
- The day & night light uses each visitor's own clock, so different visitors may see different times of day. Choose "Always daytime" in the Feature Manager if you prefer one look.
