# Migration audit: free hosting on Cloudflare Pages + Firebase (Spark)

*Status: **implemented** on branch `claude/cloudflare-firebase-migration` and tested. The original home-server version is unchanged and still passes all its tests. The setup steps are in [CLOUD_SETUP_GUIDE.md](CLOUD_SETUP_GUIDE.md).*

**Changes from the proposal, found while building and testing:**
- **Room bundles repair themselves.** If you close the tab right after an edit, the bundle is written as the page closes, and it's re-checked the next time you open the site.
- **A warning when leaving mid-save.** You're asked before leaving the page while a change is still uploading.
- **Password changes, honestly worded.** On the cloud version, other devices are asked to sign in again within about an hour, which is how Firebase works. They are not signed out instantly.
- **The owner check is hardened.** The rules only accept a real-looking Firebase user ID, so the placeholder text can never act as the owner.

## 1. Why GitHub Pages shows a blank screen

I reproduced it locally by serving the repository exactly as GitHub Pages does, under `https://kazheakram.github.io/Mydigitalworld/`. There are **four separate causes**. The backend is only the last one.

| # | Cause | What the browser does | Evidence |
|---|---|---|---|
| 1 | **The site is never built.** GitHub Pages serves the raw repository, so `index.html` points at `src/main.tsx`, which is TypeScript/JSX source a browser can't run. | Requests `/src/main.tsx` and gets a 404. The page stays empty. | `HTTP 404 …/src/main.tsx`, body text `""` |
| 2 | **Absolute paths at the wrong address.** Even a built copy uses `/assets/…`, `/icon.svg` and `/manifest.webmanifest`. On a project site these resolve to `kazheakram.github.io/assets/…` instead of `…/Mydigitalworld/assets/…`. | The JS and CSS 404, so the page is still blank. | `HTTP 404 …/assets/index-*.js`, `…/assets/index-*.css`, `…/icon.svg` |
| 3 | **Routing.** The app's router expects to live at `/`. At `/Mydigitalworld/` every page would show "You've wandered off the map". Refreshing a deep link (e.g. `/room/library`) 404s on GitHub Pages because it has no single-page-app fallback. | Wrong page, or a 404 on refresh. | Inferred from the router setup; follows from #2 once fixed |
| 4 | **No backend.** Every `/api/…` call 404s, because GitHub Pages can only serve files. | Since the last update, the "village server is asleep" screen appears. | — |

There were no build errors: `npm run build` succeeds, and there are no environment variables involved yet.

**Cloudflare Pages fixes #1–#3 by design.** It runs the build, serves the site at the root of its own address (`your-name.pages.dev`), and falls back to `index.html` for app routes. #4 is what the migration below solves.

## 2. Component-by-component audit

**Legend:** ✅ moves over with no loss · 🔁 needs a serverless replacement (works, but differently) · ⚠️ works with a real free-tier limit

### The website itself (React app, all design, art, animations)

✅ **Everything moves unchanged.** The plan is *not* to rewrite the UI. I will add a "backend adapter" to `src/lib/api.ts`. Every screen keeps calling the same functions it calls today, and the adapter answers them from Firebase and Cloudflare instead of the Node server. Your village, rooms, modes, Atelier, themes, animations and art stay exactly the same code.

The existing Node server stays in the repo as an alternative, so nothing is deleted.

### Server features → their new homes

| Today (Node server) | New home | Verdict | Notes |
|---|---|---|---|
| Owner password + sessions | **Firebase Authentication** (email + password) | ✅ | Free on Spark. The owner is identified by your Firebase user ID, which is written into the security rules. Anyone else who signs up gets no powers. |
| Books, pages, notes, bookmarks, letterbox, expeditions, to-dos… (`items`) | **Firestore** collection `items` | ✅ | Real cross-device sync, plus offline caching on your phone. |
| Private / public / unlisted enforced by the server | **Firestore Security Rules** | ✅ | Visitors can only *list* public items and only *open* public or unlisted ones. Bookmarks, letterbox, expeditions and to-dos are forced private. This is enforced by Google's servers, not by hiding things in the page. |
| Hiding a public book's *private notes* field | Separate owner-only document `items_private/{id}` | 🔁 | Firestore can't hide one field of a readable document, so private fields move to a companion document. Same behaviour for you. |
| Items inside a *private room* stay hidden | Each item stores whether its room is public; rules check it | 🔁 | When you make a room private, the app updates that room's items. |
| Village/theme **draft → publish**, checkpoints | Firestore docs `config/*` + `versions` subcollection | ✅ | Publishing writes the visitor-safe copy (private rooms, owner-only objects and unrevealed regions already removed) to a public document. Drafts are owner-only. |
| Guestbook with moderation | Visitors post through **anonymous Firebase sign-in** into a pending area; rules limit length, fields, and one letter per visitor per few minutes | ⚠️ | Moderation and the honeypot stay. **Limitation:** there's no per-IP rate limit any more. A determined spammer could clear their browser and post again. Letters still wait for your approval, so nothing appears publicly. Optional hardening is Firebase App Check with reCAPTCHA v3, which is free with no card; I'll document it. |
| Universal search | In the browser. Visitors search a single "public index" document you publish; you search everything | ✅ | Private results still only ever appear for you. |
| RSS/Atom reader (fetch, discover, YouTube feeds, OPML) | **Cloudflare Pages Function** `/api/fetch` fetches the feed; your browser parses it; subscriptions and read/saved state live in Firestore | 🔁⚠️ | The Function only lets *you* use it (it checks your Firebase sign-in), so it can't be abused as an open proxy. **Limits:** Cloudflare's free plan allows 100,000 Function requests/day and 10 ms of CPU per request. That's why parsing moves to your browser; waiting on the network doesn't count against the CPU limit. A few sites block Cloudflare's servers or use bot walls, and those feeds will show "couldn't be reached". |
| Link previews (title, image) | Same Pages Function | ✅ | |
| **Image uploads** | **Cloudflare Workers KV**, served back through a Pages Function with edge caching | ⚠️ | KV free plan: **1 GB total, 1,000 uploads per day, 100,000 reads per day**, no card needed. To stretch that, images are resized and converted to WebP in your browser before upload. |
| Backups / restore / merge | In the browser: download everything (Firestore + uploads) as the same `ribbonmere-backup` JSON format | ✅ | Restore writes in batches. **Limit:** Firestore allows 20,000 writes per day on Spark, so a very large restore may need to finish the next day. The app will say so and resume. |
| OPML / bookmark HTML import-export | In the browser | ✅ | |
| PWA, share target, bookmarklet | Static files on Cloudflare Pages | ✅ | |
| Security headers / CSP | Cloudflare `_headers` file | ✅ | Updated to allow Firebase's domains. |

