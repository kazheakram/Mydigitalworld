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

**How it was tested:**

| Command | Result |
|---|---|
| `npm run test:v2` | 44 browser checks, all passing, no browser errors |
| `npm test` | 12 server tests |
| `npm run test:rules` | 8 rule groups, including the new kinds test and the shared-letter test |
| `npm run test:functions` | 6 |
| `npm run screenshots` | 17 original browser checks |
| `npm run test:cloud` | 24 cloud checks on the emulators |

The `test:v2` run covers these lifecycles:
- **Letterbox:** hide → rest → on, data kept.
- **Stamps:** rest → on, as seen by visitors.
- **Appearance:** all four modes, Quiet keeps every place, Alt+Q.
- **Companions:** adopt → dress → follow → wander map → hide → rest → on, with data kept, then reset. The reset removes only pets and their map spots, and the letterbox is untouched.
- **Bedroom:** create → decorate → private to visitors → hide → rest → on, with decoration kept, then reset. The reset touches only the bedroom.
- **Newspaper / Parlour / Journal / Commonplace:** each one is used, hidden or rested and turned back on with data kept, then reset. The newspaper reset leaves subscriptions alone, the journal reset leaves books alone, the commonplace reset leaves books alone, and parlour videos survive resting both the Parlour and YouTube feeds. The Commonplace Book stays private to visitors.
- **Shops / Museum / Scrapbook / Letters:** each is created, used, rested and turned back on, then reset. Visitors see a public shop but never a private one, and the museum stays private. Each shop's reset spares the Library and the Gramophone Pavilion. PNG and SVG downloads are checked to be real image files. A shared letter opens only by its link and is never listed or shown in the guestbook, and stop sharing takes effect at once.
- **World:** weather and light reach visitors after publish, interactions work, Quiet and resting turn them off without touching buildings, and resetting weather leaves the light setting alone.

Screenshots are in `docs/screenshots/v2/`.

## Not built yet (coming in later phases)

| Phase | Features |
|---|---|
| 5 | Time Capsules, the Rabbit Hole discovery map, seven new landscape regions with the Paths page |
| 6 | Charms page (achievements, pearls, keepsake charms), five minigames |
| 7 | Final appearance polish, and full lifecycle tests for every feature on the cloud backend |

These features already appear in the Feature Manager with a **coming soon** label, so you can set them up ahead of time. Their menu links and Dollhouse cards stay hidden until they're built, so nothing in the site leads to a missing page.

## Known limitations
- The sandbox can't fetch real feeds, so the Newspaper and Parlour were tested with feeds placed directly in the test database. Fetching itself is the reader's existing, already-tested code path. YouTube thumbnails and embeds load from YouTube, which the sandbox can't reach, so they couldn't be seen playing here. Only the embed address was checked.
- The follower companion is owner-only by design. Visitors only see companions you put on the map.
- The day & night light uses each visitor's own clock, so different visitors may see different times of day. Choose "Always daytime" in the Feature Manager if you prefer one look.
