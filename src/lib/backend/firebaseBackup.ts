import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { ITEM_KINDS } from '../../../shared/types';
import { splitPrivate, VISIBILITIES } from '../../../shared/logic';
import { firebase } from './firebase';
import { internals } from './firebaseApi';
import { track } from './sync';
import type { Backup } from '../backup';

// Export and restore for the Firebase version, in the same format as the Node version's backups.

const now = () => new Date().toISOString();
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const PROGRESS_KEY = 'rm-restore-progress';

export async function exportFirebase(withMedia: boolean): Promise<Backup> {
  const x = internals;
  await x.owner();
  const cfg = (k: 'world' | 'theme') => ({ draft: x.cfgJson(`${k}_draft`), published: x.cfgJson(`${k}_published`), updatedAt: x.configDocs.get(`${k}_draft`)?.updatedAt });
  const items = x.ownerItems().map((i) => (i.id.startsWith('pending:') ? { ...i, id: i.id.slice(8) } : i));
  const feeds = [...x.feeds.entries()].map(([id, f]) => ({ id, url: f.url, title: f.title, siteUrl: f.siteUrl, category: f.category }));
  const savedEntries = [...x.feeds.entries()].flatMap(([fid, f]) => (f.entries ?? []).filter((e) => e.saved)
    .map((e) => ({ id: e.id, feed_id: fid, guid: e.guid, title: e.title, link: e.link, published: e.published, summary: e.summary, image: e.image, read: e.read ? 1 : 0, saved: 1 })));
  const backup: Backup = { format: 'ribbonmere-backup', version: 1, exportedAt: now(), config: { world: cfg('world'), theme: cfg('theme') }, items, feeds, savedEntries };
  if (withMedia) {
    backup.media = [];
    for (const [id, m] of x.media) {
      const res = await fetch(m.url, { credentials: 'same-origin' });
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      backup.media.push({ file: `${id}.${m.ext ?? 'png'}`, base64: btoa(bin) });
    }
  }
  return backup;
}

interface Progress { key: string; urlMap: [string, string][]; mediaDone: boolean; configDone: boolean; cleared: boolean; itemsDone: number; feedsDone: boolean }