### Why not the other "free" storage options

- **Firebase Cloud Storage** now requires the paid **Blaze** plan. Projects on Spark lose access to Cloud Storage buckets, and new default buckets need Blaze. That breaks your "never activate a paid plan" rule.
- **Cloudflare R2** has a generous free tier (10 GB), but Cloudflare asks for a payment method before you can create a bucket. That breaks your "never enter payment details" rule.
- **Storing images inside Firestore** is possible (base64, max 1 MiB per document), but it eats the same 1 GiB and the daily read budget your books and journal need. KV keeps them separate.

## 3. Free-tier budget (what "free forever" really allows)

| Service | Free allowance | What uses it | Comfortable for… |
|---|---|---|---|
| Firestore reads | 50,000/day | Visitors opening rooms, you browsing | Rooms are bundled so a visitor opening a room costs **1 read**, not 1 per book. Thousands of visits a day. |
| Firestore writes | 20,000/day | Your edits, feed refreshes, letters | Far beyond personal use |
| Firestore storage | 1 GiB | All text content | Hundreds of thousands of entries |
| Workers/Pages Functions | 100,000 requests/day, 10 ms CPU each | Feed fetches, previews, image views | Fine; images are cached at the edge |
| Workers KV | 1 GB, 1,000 writes/day, 100k reads/day | Images | Roughly 3,000–8,000 compressed photos |

What happens if a limit is hit: on Spark, Google **stops that product** until the quota resets. It does **not** charge you, and it can't, because no card is attached. Cloudflare returns errors until the daily reset (00:00 UTC). The app will show a gentle "resting until tomorrow" message rather than breaking.

## 4. Keeping your data safe: migration & backup plan

1. **Nothing destructive.** The Node/SQLite version stays in the repo and keeps working. The Firebase version is a second "backend adapter" chosen at build time.
2. **One backup format.** Both versions read and write the same `ribbonmere-backup` JSON. To move a world from the Node version, use *Atelier → Backups → Download backup (including images)* there, then *Restore* in the new site. Images are re-uploaded to KV automatically.
3. **Checkpoints** keep working (last 40 versions of village and theme).
4. **Recommended habit:** download a backup monthly. The guide will include a reminder widget for the Dollhouse dashboard.
5. Firestore also has its own export tool, but it needs Blaze, so the in-app backup is the free path.

## 5. How it will be tested before I hand it over

- **Security rules:** automated tests with the official Firebase emulator, which runs locally. They prove that visitors can't read private items, drafts, bookmarks or the letterbox, can't read a public book's private notes, can't write anything except a pending guestbook letter, and that the owner can do everything.
- **Pages Functions:** tests with Cloudflare's local runtime (`wrangler`). They cover auth checks, refusing non-owners, feed and preview fetching against local test feeds, and upload validation (real images only, unsafe SVGs refused).
- **The app:** the same 17-step browser walkthrough as today, run against the emulators.
- **Not testable from here:** your real Firebase project and real Cloudflare account. That needs you to do the click-through setup once, which I'll write step by step.

## 6. What you'll need to click through (about 20 minutes, no card)

1. Create a free Firebase project (Spark), enable Email/Password sign-in and Anonymous sign-in, and create a Firestore database.
2. Copy six config values from Firebase into Cloudflare. These are public by design.
3. Paste the security rules into Firebase. One click, or the guide shows the console copy-paste.
4. Create a free Cloudflare account and connect it to your GitHub repo in Pages. Set the build command and environment variables.
5. Create one KV namespace (for images) and attach it to the Pages project.
6. Sign up on your new site once, copy your user ID into one setting, and redeploy. You're the owner.

Every step will have exact button names in a beginner guide.
