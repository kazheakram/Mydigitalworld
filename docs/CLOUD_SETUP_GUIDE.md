# Putting Ribbonmere online for free ♡
### Cloudflare Pages + Firebase, step by step

This guide puts your Ribbonmere on the internet at an address like `ribbonmere.pages.dev`. It costs nothing, and **no step asks for a credit card**. If any screen asks you for payment details, stop — you've clicked into a paid product by mistake. Go back and look for the option described here.

It takes about **30 minutes** the first time. You'll use three websites:

| Website | What it's for |
|---|---|
| **GitHub** (github.com) | Where your Ribbonmere code lives. You already have this. |
| **Firebase** (console.firebase.google.com) | Your private sign-in, and the database for your books, journal and everything else |
| **Cloudflare** (dash.cloudflare.com) | Shows the website to the world, runs the little helpers (feeds, images), and stores your images |

> 💡 **Tip:** keep a notes app open. A few times you'll copy something from one website and paste it into another.

---

## Step 0 — Turn off GitHub Pages (it's why you saw a blank page)

GitHub Pages can't run Ribbonmere, so let's switch it off to avoid confusion.

1. Open your repository on GitHub: **github.com/kazheakram/Mydigitalworld**.
2. Click **Settings** (the ⚙️ tab along the top of the repository).
3. In the left menu, click **Pages**.
4. Under **Build and deployment → Source**, choose **None** (or press **Unpublish site** if you see it).

---

## Step 1 — Create your Firebase project (free "Spark" plan)

1. Go to **console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project** (it may say **Get started with a Firebase project**).
3. Name it something like `ribbonmere`. Click **Continue**.
4. If it asks about **Gemini** or **Google Analytics**, you can switch them **off**. Ribbonmere doesn't need them. Click **Continue / Create project**.
5. Wait a few seconds, then click **Continue**.

Your project starts on the free **Spark** plan. Don't click **Upgrade**, ever. Ribbonmere is built to stay inside Spark.

## Step 2 — Register the website with Firebase and copy its settings