export async function importFirebase(b: Backup, mode: 'replace' | 'merge', say: (m: string) => void) {
  const x = internals;
  await x.owner();
  const { db } = firebase();
  const notes: string[] = [];
  const key = `${b.exportedAt}|${b.items?.length}|${mode}`;
  let p: Progress = { key, urlMap: [], mediaDone: false, configDone: false, cleared: false, itemsDone: 0, feedsDone: false };
  try { const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null'); if (saved?.key === key) { p = saved; say('Continuing a restore that stopped part-way…'); } } catch { /* ignore */ }
  const save = () => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

  const items = (b.items ?? []).filter((i) => ITEM_KINDS.includes(i.kind) && VISIBILITIES.includes(i.visibility));
  const estimate = items.filter((i) => i.kind !== 'media').length * 2 + (b.feeds?.length ?? 0) + 20;
  if (estimate > 18_000) notes.push(`This backup needs about ${estimate.toLocaleString()} cloud writes; Firebase allows 20,000 a day for free. If it stops, run the same restore again tomorrow and it will continue where it left off.`);

  try {
    // 1. Images: upload them again and remember their new addresses.
    if (!p.mediaDone) {
      const meta = new Map(items.filter((i) => i.kind === 'media').map((i) => [String(i.data?.file ?? '').split('.')[0], i]));
      const done = new Set(p.urlMap.map(([from]) => from));
      const list = b.media ?? [];
      for (let n = 0; n < list.length; n++) {
        const m = list[n];
        const base = m.file.split('.')[0];
        if (done.has(`/uploads/${m.file}`)) continue;
        say(`Uploading images… ${n + 1} of ${list.length}`);
        const info = meta.get(base);
        const bytes = Uint8Array.from(atob(m.base64), (c) => c.charCodeAt(0));
        const it = await x.uploadMedia(new Blob([bytes]), new Headers({
          'x-filename': encodeURIComponent(info?.data?.name ?? m.file), 'x-category': info?.data?.category ?? 'Uploads',
          'x-decoration': info?.data?.decoration ? '1' : '0', 'x-visibility': info?.visibility === 'public' ? 'public' : 'private',
        }));
        p.urlMap.push([`/uploads/${m.file}`, it.data.url], [`/media/${base}`, it.data.url]);
        save();
      }
      const missing = items.filter((i) => i.kind === 'media' && !list.some((m) => m.file.split('.')[0] === String(i.data?.file ?? '').split('.')[0])).length;
      if (missing) notes.push(`${missing} image${missing > 1 ? 's were' : ' was'} listed but not included in the backup file. Make the backup “including all images” to bring them along.`);
      p.mediaDone = true; save();
    }
    const rewrite = <T,>(v: T): T => {
      let s = JSON.stringify(v);
      for (const [from, to] of p.urlMap) s = s.split(from).join(to);
      return JSON.parse(s);
    };

    // 2. Village & theme.
    if (!p.configDone) {
      say('Restoring your village and theme…');
      const batch = writeBatch(db);
      for (const k of ['world', 'theme'] as const) {
        const c = b.config?.[k];
        if (!c?.draft || !c?.published) continue;
        // Keep what's here now as a checkpoint, as well as the downloaded safety backup.
        const current = x.cfgJson(`${k}_draft`);
        if (current) batch.set(doc(collection(db, 'versions')), { key: k, json: JSON.stringify(current), label: 'Before restoring a backup', createdAt: now() });
        const draft = rewrite(c.draft); const published = rewrite(c.published);
        x.lastWritten[k] = JSON.stringify(draft);
        batch.set(doc(db, `config/${k}_draft`), { json: JSON.stringify(draft), updatedAt: now() });
        batch.set(doc(db, `config/${k}_published`), { json: JSON.stringify(published), updatedAt: now() });
        const pub = x.publicDocFor(k, published);
        batch.set(doc(db, `config/${k}_public`), pub);
        if (k === 'world') x.configDocs.set('world_public', pub);
      }
      await track(batch.commit(), 'restore');
      p.configDone = true; save();
    }

    // 3. Replace mode: clear current content first (images stay in storage).
    if (mode === 'replace' && !p.cleared) {
      say('Clearing the current content…');
      for (const c of ['items', 'items_private', 'feeds']) {
        const snap = await getDocs(collection(db, c));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await track(batch.commit(), 'restore');
        }
      }
      p.cleared = true; save();
    }

    // 4. Content.
    const content = items.filter((i) => i.kind !== 'media');
    for (let i = p.itemsDone; i < content.length; i += 200) {
      say(`Restoring your books, pages and notes… ${Math.min(i + 200, content.length)} of ${content.length}`);
      const batch = writeBatch(db);
      for (const it of content.slice(i, i + 200)) {
        const data = rewrite(it.data ?? {});
        const { pub, priv } = splitPrivate(data);
        const vis = ['inbox', 'expedition', 'todo', 'bookmark'].includes(it.kind) ? 'private' : it.visibility;
        const id = String(it.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100) || doc(collection(db, 'items')).id;
        batch.set(doc(db, `items/${id}`), clean({ kind: it.kind, roomId: it.roomId ?? null, visibility: vis, data: pub, createdAt: it.createdAt ?? now(), updatedAt: it.updatedAt ?? now() }));
        if (Object.keys(priv).length) batch.set(doc(db, `items_private/${id}`), clean(priv));
      }
      await track(batch.commit(), 'restore');
      p.itemsDone = Math.min(i + 200, content.length); save();
    }

    // 5. Subscriptions and saved posts.
    if (!p.feedsDone) {
      say('Restoring your subscriptions…');
      for (const f of b.feeds ?? []) {
        if (!/^https?:\/\//.test(String(f.url))) continue;
        const fid = String(f.id).replace(/[^A-Za-z0-9_-]/g, '') || doc(collection(db, 'feeds')).id;
        const saved = (b.savedEntries ?? []).filter((e) => e.feed_id === f.id).map((e) => ({
          id: `${fid}~${String(e.id).slice(-12)}`, guid: e.guid, title: e.title, link: e.link, published: e.published ?? null, summary: e.summary ?? '', image: e.image ?? null, read: !!e.read, saved: true,
        }));
        x.saveFeed(fid, { url: f.url, title: f.title ?? f.url, siteUrl: f.siteUrl ?? null, category: f.category ?? 'Imported', entries: saved }, 'restore');
      }
      p.feedsDone = true; save();
    }

    say('Updating what visitors see…');
    // Give the live listeners a moment to catch up, then rebuild the public room bundles.
    await new Promise((r) => setTimeout(r, 1500));
    await x.rebuildAllBundles();
    await x.publishReferencedMedia(JSON.stringify(content.filter((i) => i.visibility !== 'private')) + (x.configDocs.get('world_public')?.json ?? ''));
    localStorage.removeItem(PROGRESS_KEY);
    return { notes };
  } catch (e: any) {
    save();
    const quota = e?.code === 'resource-exhausted';
    throw new Error(quota
      ? `The restore paused because today's free Firebase allowance is used up (${p.itemsDone} items done). Run the same restore with the same file again tomorrow — it will continue where it stopped.`
      : `The restore stopped: ${e?.message ?? e}. Run it again with the same file to continue where it stopped.`);
  }
}
