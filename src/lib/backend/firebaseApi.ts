import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where, writeBatch, setDoc, deleteDoc, updateDoc,
  serverTimestamp, type Unsubscribe, type DocumentData,
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail, type User,
} from 'firebase/auth';
import { ALWAYS_PRIVATE_KINDS, type Item, type ThemeState, type WorldConfig } from '../../../shared/types';
import { DEFAULT_WORLD } from '../../../shared/defaultWorld';
import { COQUETTE } from '../../../shared/themes';
import { SEED_ITEMS } from '../../../shared/seed';
import { publicTheme, publicWorld, splitPrivate, validateItem, validateTheme, validateWorld } from '../../../shared/logic';
import { discoverAndFetch, unfurl, type ParsedEntry } from '../../../shared/feedLogic';
import { firebase, cloud, cloudJson } from './firebase';
import { OWNER_UID, FIREBASE_CONFIG } from './config';
import { track, friendlyError } from './sync';
import { ApiError, isPreviewingPublic } from '../apiCore';

// The Firebase/Cloudflare backend. It answers the same requests the Node server used to answer
// (`/api/items`, `/api/config/world`…), so every screen of Ribbonmere works unchanged.
//
//   Firestore  = source of truth for everything you write (with an offline copy on each device)
//   Functions  = feed fetching, link previews, image storage (Cloudflare)
//   KV         = image bytes only

const now = () => new Date().toISOString();
const PRIVATE_KINDS = new Set<string>([...ALWAYS_PRIVATE_KINDS, 'media']);
type Key = 'world' | 'theme';
const fail = (status: number, msg: string): never => { throw new ApiError(status, msg); };
const emit = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore can't store `undefined`

// ───────────── auth ─────────────
let user: User | null = null;
let resolveAuth!: () => void;
const authReady = new Promise<void>((r) => { resolveAuth = r; });
let authStarted = false;
function startAuth() {
  if (authStarted) return;
  authStarted = true;
  const { auth } = firebase();
  onAuthStateChanged(auth, (u) => {
    const wasOwner = isOwner();
    user = u;
    if (isOwner()) { startOwner(); refreshMediaSession(); } else stopOwner();
    resolveAuth();
    if (wasOwner !== isOwner()) emit('rm-auth');
  });
}
export const isOwner = () => !!user && !user.isAnonymous && !!OWNER_UID && user.uid === OWNER_UID;
const ownerView = () => isOwner() && !isPreviewingPublic();
export const currentUser = () => user;

async function refreshMediaSession() {
  try {
    const res = await cloud('/api/session', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      emit('rm-sync-error', `Private images can't be shown yet: ${data?.error ?? res.status}`);
    }
  } catch { /* offline — images will load next time */ }
}

// ───────────── owner's live copy of everything (Firestore listeners) ─────────────
interface FsItem { kind: string; roomId: string | null; visibility: Item['visibility']; data: Record<string, any>; createdAt: string; updatedAt: string }
const items = new Map<string, FsItem>();
const priv = new Map<string, Record<string, any>>();
const pending = new Map<string, DocumentData>();
const media = new Map<string, DocumentData>();
const feeds = new Map<string, FeedDoc>();
const bundles = new Map<string, string>();
const configDocs = new Map<string, DocumentData>();
const lastWritten: Partial<Record<Key, string>> = {};
let unsubs: Unsubscribe[] = [];
let ownerReady: Promise<void> | null = null;

function startOwner() {
  if (ownerReady) return;
  const { db } = firebase();
  const waits: Promise<void>[] = [];
  const watch = (path: string, onSnap: (s: any) => void, evt?: string) => {
    let first = true;
    waits.push(new Promise((resolve, reject) => {
      unsubs.push(onSnapshot(collection(db, path), { includeMetadataChanges: false }, (snap) => {
        onSnap(snap);
        if (first) { first = false; resolve(); } else if (evt) emit(evt);
      }, (err) => { emit('rm-sync-error', friendlyError(err)); reject(err); }));
    }));
  };
  const into = (m: Map<string, any>) => (snap: any) => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') m.delete(ch.doc.id); else m.set(ch.doc.id, ch.doc.data());
    }
  };
  watch('items', into(items), 'rm-items');
  watch('items_private', into(priv), 'rm-items');
  watch('guestbook_pending', into(pending), 'rm-items');
  watch('media', into(media), 'rm-items');
  watch('feeds', into(feeds), 'rm-feeds');
  watch('public_rooms', (snap) => { for (const ch of snap.docChanges()) { if (ch.type === 'removed') bundles.delete(ch.doc.id); else bundles.set(ch.doc.id, ch.doc.data().json); } });
  watch('config', (snap) => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') { configDocs.delete(ch.doc.id); continue; }
      configDocs.set(ch.doc.id, ch.doc.data());
      // Another device changed a draft → tell the app (but ignore echoes of our own writes).
      const m = ch.doc.id.match(/^(world|theme)_draft$/);
      if (m && !ch.doc.metadata.hasPendingWrites) {
        const key = m[1] as Key;
        if (lastWritten[key] !== undefined && ch.doc.data().json !== lastWritten[key]) { lastWritten[key] = ch.doc.data().json; emit('rm-remote', key); }
      }
    }
  });
  ownerReady = Promise.all(waits).then(() => {
    emit('rm-items'); emit('rm-feeds');
    // Self-repair: if a previous visit closed before a room's public bundle was written, fix it now.
    rebuildAllBundles().catch(() => {});
  });
  ownerReady.catch(() => { /* reported via rm-sync-error */ });
}
function stopOwner() {
  unsubs.forEach((u) => u());
  unsubs = [];
  ownerReady = null;
  [items, priv, pending, media, feeds, bundles, configDocs].forEach((m) => m.clear());
}
async function owner() {
  await authReady;
  if (!isOwner()) fail(401, 'Only the owner of this world can do that. Please sign in.');
  startOwner();
  await ownerReady;
  await ensureSeeded();
}