1. On your project's home page, find **"Get started by adding Firebase to your app"** and click the **`</>`** (Web) icon.
   (If you don't see it: click the ⚙️ gear next to **Project Overview** → **Project settings** → scroll to **Your apps** → **`</>`**.)
2. **App nickname:** `Ribbonmere`. Leave **"Also set up Firebase Hosting"** unticked.
3. Click **Register app**.
4. You'll see a box of code that contains `const firebaseConfig = { apiKey: "…", authDomain: "…", … };`.
   **Copy everything from `{` to `}`** and paste it into your notes as **"Firebase config"**.
   These values are *not* secret. They identify your project, and the security rules (step 9) do the protecting.
5. Click **Continue to console**.

## Step 3 — Switch on sign-in

1. In the left menu, open **Build → Authentication** (or **Security → Authentication**), then click **Get started**.
2. On the **Sign-in method** tab, click **Email/Password** → turn on the **first** switch (Email/Password) → **Save**.
3. Click **Add new provider** → **Anonymous** → turn it on → **Save**.
   (Anonymous sign-in lets visitors write in your guestbook without making an account.)

## Step 4 — Create the database

1. In the left menu, open **Build → Firestore Database** and click **Create database**.
2. If it asks for an **edition**, choose **Standard edition**. The free Spark plan covers Standard.
3. If it asks for a **Database ID**, leave it as **`(default)`**.
4. **Location:** pick the one closest to you, e.g. `eur3 (Europe)` or `nam5 (United States)`. ⚠️ This can't be changed later, but any choice works.
5. When asked about security rules, choose **Start in production mode** (everything locked). You'll paste Ribbonmere's real rules in step 9.
6. Click **Create**.

Firebase is ready. Leave this tab open; you'll come back in step 9.

---

## Step 5 — Create a free Cloudflare account and connect your repository

1. Go to **dash.cloudflare.com** and **Sign up** (free). Confirm your email address.
2. In the left menu, open **Workers & Pages** (it may be under **Compute**).
3. Click **Create application** (or **Create**).
4. Choose the **Pages** tab, then **Import an existing Git repository** (or **Connect to Git**).
   - If you only see options for "Workers", look for a link like **"Looking to deploy Pages? Get started"**. It's important to make a **Pages** project, because that's what runs the `functions` folder.
5. Click **Connect GitHub**, allow Cloudflare access, and pick **kazheakram/Mydigitalworld**. Click **Begin setup**.
6. Fill in the setup page:

   | Setting | What to choose |
   |---|---|
   | Project name | `ribbonmere`, which becomes `ribbonmere.pages.dev` (if it's taken, add something like `ribbonmere-kira`) |
   | Production branch | `claude/cloudflare-firebase-migration`, or `main` once you've merged it |
   | Framework preset | **None** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

7. Open **Environment variables (advanced)** and add these three (click **+ Add variable** for each):

   | Variable name | Value |
   |---|---|
   | `VITE_FIREBASE_CONFIG` | paste your **Firebase config** from step 2 (the whole `{ … }` block) |
   | `NODE_VERSION` | `22` |
   | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `1` |

8. Click **Save and Deploy**. The first build takes 2–4 minutes. When it says **Success**, click the link (e.g. `https://ribbonmere.pages.dev`).

You'll see your village! It's still missing its private parts. Let's finish.

## Step 6 — Add image storage (Workers KV) and the private-image secret

**Create the image storage:**
1. In Cloudflare's left menu, open **Storage & Databases → KV** (on some accounts it's **Workers & Pages → KV**).
2. Click **Create** (or **Create a namespace**), name it `ribbonmere-media`, and click **Add / Create**.

**Attach it to your site:**
3. Go to **Workers & Pages** → your **ribbonmere** project → **Settings** → **Bindings**.
4. Click **Add** → **KV namespace**.
   - **Variable name:** `MEDIA` (exactly like that, in capitals)
   - **KV namespace:** `ribbonmere-media`
5. Click **Save**.

**Add the secret that protects your private images:**
6. Still in **Settings**, open **Variables and Secrets** → **Add**.
   - **Type:** **Secret**
   - **Variable name:** `MEDIA_SECRET`
   - **Value:** a long random string of at least 24 characters. Mash the keyboard, or copy the fresh one your site's setup page shows you (step 8).
7. Click **Save**.

## Step 7 — Redeploy so the changes take effect

Cloudflare only picks up new settings on the next deployment:

1. Go to your project → **Deployments**.
2. On the newest deployment, click **⋯** → **Retry deployment**. Wait for **Success**.

> You'll do this "Retry deployment" again in step 8. **Any** time you change a variable or binding, redeploy.

## Step 8 — Create your owner account and tell the site it's you

1. Open your site and go to **`/login`**, e.g. `https://ribbonmere.pages.dev/login`.
2. It says **Make this world yours**. Type your **email** and choose a **password** (8+ characters), then click **Create my account**.
3. You land on the **Cloud setup** checklist. Under **"The site knows you're the owner"** you'll see your **user ID**, a long mix of letters and numbers. Click **Copy my user ID**.
4. In Cloudflare: your project → **Settings** → **Variables and Secrets** → **Add**.
   - **Type:** Text (plain)
   - **Variable name:** `VITE_OWNER_UID`
   - **Value:** paste your user ID
   - Click **Save**.
5. **Retry deployment** again (step 7).

## Step 9 — Paste the security rules into Firebase

The rules are what keep your private things private. The checklist gives you a copy with your user ID already filled in.

1. Open your site's **`/setup`** page (sign in if asked). Under **"Firestore security rules contain your user ID"**, click **Copy the rules**.
2. In the Firebase console: **Firestore Database** → the **Rules** tab.
3. Select **all** the text in the editor (Ctrl+A, or ⌘+A on a Mac), delete it, and **paste**.
4. Click **Publish**.

## Step 10 — Check everything is green ✅

Reload **`/setup`** on your site. Every line should show ✅:

- Cloudflare functions are running
- Firebase is connected
- You have an owner account
- The site knows you're the owner
- Firestore security rules contain your user ID
- Image storage (Workers KV) is attached
- Private-image secret is set

If one shows 🎀, it tells you what's missing. Fix that one, then **Retry deployment** if it was a Cloudflare setting.

**You're live!** 🎀 Visit `/` to see your village as visitors will, and sign in at `/login` whenever you want to step into Dollhouse Mode.

---

## Bringing your existing world over (optional)

**If you used Ribbonmere on your own computer** (the original home-server version with SQLite):

- **Easiest:** start the old version (`npm run dev`), go to **Atelier → Backups → …including all images**, and save the file.
- **If the old version won't start:** in the project folder, run `npm run export:sqlite` (or `npx tsx scripts/export-sqlite.ts path/to/data`). It only *reads* your old data folder and writes a file called `ribbonmere-from-sqlite-<date>.json`.

Then on your new site: **Atelier → Backups → Restore from a backup** (or **Merge a backup in** to keep what's there too). Ribbonmere will:

1. ask you to **download a safety backup** of what's there now (you must do this before it continues),
2. ask you to confirm,
3. re-upload your images, fix their addresses everywhere, and restore your village, rooms, theme, books, pages, notes, bookmarks, letterbox, feeds and saved posts. Private notes stay private.

If the backup is very large, the restore may pause when Firebase's free daily allowance runs out. Just run the same restore with the same file the next day; it continues where it stopped.

---

## Using it every day

- **Phone:** open your site in Safari/Chrome → **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android). On Android, Ribbonmere then appears in the Share menu, so sharing a link from any app saves it to your Letterbox.
- **The ☁ badge** in the menu tells you where your changes are:
  - **☁ synced:** saved to the cloud, so every device has it.
  - **☁ saving…:** on its way.
  - **☁ offline:** you're offline. Changes are kept on this device and sync by themselves later.
  - **⚠ not synced:** something went wrong. Hover or tap for the reason.
- **Changes save automatically:** books, pages and notes save as you type (once they exist), and new ones keep an unsaved draft on your device until you press Save.
- **Two devices:** edit on your laptop and it appears on your phone a moment later, without reloading.
- **Images** you upload are **private** until you use them on something public (a public book cover, an artwork, the published village). Then they become visible to visitors automatically. **Atelier → Media** shows each image's status and lets you switch it.
- **Back up** now and then: **Atelier → Backups → …including all images**. The file is yours, and it works with both versions of Ribbonmere.

---

## The free limits (and what happens if you reach them)

| | Free allowance | In everyday terms |
|---|---|---|
| Firestore reads | 50,000 per day | Each visitor opening a room costs about 1–2. Thousands of visits a day are fine. |
| Firestore writes | 20,000 per day | Far more than a person can type. Only a giant restore gets close. |
| Firestore storage | 1 GiB | Hundreds of thousands of books and pages |
| Cloudflare Functions | 100,000 requests per day | Feed refreshes, link previews and image views (popular images are cached) |
| Image storage (KV) | 1 GB total, 1,000 uploads per day | Roughly 3,000–8,000 photos (they're shrunk before upload) |

If a limit is reached, that part **pauses until the daily reset** (Firebase: midnight Pacific time; Cloudflare: midnight UTC). **You are never charged**, because there's no card on file. Ribbonmere shows a clear message when this happens.

**Honest limitations of the free setup:**
- A few websites block Cloudflare's servers or require a browser check, so their feeds or link previews may show *"couldn't be reached"*. You can still save them as bookmarks.
- When you switch an image from public to private, copies already cached around the world can take **up to 5 minutes** to disappear.
- Right after you upload an image, it can take up to a minute to appear in *other* parts of the world. Workers KV spreads out gradually.
- The guestbook limits each visitor to one letter every 5 minutes, and every letter waits for your approval. A determined spammer could still fill your *review queue* (never your public page). For extra protection you can turn on Firebase **App Check** with **reCAPTCHA v3** (free, no card).

---

## Troubleshooting

| What you see | What to do |
|---|---|
| Blank page on `github.io` | That's GitHub Pages. Use your `pages.dev` address instead, and turn GitHub Pages off (step 0). |
| "The village can't reach the cloud" | Open `/setup` and follow the first 🎀 item. Usually `VITE_FIREBASE_CONFIG` is missing or the deployment wasn't retried. |
| "That account is not the owner of this world" | You signed in with a different email than the one whose ID is in `VITE_OWNER_UID`. |
| "The cloud refused this change" | The security rules don't have your user ID yet. Redo step 9 and make sure you clicked **Publish** in Firebase. |
| Images don't show for you | Check `MEDIA` (step 6) and `MEDIA_SECRET`, then **Retry deployment**, then sign out and in again. |
| "The guestbook is not switched on yet" | Turn on **Anonymous** sign-in (step 3). |
| Forgot your password | On `/login`, type your email and click **Forgot your password?**. |
| Build failed on Cloudflare | Open the failed deployment and read the log. Check that the build command is `npm run build`, the output directory is `dist`, and `NODE_VERSION` is `22`. |

## Trying the cloud version on your own computer first (optional)

You can run the whole cloud setup on your computer without any accounts, using Google's and Cloudflare's local test tools:

```bash
npm install
npm run dev:cloud
```

Then open **http://localhost:8899** and sign in with `owner@example.com` / `ribbonmere-local`. Everything resets when you stop it (Ctrl+C). It needs Java installed for the Firebase emulator.