const toItem = (id: string, d: FsItem): Item => ({
  id, kind: d.kind as Item['kind'], roomId: d.roomId ?? null, visibility: d.visibility,
  data: { ...d.data, ...(priv.get(id) ?? {}) }, createdAt: d.createdAt, updatedAt: d.updatedAt,
});
const mediaItem = (id: string, m: DocumentData): Item => ({
  id, kind: 'media', roomId: null, visibility: m.visibility === 'public' ? 'public' : 'private',
  data: { name: m.name, url: m.url, type: m.type, size: m.size, category: m.category, decoration: !!m.decoration, visibility: m.visibility, file: `${id}.${m.ext ?? 'png'}` },
  createdAt: m.createdAt, updatedAt: m.updatedAt ?? m.createdAt,
});
const pendingItem = (id: string, p: DocumentData): Item => {
  const created = p.createdAt?.toDate?.()?.toISOString?.() ?? now();
  return { id: `pending:${id}`, kind: 'guestbook', roomId: p.roomId, visibility: 'private', data: { name: p.name, message: p.message, stationery: p.stationery, approved: false }, createdAt: created, updatedAt: created };
};
function ownerItems(): Item[] {
  const all = [...items.entries()].map(([id, d]) => toItem(id, d));
  for (const [id, p] of pending) all.push(pendingItem(id, p));
  for (const [id, m] of media) all.push(mediaItem(id, m));
  return all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

// ───────────── config (world & theme: draft → publish) ─────────────
const cfgJson = (id: string) => { const d = configDocs.get(id); return d?.json ? JSON.parse(d.json) : null; };
function normaliseWorld(w: any): WorldConfig { return { ...DEFAULT_WORLD, ...w, modes: { ...DEFAULT_WORLD.modes, ...(w?.modes ?? {}) }, inbox: { ...DEFAULT_WORLD.inbox, ...(w?.inbox ?? {}) } }; }
function publicDocFor(key: Key, value: any) {
  if (key === 'theme') return { json: JSON.stringify(publicTheme(value)), updatedAt: now() };
  const pw = publicWorld(normaliseWorld(value));
  return {
    json: JSON.stringify(pw), updatedAt: now(),
    publicRoomIds: pw.rooms.map((r) => r.id),
    guestbookRoomIds: pw.rooms.filter((r) => r.template === 'postoffice' && r.settings?.guestbookOpen !== false).map((r) => r.id),
  };
}

let seeding: Promise<void> | null = null;
function ensureSeeded() {
  if (configDocs.has('world_draft')) return Promise.resolve();
  seeding ??= (async () => {
    // First sign-in on a fresh Firebase project: plant the starting village.
    const { db } = firebase();
    const fresh = await getDoc(doc(db, 'config/world_draft'));
    if (fresh.exists()) return;
    const b = writeBatch(db);
    const theme: ThemeState = { active: COQUETTE, custom: [] };
    for (const [key, value] of [['world', DEFAULT_WORLD], ['theme', theme]] as const) {
      const json = JSON.stringify(value);
      lastWritten[key] = json;
      b.set(doc(db, `config/${key}_draft`), { json, updatedAt: now() });
      b.set(doc(db, `config/${key}_published`), { json, updatedAt: now() });
      b.set(doc(db, `config/${key}_public`), publicDocFor(key, value));
    }
    const t = now();
    for (const s of SEED_ITEMS) b.set(doc(collection(db, 'items')), clean({ kind: s.kind, roomId: s.roomId, visibility: s.visibility, data: s.data, createdAt: t, updatedAt: t }));
    await track(b.commit(), 'starting village');
    await rebuildAllBundles();
  })();
  return seeding;
}

async function getConfig(key: Key) {
  await authReady;
  if (ownerView()) {
    await owner();
    const draft = cfgJson(`${key}_draft`); const published = cfgJson(`${key}_published`);
    lastWritten[key] ??= configDocs.get(`${key}_draft`)?.json;
    const hasUnpublished = key === 'world'
      ? JSON.stringify(publicWorld(normaliseWorld(draft))) !== JSON.stringify(publicWorld(normaliseWorld(published)))
      : JSON.stringify(draft) !== JSON.stringify(published);
    return { draft, published, hasUnpublished, updatedAt: configDocs.get(`${key}_draft`)?.updatedAt };
  }
  const { db } = firebase();
  try {
    const snap = await getDoc(doc(db, `config/${key}_public`));
    if (snap.exists()) return { published: JSON.parse(snap.data().json) };
  } catch (e) { if ((e as any)?.code !== 'permission-denied') throw e; }
  // Nothing published yet (brand-new site): show the starting village.
  return { published: key === 'world' ? publicWorld(DEFAULT_WORLD) : { active: COQUETTE, custom: [] } };
}

async function saveDraft(key: Key, body: any) {
  await owner();
  const err = key === 'world' ? validateWorld(body) : validateTheme(body);
  if (err) fail(400, err);
  const json = JSON.stringify(body);
  if (json.length > 900_000) fail(413, 'Your village has grown too big to save in one piece (Firestore allows about 1 MB per document). Try removing unused objects or very long texts.');
  lastWritten[key] = json;
  const { db } = firebase();
  track(setDoc(doc(db, `config/${key}_draft`), { json, updatedAt: now() }), key === 'world' ? 'village change' : 'theme change');
  return { ok: true, savedAt: now() };
}

async function addVersion(key: Key, value: any, label: string) {
  const { db } = firebase();
  await track(setDoc(doc(collection(db, 'versions')), { key, json: JSON.stringify(value), label: String(label).slice(0, 80), createdAt: now() }), 'checkpoint');
  // Keep the newest 40 per kind.
  const all = (await getDocs(query(collection(db, 'versions'), where('key', '==', key)))).docs.sort((a, b) => b.data().createdAt.localeCompare(a.data().createdAt));
  for (const old of all.slice(40)) track(deleteDoc(old.ref), 'old checkpoint cleanup');
}

async function publish(key: Key, label: string) {
  await owner();
  if (!navigator.onLine) fail(503, "Publishing needs an internet connection — you're offline right now.");
  const draft = cfgJson(`${key}_draft`); const published = cfgJson(`${key}_published`);
  if (published) await addVersion(key, published, label || 'Before publishing');
  const { db } = firebase();
  const b = writeBatch(db);
  b.set(doc(db, `config/${key}_published`), { json: JSON.stringify(draft), updatedAt: now() });
  const pub = publicDocFor(key, draft);
  b.set(doc(db, `config/${key}_public`), pub);
  await track(b.commit(), 'publish');
  if (key === 'world') {
    configDocs.set('world_public', pub);
    await rebuildAllBundles();
    await publishReferencedMedia(pub.json);
  }
  return { ok: true };
}

// ───────────── room bundles: one public document per room ─────────────
// Visitors read a whole room in one go (1 read instead of 1 per book), which keeps busy days
// comfortably inside Firestore's free 50,000 reads/day.
const bundleTimers = new Map<string, number>();
function publicRoomIds(): string[] { return configDocs.get('world_public')?.publicRoomIds ?? []; }
function bundleFor(roomId: string) {
  const list = [...items.entries()]
    .filter(([, d]) => d.roomId === roomId && d.visibility === 'public' && !PRIVATE_KINDS.has(d.kind))
    .map(([id, d]) => ({ id, kind: d.kind, roomId: d.roomId, visibility: 'public', data: d.data, createdAt: d.createdAt, updatedAt: d.updatedAt }));
  return JSON.stringify(list);
}
async function writeBundle(roomId: string) {
  const { db } = firebase();
  if (!publicRoomIds().includes(roomId)) {
    if (bundles.has(roomId)) await track(deleteDoc(doc(db, `public_rooms/${roomId}`)), 'room update');
    return;
  }
  const json = bundleFor(roomId);
  if (bundles.get(roomId) === json) return;
  if (json.length > 950_000) { emit('rm-sync-error', `The room “${roomId}” has too much public content for one bundle (over 1 MB). Visitors may not see the newest items there.`); return; }
  bundles.set(roomId, json);
  await track(setDoc(doc(db, `public_rooms/${roomId}`), { json, updatedAt: now() }), 'room update');
}
function scheduleBundle(roomId: string | null | undefined) {
  if (!roomId) return;
  window.clearTimeout(bundleTimers.get(roomId));
  bundleTimers.set(roomId, window.setTimeout(() => { bundleTimers.delete(roomId); writeBundle(roomId).catch(() => {}); }, 400));
}
/** Don't lose a pending room update when the tab is closed or hidden. */
function flushBundles() {
  for (const [roomId, t] of bundleTimers) { window.clearTimeout(t); bundleTimers.delete(roomId); writeBundle(roomId).catch(() => {}); }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushBundles);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushBundles(); });
}
async function rebuildAllBundles() {
  const rooms = new Set([...publicRoomIds(), ...bundles.keys()]);
  for (const r of rooms) await writeBundle(r);
}

const visitorBundles = new Map<string, { at: number; items: Item[] }>();
async function readBundle(roomId: string): Promise<Item[]> {
  const hit = visitorBundles.get(roomId);
  if (hit && Date.now() - hit.at < 60_000) return hit.items;
  const { db } = firebase();
  let list: Item[] = [];
  try {
    const snap = await getDoc(doc(db, `public_rooms/${roomId}`));
    list = snap.exists() ? JSON.parse(snap.data().json) : [];
  } catch (e) { if ((e as any)?.code !== 'permission-denied') throw e; }
  visitorBundles.set(roomId, { at: Date.now(), items: list });
  return list;
}
async function visitorRooms(): Promise<WorldConfig> { return (await getConfig('world')).published as WorldConfig; }

// ───────────── items ─────────────
async function listItems(kind?: string | null, roomId?: string | null): Promise<Item[]> {
  await authReady;
  if (ownerView()) {
    await owner();
    return ownerItems().filter((i) => (!kind || i.kind === kind) && (!roomId || i.roomId === roomId));
  }
  const rooms = roomId ? [roomId] : (await visitorRooms()).rooms.filter((r) => r.visibility === 'public').map((r) => r.id);
  const all = (await Promise.all(rooms.map(readBundle))).flat();
  return all.filter((i) => !kind || i.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getItem(id: string): Promise<Item> {
  await authReady;
  if (ownerView()) {
    await owner();
    const found = ownerItems().find((i) => i.id === id);
    if (found) return found;
    fail(404, 'Nothing lives here.');
  }
  const { db } = firebase();
  try {
    const snap = await getDoc(doc(db, `items/${id}`));
    if (snap.exists()) return { id, ...(snap.data() as FsItem), roomId: snap.data().roomId ?? null } as Item;
  } catch { /* private or missing: same answer */ }
  return fail(404, 'Nothing lives here.');
}

function writeItem(id: string, kind: string, roomId: string | null, visibility: Item['visibility'], data: Record<string, any>, createdAt: string) {
  const { db } = firebase();
  const { pub, priv: p } = splitPrivate(data);
  const vis = PRIVATE_KINDS.has(kind) ? 'private' : visibility;
  const record: FsItem = clean({ kind, roomId, visibility: vis, data: pub, createdAt, updatedAt: now() });
  const b = writeBatch(db);
  b.set(doc(db, `items/${id}`), record);
  if (Object.keys(p).length) b.set(doc(db, `items_private/${id}`), clean(p));
  else if (priv.has(id)) b.delete(doc(db, `items_private/${id}`));
  track(b.commit(), kind === 'entry' ? 'journal page' : kind);
  // Update the local copy straight away (the listener confirms a moment later).
  items.set(id, record);
  if (Object.keys(p).length) priv.set(id, p); else priv.delete(id);
  if (vis !== 'private') publishReferencedMedia(JSON.stringify(pub)).catch(() => {});
  emit('rm-items');
  return toItem(id, record);
}

async function createItem(body: any): Promise<Item> {
  await owner();
  const { kind, roomId = null, visibility = 'private', data = {} } = body ?? {};
  const err = validateItem(kind, visibility, data, roomId);
  if (err) fail(400, err);
  const { db } = firebase();
  const id = doc(collection(db, 'items')).id;
  const it = writeItem(id, kind, roomId, visibility, data, now());
  scheduleBundle(roomId);
  return it;
}

async function updateItem(id: string, body: any): Promise<Item> {
  await owner();
  const { db } = firebase();
  if (id.startsWith('pending:')) {
    // Approving a guestbook letter: it becomes a public item in the post office.
    const pid = id.slice(8);
    const p = pending.get(pid);
    if (!p) fail(404, 'That letter is gone.');
    const newId = doc(collection(db, 'items')).id;
    const created = p!.createdAt?.toDate?.()?.toISOString?.() ?? now();
    const it = writeItem(newId, 'guestbook', p!.roomId, body.visibility ?? 'public', { name: p!.name, message: p!.message, stationery: p!.stationery, approved: true }, created);
    track(deleteDoc(doc(db, `guestbook_pending/${pid}`)), 'letter');
    pending.delete(pid);
    scheduleBundle(p!.roomId);
    return it;
  }
  if (media.has(id)) return updateMedia(id, body);
  const cur = items.get(id);
  if (!cur) fail(404, 'That item no longer exists.');
  const full = { ...cur!.data, ...(priv.get(id) ?? {}) };
  const data = body.data ? (body.replace ? body.data : { ...full, ...body.data }) : full;
  const visibility = body.visibility ?? cur!.visibility;
  const roomId = body.roomId !== undefined ? body.roomId : cur!.roomId;
  const err = validateItem(cur!.kind, visibility, data, roomId);
  if (err) fail(400, err);
  const it = writeItem(id, cur!.kind, roomId, visibility, data, cur!.createdAt);
  scheduleBundle(cur!.roomId);
  if (roomId !== cur!.roomId) scheduleBundle(roomId);
  return it;
}

async function deleteItem(id: string) {
  await owner();
  const { db } = firebase();
  if (id.startsWith('pending:')) {
    await track(deleteDoc(doc(db, `guestbook_pending/${id.slice(8)}`)), 'letter');
    pending.delete(id.slice(8));
    emit('rm-items');
    return { ok: true };
  }
  if (media.has(id)) {
    const res = await cloud(`/api/media/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) fail(res.status, (await res.json().catch(() => ({})))?.error ?? 'Could not delete the image.');
    track(deleteDoc(doc(db, `media/${id}`)), 'image');
    media.delete(id);
    emit('rm-items');
    return { ok: true };
  }
  const cur = items.get(id);
  const b = writeBatch(db);
  b.delete(doc(db, `items/${id}`));
  b.delete(doc(db, `items_private/${id}`));
  track(b.commit(), 'delete');
  items.delete(id); priv.delete(id);
  emit('rm-items');
  scheduleBundle(cur?.roomId);
  return { ok: true };
}

async function duplicateRoomItems(from: string, to: string) {
  await owner();
  const { db } = firebase();
  let n = 0;
  for (const [id, d] of [...items.entries()].filter(([, d]) => d.roomId === from)) {
    writeItem(doc(collection(db, 'items')).id, d.kind, to, d.visibility, { ...d.data, ...(priv.get(id) ?? {}) }, now());
    n++;
  }
  scheduleBundle(to);
  return { ok: true, copied: n };
}
async function deleteRoomItems(roomId: string) {
  await owner();
  const ids = [...items.entries()].filter(([, d]) => d.roomId === roomId).map(([id]) => id);
  for (const id of ids) await deleteItem(id);
  return { ok: true, removed: ids.length };
}

// ───────────── guestbook (visitors) ─────────────
async function postLetter(body: any) {
  const { name, message, website, roomId, stationery } = body ?? {};
  if (website) return { ok: true, pending: true }; // honeypot
  const n = String(name ?? '').trim().slice(0, 60); const m = String(message ?? '').trim().slice(0, 1500);
  if (!n || m.length < 2) fail(400, 'Please write your name and a little message.');
  if ((m.match(/https?:\/\//g) ?? []).length > 2) fail(400, 'Too many links in one letter.');
  const { auth, db } = firebase();
  await authReady;
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); }
    catch (e: any) { fail(503, e?.code === 'auth/admin-restricted-operation' ? 'The guestbook is not switched on yet (Anonymous sign-in is disabled in Firebase).' : friendlyError(e)); }
  }
  const uid = auth.currentUser!.uid;
  const b = writeBatch(db);
  b.set(doc(db, `gb_limits/${uid}`), { last: serverTimestamp() });
  b.set(doc(collection(db, 'guestbook_pending')), { name: n, message: m, stationery: String(stationery ?? 'rose').slice(0, 20), roomId: String(roomId), uid, createdAt: serverTimestamp() });
  try { await b.commit(); }
  catch (e: any) {
    if (e?.code === 'permission-denied') fail(429, 'Your letter was not sent: you wrote one only a few minutes ago, or the guestbook is closed. Please try again later.');
    fail(503, friendlyError(e));
  }
  return { ok: true, pending: true };
}

// ───────────── search ─────────────
async function search(q: string) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return { items: [], rooms: [], entries: [] };
  await authReady;
  const match = (o: unknown) => JSON.stringify(o).toLowerCase().includes(q);
  if (ownerView()) {
    await owner();
    const world = normaliseWorld(cfgJson('world_draft'));
    const its = ownerItems().filter((i) => i.kind !== 'media' && match(i.data)).slice(0, 100);
    const entries = [...feeds.entries()].flatMap(([fid, f]) => (f.entries ?? []).filter((e) => match([e.title, e.summary])).map((e) => ({ ...e, feed_title: f.title, feed_id: fid }))).slice(0, 50);
    return { items: its, rooms: world.rooms.filter((r) => r.visibility !== 'unlisted' && match([r.name, r.subtitle])), entries };
  }
  const world = await visitorRooms();
  const its = (await listItems(null, null)).filter((i) => match(i.data)).slice(0, 100);
  return { items: its, rooms: world.rooms.filter((r) => r.visibility !== 'unlisted' && match([r.name, r.subtitle])), entries: [] };
}

// ───────────── feeds (RSS / Atom) ─────────────
interface FeedEntry { id: string; guid: string; title: string; link: string; published: string | null; summary: string; image: string | null; read: boolean; saved: boolean }
interface FeedDoc { url: string; title: string; siteUrl: string | null; category: string; lastFetched?: string; lastError?: string | null; entries: FeedEntry[] }

const fetcher = async (url: string, accept: string) => cloudJson<{ text: string; finalUrl: string; contentType: string }>('/api/fetch', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, accept }),
});
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
function mergeEntries(fid: string, old: FeedEntry[], fresh: ParsedEntry[]) {
  const byGuid = new Map(old.map((e) => [e.guid, e]));
  let added = 0;
  for (const e of fresh.slice(0, 100)) {
    if (!e.link) continue;
    const guid = e.guid.slice(0, 500);
    if (byGuid.has(guid)) continue;
    byGuid.set(guid, { id: `${fid}~${hash(guid)}`, guid, title: e.title.slice(0, 500), link: e.link, published: e.published, summary: e.summary, image: e.image, read: false, saved: false });
    added++;
  }
  const all = [...byGuid.values()].sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));
  const keep = all.filter((e, i) => i < 200 || e.saved);
  return { entries: keep, added };
}
const feedRow = (id: string, f: FeedDoc) => ({ id, url: f.url, title: f.title, siteUrl: f.siteUrl, category: f.category, lastFetched: f.lastFetched, lastError: f.lastError ?? null, unread: (f.entries ?? []).filter((e) => !e.read).length });
function saveFeed(id: string, f: FeedDoc, what = 'feed') {
  const { db } = firebase();
  feeds.set(id, f);
  track(setDoc(doc(db, `feeds/${id}`), clean(f)), what);
  emit('rm-feeds');
}

async function addFeed(body: any) {
  await owner();
  const { url, category = 'Internet Discoveries', title } = body ?? {};
  if (typeof url !== 'string' || url.length > 2000) fail(400, 'Please paste a feed or website address.');
  let result;
  try { result = await discoverAndFetch(url, fetcher); } catch (e: any) { return fail(422, String(e.message ?? e)); }
  if ([...feeds.values()].some((f) => f.url === result.feedUrl)) fail(409, 'You already follow that feed.');
  const { db } = firebase();
  const id = doc(collection(db, 'feeds')).id;
  const { entries, added } = mergeEntries(id, [], result.feed.entries);
  saveFeed(id, { url: result.feedUrl, title: String(title || result.feed.title).slice(0, 200), siteUrl: result.feed.siteUrl, category: String(category).slice(0, 80), lastFetched: now(), lastError: null, entries });
  return { ...feedRow(id, feeds.get(id)!), added };
}
async function refreshFeeds(body: any) {
  await owner();
  const ids = body?.id ? [body.id] : [...feeds.keys()];
  const results: any[] = [];
  const one = async (id: string) => {
    const f = feeds.get(id);
    if (!f) return;
    if (!body?.force && f.lastFetched && Date.now() - Date.parse(f.lastFetched) < 15 * 60_000 && !f.lastError) { results.push({ id, skipped: true }); return; }
    try {
      const { feed } = await discoverAndFetch(f.url, fetcher);
      const { entries, added } = mergeEntries(id, f.entries ?? [], feed.entries);
      saveFeed(id, { ...f, siteUrl: f.siteUrl ?? feed.siteUrl, entries, lastFetched: now(), lastError: null });
      results.push({ id, added });
    } catch (e: any) {
      saveFeed(id, { ...f, lastFetched: now(), lastError: String(e.message ?? e).slice(0, 300) });
      results.push({ id, error: String(e.message ?? e) });
    }
  };
  for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map(one));
  return { results, refreshedAt: now() };
}
async function listEntries(q: URLSearchParams) {
  await owner();
  const feedId = q.get('feedId'); const category = q.get('category'); const filter = q.get('filter');
  const limit = Math.min(Number(q.get('limit')) || 100, 300);
  return [...feeds.entries()]
    .filter(([id, f]) => (!feedId || id === feedId) && (!category || f.category === category))
    .flatMap(([id, f]) => (f.entries ?? []).map((e) => ({ ...e, feedId: id, feedTitle: f.title, category: f.category })))
    .filter((e) => (filter === 'unread' ? !e.read : filter === 'saved' ? e.saved : true))
    .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
    .slice(0, limit);
}
async function patchEntry(entryId: string, body: any) {
  await owner();
  const fid = entryId.split('~')[0];
  const f = feeds.get(fid);
  if (!f) fail(404, 'That post is gone.');
  const entries = f!.entries.map((e) => (e.id === entryId ? { ...e, ...(typeof body.read === 'boolean' ? { read: body.read } : {}), ...(typeof body.saved === 'boolean' ? { saved: body.saved } : {}) } : e));
  saveFeed(fid, { ...f!, entries }, 'reading progress');
  return { ok: true };
}
async function markAllRead(body: any) {
  await owner();
  for (const [id, f] of feeds) if (!body?.feedId || body.feedId === id) {
    if (f.entries.some((e) => !e.read)) saveFeed(id, { ...f, entries: f.entries.map((e) => ({ ...e, read: true })) }, 'reading progress');
  }
  return { ok: true };
}
async function importOpml(xml: string) {
  await owner();
  const { db } = firebase();
  let added = 0; let category = 'Imported';
  for (const tag of xml.match(/<outline\b[^>]*>/gi) ?? []) {
    const attr = (n: string) => tag.match(new RegExp(`${n}="([^"]*)"`, 'i'))?.[1]?.replace(/&amp;/g, '&');
    const xmlUrl = attr('xmlUrl');
    if (!xmlUrl) { category = attr('text') || attr('title') || category; continue; }
    if (!/^https?:\/\//.test(xmlUrl) || [...feeds.values()].some((f) => f.url === xmlUrl)) continue;
    saveFeed(doc(collection(db, 'feeds')).id, { url: xmlUrl, title: (attr('title') || attr('text') || xmlUrl).slice(0, 200), siteUrl: attr('htmlUrl') ?? null, category: category.slice(0, 80), entries: [] }, 'subscriptions');
    added++;
  }
  return { ok: true, added };
}
export async function opmlText(): Promise<string> {
  await owner();
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
  const rows = [...feeds.values()];
  const cats = [...new Set(rows.map((r) => r.category))];
  const body = cats.map((c) => `    <outline text="${esc(c)}">\n${rows.filter((r) => r.category === c).map((r) => `      <outline type="rss" text="${esc(r.title)}" xmlUrl="${esc(r.url)}"${r.siteUrl ? ` htmlUrl="${esc(r.siteUrl)}"` : ''}/>`).join('\n')}\n    </outline>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>Ribbonmere subscriptions</title></head>\n  <body>\n${body}\n  </body>\n</opml>\n`;
}

// ───────────── images (Cloudflare KV; metadata in Firestore) ─────────────
const MEDIA_RE = /\/media\/([a-f0-9]{32})/g;
/** Anything shown on a public page must be viewable by visitors: make those images public. */
async function publishReferencedMedia(text: string) {
  if (!isOwner()) return;
  const ids = [...new Set([...text.matchAll(MEDIA_RE)].map((m) => m[1]))].filter((id) => media.get(id)?.visibility !== 'public');
  if (!ids.length) return;
  const { db } = firebase();
  try {
    await cloudJson('/api/media/visibility', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids, visibility: 'public' }) });
    for (const id of ids) if (media.has(id)) track(updateDoc(doc(db, `media/${id}`), { visibility: 'public', updatedAt: now() }), 'image');
  } catch (e: any) {
    emit('rm-sync-error', `Some images on a public page are still private, so visitors can't see them yet: ${e.message}`);
  }
}

async function shrink(file: File): Promise<Blob> {
  // Photos are resized and re-encoded in the browser so the free 1 GB of image storage goes further.
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || (file.size < 600_000)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const webp: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86));
    if (webp && webp.type === 'image/webp' && webp.size < file.size) return webp;
    if (file.type === 'image/jpeg') {
      const jpg: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
      if (jpg && jpg.size < file.size) return jpg;
    }
  } catch { /* keep the original */ }
  return file;
}

async function uploadMedia(file: Blob, headers: Headers): Promise<Item> {
  await owner();
  const body = await shrink(file as File);
  const visibility = headers.get('x-visibility') === 'public' ? 'public' : 'private';
  const res = await cloudJson<{ id: string; url: string; type: string; size: number }>('/api/media', {
    method: 'POST', body, headers: { 'content-type': 'application/octet-stream', 'x-visibility': visibility },
  });
  const { db } = firebase();
  const meta = {
    name: decodeURIComponent(headers.get('x-filename') ?? 'image').slice(0, 120), url: res.url, type: res.type, ext: res.type, size: res.size,
    category: String(headers.get('x-category') ?? 'Uploads').slice(0, 60), decoration: headers.get('x-decoration') === '1',
    visibility, createdAt: now(), updatedAt: now(),
  };
  media.set(res.id, meta);
  track(setDoc(doc(db, `media/${res.id}`), meta), 'image details');
  emit('rm-items');
  return mediaItem(res.id, meta);
}
async function updateMedia(id: string, body: any): Promise<Item> {
  const { db } = firebase();
  const cur = media.get(id)!;
  const want = body.visibility ?? body.data?.visibility;
  const next = { ...cur, ...(body.data ?? {}), updatedAt: now() };
  delete (next as any).url; delete (next as any).file;
  next.url = cur.url;
  if (want && want !== cur.visibility) {
    await cloudJson(`/api/media/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visibility: want === 'public' ? 'public' : 'private' }) });
    next.visibility = want === 'public' ? 'public' : 'private';
  }
  media.set(id, next);
  track(setDoc(doc(db, `media/${id}`), clean(next)), 'image details');
  emit('rm-items');
  return mediaItem(id, next);
}

// ───────────── auth endpoints ─────────────
async function authStatus() {
  await authReady;
  return { owner: isOwner(), needsSetup: !OWNER_UID, signedIn: !!user && !user.isAnonymous, uid: user && !user.isAnonymous ? user.uid : null, email: user?.email ?? null, configured: !!FIREBASE_CONFIG };
}
async function login(body: any) {
  const { auth } = firebase();
  try { await signInWithEmailAndPassword(auth, String(body?.email ?? '').trim(), String(body?.password ?? '')); }
  catch (e) { fail(401, friendlyError(e)); }
  await authReady;
  if (!isOwner()) {
    const uid = auth.currentUser?.uid;
    if (OWNER_UID) { await signOut(auth); fail(403, 'That account is not the owner of this world.'); }
    return { ok: true, uid, setup: true };
  }
  await refreshMediaSession();
  return { ok: true };
}
async function setupAccount(body: any) {
  const { auth } = firebase();
  if (String(body?.password ?? '').length < 8) fail(400, 'Please choose a password of at least 8 characters.');
  try {
    const cred = await createUserWithEmailAndPassword(auth, String(body?.email ?? '').trim(), String(body.password));
    return { ok: true, uid: cred.user.uid };
  } catch (e) { return fail(400, friendlyError(e)); }
}
async function logout() {
  const { auth } = firebase();
  await cloud('/api/session', { method: 'DELETE' }).catch(() => {});
  await signOut(auth);
  return { ok: true };
}
async function changePassword(body: any) {
  await owner();
  const { auth } = firebase();
  const u = auth.currentUser!;
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email!, String(body?.current ?? '')));
    if (String(body?.next ?? '').length < 8) fail(400, 'Please choose at least 8 characters.');
    await updatePassword(u, String(body.next));
  } catch (e: any) { if (e instanceof ApiError) throw e; fail(401, friendlyError(e)); }
  return { ok: true };
}
async function resetPassword(body: any) {
  const { auth } = firebase();
  try { await sendPasswordResetEmail(auth, String(body?.email ?? '').trim()); } catch (e) { fail(400, friendlyError(e)); }
  return { ok: true };
}

// ───────────── versions ─────────────
async function listVersions(key: Key) {
  await owner();
  const { db } = firebase();
  const docs = (await getDocs(query(collection(db, 'versions'), where('key', '==', key)))).docs;
  return docs.map((d) => ({ id: d.id, label: d.data().label, createdAt: d.data().createdAt })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function restoreVersion(key: Key, id: string) {
  await owner();
  const { db } = firebase();
  const snap = await getDoc(doc(db, `versions/${id}`));
  if (!snap.exists() || snap.data().key !== key) fail(404, 'That checkpoint no longer exists.');
  lastWritten[key] = snap.data()!.json;
  await track(setDoc(doc(db, `config/${key}_draft`), { json: snap.data()!.json, updatedAt: now() }), 'checkpoint');
  return { ok: true, draft: JSON.parse(snap.data()!.json) };
}

// ───────────── the router ─────────────
export async function firebaseApi(method: string, url: string, body?: any, headers: Record<string, string> = {}): Promise<any> {
  startAuth();
  const u = new URL(url, location.origin);
  const p = u.pathname.replace(/\/+$/, '');
  const q = u.searchParams;
  const is = (m: string, re: RegExp) => (method === m ? re.exec(p) : null);
  let m: RegExpExecArray | null;

  if (is('GET', /^\/api\/auth\/status$/)) return authStatus();
  if (is('POST', /^\/api\/auth\/login$/)) return login(body);
  if (is('POST', /^\/api\/auth\/setup$/)) return setupAccount(body);
  if (is('POST', /^\/api\/auth\/logout$/)) return logout();
  if (is('POST', /^\/api\/auth\/password$/)) return changePassword(body);
  if (is('POST', /^\/api\/auth\/reset$/)) return resetPassword(body);

  if ((m = is('GET', /^\/api\/config\/(world|theme)$/))) return getConfig(m[1] as Key);
  if ((m = is('PUT', /^\/api\/config\/(world|theme)\/draft$/))) return saveDraft(m[1] as Key, body);
  if ((m = is('POST', /^\/api\/config\/(world|theme)\/publish$/))) return publish(m[1] as Key, body?.label);
  if ((m = is('POST', /^\/api\/config\/(world|theme)\/discard$/))) {
    await owner();
    const json = configDocs.get(`${m[1]}_published`)?.json;
    lastWritten[m[1] as Key] = json;
    await track(setDoc(doc(firebase().db, `config/${m[1]}_draft`), { json, updatedAt: now() }), 'discard');
    return { ok: true };
  }
  if ((m = is('POST', /^\/api\/config\/(world|theme)\/reset$/))) {
    await owner();
    const def = m[1] === 'world' ? DEFAULT_WORLD : { active: COQUETTE, custom: cfgJson('theme_draft')?.custom ?? [] };
    await saveDraft(m[1] as Key, def);
    return { ok: true, draft: def };
  }
  if ((m = is('GET', /^\/api\/config\/(world|theme)\/versions$/))) return listVersions(m[1] as Key);
  if ((m = is('POST', /^\/api\/config\/(world|theme)\/checkpoint$/))) { await owner(); await addVersion(m[1] as Key, cfgJson(`${m[1]}_draft`), body?.label || 'Checkpoint'); return { ok: true }; }
  if ((m = is('POST', /^\/api\/config\/(world|theme)\/versions\/([^/]+)\/restore$/))) return restoreVersion(m[1] as Key, m[2]);

  if (is('GET', /^\/api\/items$/)) return listItems(q.get('kind'), q.get('roomId'));
  if ((m = is('GET', /^\/api\/items\/([^/]+)$/))) return getItem(decodeURIComponent(m[1]));
  if (is('POST', /^\/api\/items$/)) return createItem(body);
  if ((m = is('PATCH', /^\/api\/items\/([^/]+)$/))) return updateItem(decodeURIComponent(m[1]), body);
  if ((m = is('DELETE', /^\/api\/items\/([^/]+)$/))) return deleteItem(decodeURIComponent(m[1]));
  if ((m = is('POST', /^\/api\/rooms\/([^/]+)\/duplicate-items$/))) return duplicateRoomItems(m[1], String(body?.to ?? ''));
  if ((m = is('DELETE', /^\/api\/rooms\/([^/]+)\/items$/))) return deleteRoomItems(m[1]);

  if (is('POST', /^\/api\/guestbook$/)) return postLetter(body);
  if (is('GET', /^\/api\/search$/)) return search(q.get('q') ?? '');

  if (is('GET', /^\/api\/feeds$/)) { await owner(); return [...feeds.entries()].map(([id, f]) => feedRow(id, f)).sort((a, b) => `${a.category}${a.title}`.localeCompare(`${b.category}${b.title}`)); }
  if (is('POST', /^\/api\/feeds$/)) return addFeed(body);
  if (is('POST', /^\/api\/feeds\/refresh$/)) return refreshFeeds(body);
  if (is('POST', /^\/api\/feeds\/opml$/)) return importOpml(String(body ?? ''));
  if ((m = is('PATCH', /^\/api\/feeds\/([^/]+)$/))) {
    await owner();
    const f = feeds.get(m[1]);
    if (!f) fail(404, 'That subscription is gone.');
    saveFeed(m[1], { ...f!, ...(body?.title ? { title: String(body.title).slice(0, 200) } : {}), ...(body?.category ? { category: String(body.category).slice(0, 80) } : {}) });
    return feedRow(m[1], feeds.get(m[1])!);
  }
  if ((m = is('DELETE', /^\/api\/feeds\/([^/]+)$/))) {
    await owner();
    track(deleteDoc(doc(firebase().db, `feeds/${m[1]}`)), 'subscription');
    feeds.delete(m[1]); emit('rm-feeds');
    return { ok: true };
  }
  if (is('GET', /^\/api\/feed-entries$/)) return listEntries(q);
  if ((m = is('PATCH', /^\/api\/feed-entries\/([^/]+)$/))) return patchEntry(decodeURIComponent(m[1]), body);
  if (is('POST', /^\/api\/feed-entries\/mark-all-read$/)) return markAllRead(body);
  if (is('POST', /^\/api\/unfurl$/)) {
    await owner();
    try { return await unfurl(String(body?.url ?? ''), fetcher); } catch (e: any) { return fail(422, String(e.message ?? e)); }
  }
  if (is('POST', /^\/api\/media$/)) return uploadMedia(body as Blob, new Headers(headers));

  return fail(404, `This version of Ribbonmere doesn't support ${method} ${p}.`);
}

// Exposed for backups (see backup.ts).
export const internals = {
  owner, ownerItems, configDocs, feeds, media, priv, items, cfgJson, normaliseWorld, publicDocFor, lastWritten,
  rebuildAllBundles, writeItem, saveFeed, uploadMedia, publishReferencedMedia, mergeEntries,
};
export const whenAuthReady = () => { startAuth(); return authReady; };
