import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { openDb, type DB } from './db';
import {
  createSession, destroySession, getMeta, hashPassword, isOwner, parseCookies, rateLimit, requireOwner, setMeta, verifyPassword,
} from './auth';
import { googleConfigFromEnv } from './google';
import { createGoogleHandler, type GoogleConfig } from '../shared/googleServer';
import { discoverAndFetch, unfurl } from './feeds';
import { SEED_ITEMS } from '../shared/seed';
import { DEFAULT_WORLD } from '../shared/defaultWorld';
import { COQUETTE } from '../shared/themes';
import { ALWAYS_PRIVATE_KINDS, ITEM_KINDS, type Item, type WorldConfig } from '../shared/types';
import { isSafeSvg, publicTheme, publicWorld, sniffImage, stripPrivateFields, validateItem, validateTheme, validateWorld, VISIBILITIES as VIS } from '../shared/logic';
export { publicWorld };

const now = () => new Date().toISOString();
const newId = () => crypto.randomBytes(9).toString('base64url');
const CONFIG_KEYS = ['world', 'theme'] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

export interface AppOptions { dataDir: string; production?: boolean; ownerPassword?: string; log?: (s: string) => void; google?: GoogleConfig }

export function createApp(opts: AppOptions) {
  const db = openDb(opts.dataDir);
  const uploadsDir = path.join(opts.dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const log = opts.log ?? console.log;
  seedIfEmpty(db);

  // First-run setup: OWNER_PASSWORD env, or a one-time code printed to the server console.
  if (opts.ownerPassword && !getMeta(db, 'password')) setMeta(db, 'password', hashPassword(opts.ownerPassword));
  const setupCode = getMeta(db, 'password') ? null : crypto.randomBytes(4).toString('hex');
  if (setupCode) log(`\n  ♡ Ribbonmere first-run setup code: ${setupCode}\n    Open the site, click "Sign in" and use this code to choose your password.\n`);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (opts.production) {
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "media-src 'self' https:",
        'frame-src https://www.youtube-nocookie.com https://open.spotify.com https://bandcamp.com https://w.soundcloud.com',
        "connect-src 'self'",
        "base-uri 'self'", "form-action 'self'",
      ].join('; '));
    }
    // Owner flag for this request. `?as=public` lets the owner preview exactly what visitors get.
    (req as any).owner = isOwner(db, req) && req.query.as !== 'public';
    next();
  });

  // CSRF: every state-changing API call must carry a custom header, which browsers will not
  // attach to cross-site form posts. Combined with SameSite=Lax cookies.
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-ribbonmere'] !== '1') {
      return res.status(403).json({ error: 'Missing request header.' });
    }
    next();
  });

  const owner = requireOwner(db);
  const ip = (req: Request) => req.ip ?? 'unknown';

  // ───────────── auth ─────────────
  app.get('/api/auth/status', (req, res) => {
    res.json({ owner: isOwner(db, req), needsSetup: !getMeta(db, 'password') });
  });
  app.post('/api/auth/setup', express.json(), (req, res) => {
    if (getMeta(db, 'password')) return res.status(400).json({ error: 'This world already has an owner.' });
    if (!rateLimit(`setup:${ip(req)}`, 10, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Rest a moment.' });
    const { code, password } = req.body ?? {};
    if (!setupCode || typeof code !== 'string' || !crypto.timingSafeEqual(Buffer.from(code.padEnd(8).slice(0, 8)), Buffer.from(setupCode))) {
      return res.status(401).json({ error: 'That setup code is not right. Check the server console.' });
    }
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Please choose a password of at least 8 characters.' });
    setMeta(db, 'password', hashPassword(password));
    createSession(db, res, !!opts.production);
    res.json({ ok: true });
  });
  app.post('/api/auth/login', express.json(), (req, res) => {
    if (!rateLimit(`login:${ip(req)}`, 8, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Please wait a little while.' });
    const stored = getMeta(db, 'password');
    if (!stored || typeof req.body?.password !== 'string' || !verifyPassword(req.body.password, stored)) {
      return res.status(401).json({ error: 'That password is not right.' });
    }
    createSession(db, res, !!opts.production);
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => { destroySession(db, req, res); res.json({ ok: true }); });
  app.post('/api/auth/password', owner, express.json(), (req, res) => {
    const { current, next } = req.body ?? {};
    if (!verifyPassword(String(current ?? ''), getMeta(db, 'password')!)) return res.status(401).json({ error: 'Your current password is not right.' });
    if (typeof next !== 'string' || next.length < 8) return res.status(400).json({ error: 'Please choose at least 8 characters.' });
    setMeta(db, 'password', hashPassword(next));
    db.exec('DELETE FROM sessions');
    createSession(db, res, !!opts.production);
    res.json({ ok: true });
  });

  // ───────────── world & theme config (draft / published / versions) ─────────────
  const readConfig = (key: ConfigKey) => {
    const row = db.prepare('SELECT draft, published, updated_at FROM config WHERE key = ?').get(key) as any;
    return { draft: JSON.parse(row.draft), published: JSON.parse(row.published), updatedAt: row.updated_at };
  };
  const isKey = (k: string): k is ConfigKey => (CONFIG_KEYS as readonly string[]).includes(k);

  app.get('/api/config/:key', (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: 'Unknown setting.' });
    const cfg = readConfig(key);
    if ((req as any).owner) {
      return res.json({ draft: cfg.draft, published: cfg.published, updatedAt: cfg.updatedAt, hasUnpublished: key === 'world'
        ? JSON.stringify(publicWorld(cfg.draft)) !== JSON.stringify(publicWorld(cfg.published))
        : JSON.stringify(cfg.draft) !== JSON.stringify(cfg.published) });
    }
    res.json({ published: key === 'world' ? publicWorld(cfg.published) : publicTheme(cfg.published) });
  });
  app.put('/api/config/:key/draft', owner, express.json({ limit: '4mb' }), (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: 'Unknown setting.' });
    const err = key === 'world' ? validateWorld(req.body) : validateTheme(req.body);
    if (err) return res.status(400).json({ error: err });
    db.prepare('UPDATE config SET draft = ?, updated_at = ? WHERE key = ?').run(JSON.stringify(req.body), now(), key);
    res.json({ ok: true, savedAt: now() });
  });
  app.post('/api/config/:key/publish', owner, express.json(), (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: 'Unknown setting.' });
    const cfg = readConfig(key);
    db.prepare('INSERT INTO config_versions(key, json, label, created_at) VALUES(?, ?, ?, ?)')
      .run(key, JSON.stringify(cfg.published), String(req.body?.label || 'Before publishing'), now());
    db.prepare('UPDATE config SET published = draft, updated_at = ? WHERE key = ?').run(now(), key);
    pruneVersions(db, key);
    res.json({ ok: true });
  });
  app.post('/api/config/:key/discard', owner, (req, res) => {
    if (!isKey(req.params.key)) return res.status(404).json({ error: 'Unknown setting.' });
    db.prepare('UPDATE config SET draft = published, updated_at = ? WHERE key = ?').run(now(), req.params.key);
    res.json({ ok: true });
  });
  app.post('/api/config/:key/reset', owner, (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: 'Unknown setting.' });
    const def = key === 'world' ? DEFAULT_WORLD : { active: COQUETTE, custom: readConfig('theme').draft.custom ?? [] };
    db.prepare('UPDATE config SET draft = ?, updated_at = ? WHERE key = ?').run(JSON.stringify(def), now(), key);
    res.json({ ok: true, draft: def });
  });
  app.get('/api/config/:key/versions', owner, (req, res) => {
    const rows = db.prepare('SELECT id, label, created_at FROM config_versions WHERE key = ? ORDER BY id DESC').all(req.params.key);
    res.json(rows.map((r: any) => ({ id: r.id, label: r.label, createdAt: r.created_at })));
  });
  app.post('/api/config/:key/checkpoint', owner, express.json(), (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) return res.status(404).json({ error: 'Unknown setting.' });
    db.prepare('INSERT INTO config_versions(key, json, label, created_at) VALUES(?, ?, ?, ?)')
      .run(key, JSON.stringify(readConfig(key).draft), String(req.body?.label || 'Checkpoint').slice(0, 80), now());
    pruneVersions(db, key);
    res.json({ ok: true });
  });
  app.post('/api/config/:key/versions/:id/restore', owner, (req, res) => {
    const row = db.prepare('SELECT json FROM config_versions WHERE id = ? AND key = ?').get(Number(req.params.id), req.params.key) as any;
    if (!row) return res.status(404).json({ error: 'That checkpoint no longer exists.' });
    db.prepare('UPDATE config SET draft = ?, updated_at = ? WHERE key = ?').run(row.json, now(), req.params.key);
    res.json({ ok: true, draft: JSON.parse(row.json) });
  });

  // ───────────── items (all content) ─────────────
  const rowToItem = (r: any): Item => ({
    id: r.id, kind: r.kind, roomId: r.room_id, visibility: r.visibility, data: JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at,
  });
  const visibleRoomIds = () => new Set(publicWorld(readConfig('world').published).rooms.map((r) => r.id));
  /** Visitors only ever receive public items, in public rooms, of kinds that can be public. */
  const publicFilter = (it: Item, allowUnlisted = false, rooms = visibleRoomIds()) =>
    (it.visibility === 'public' || (allowUnlisted && it.visibility === 'unlisted'))
    && !ALWAYS_PRIVATE_KINDS.includes(it.kind)
    && it.kind !== 'media' // the media library is the owner's; visitors only get files used on public pages
    && (it.roomId === null || rooms.has(it.roomId));

  app.get('/api/items', (req, res) => {
    const { kind, roomId } = req.query as Record<string, string | undefined>;
    let sql = 'SELECT * FROM items WHERE 1=1';
    const args: any[] = [];
    if (kind) { sql += ' AND kind = ?'; args.push(kind); }
    if (roomId) { sql += ' AND room_id = ?'; args.push(roomId); }
    sql += ' ORDER BY created_at DESC';
    let items = (db.prepare(sql).all(...args) as any[]).map(rowToItem);
    if (!(req as any).owner) { const rooms = visibleRoomIds(); items = items.filter((i) => publicFilter(i, false, rooms)).map(stripPrivateFields); }
    res.json(items);
  });
  app.get('/api/items/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    const it = row ? rowToItem(row) : null;
    if (!it || (!(req as any).owner && !publicFilter(it, true))) return res.status(404).json({ error: 'Nothing lives here.' });
    res.json((req as any).owner ? it : stripPrivateFields(it));
  });
  app.post('/api/items', owner, express.json({ limit: '1mb' }), (req, res) => {
    const { kind, roomId = null, visibility = 'private', data = {} } = req.body ?? {};
    const err = validateItem(kind, visibility, data, roomId);
    if (err) return res.status(400).json({ error: err });
    const id = newId(); const t = now();
    db.prepare('INSERT INTO items(id, kind, room_id, visibility, data, created_at, updated_at) VALUES(?,?,?,?,?,?,?)')
      .run(id, kind, roomId, ALWAYS_PRIVATE_KINDS.includes(kind) ? 'private' : visibility, JSON.stringify(data), t, t);
    res.status(201).json(rowToItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id)));
  });
  app.patch('/api/items/:id', owner, express.json({ limit: '1mb' }), (req, res) => {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'That item no longer exists.' });
    const it = rowToItem(row);
    const visibility = req.body.visibility ?? it.visibility;
    const roomId = req.body.roomId !== undefined ? req.body.roomId : it.roomId;
    const data = req.body.data ? (req.body.replace ? req.body.data : { ...it.data, ...req.body.data }) : it.data;
    const err = validateItem(it.kind, visibility, data, roomId);
    if (err) return res.status(400).json({ error: err });
    db.prepare('UPDATE items SET visibility = ?, room_id = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(ALWAYS_PRIVATE_KINDS.includes(it.kind) ? 'private' : visibility, roomId, JSON.stringify(data), now(), it.id);
    res.json(rowToItem(db.prepare('SELECT * FROM items WHERE id = ?').get(it.id)));
  });
  app.delete('/api/items/:id', owner, (req, res) => {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id) as any;
    if (row?.kind === 'media') {
      const file = JSON.parse(row.data).file;
      if (file) fs.rm(path.join(uploadsDir, path.basename(file)), { force: true }, () => {});
    }
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/rooms/:roomId/duplicate-items', owner, express.json(), (req, res) => {
    const to = String(req.body?.to ?? '');
    if (!to) return res.status(400).json({ error: 'Missing target room.' });
    const rows = db.prepare('SELECT * FROM items WHERE room_id = ?').all(req.params.roomId) as any[];
    const t = now();
    for (const r of rows) db.prepare('INSERT INTO items(id, kind, room_id, visibility, data, created_at, updated_at) VALUES(?,?,?,?,?,?,?)').run(newId(), r.kind, to, r.visibility, r.data, t, t);
    res.json({ ok: true, copied: rows.length });
  });
  app.delete('/api/rooms/:roomId/items', owner, (req, res) => {
    const r = db.prepare('DELETE FROM items WHERE room_id = ?').run(req.params.roomId);
    res.json({ ok: true, removed: r.changes });
  });

  // Guestbook: visitors may post; entries wait for the owner's approval before anyone sees them.
  app.post('/api/guestbook', express.json({ limit: '20kb' }), (req, res) => {
    const { name, message, website, roomId, stationery } = req.body ?? {};
    if (website) return res.json({ ok: true, pending: true }); // honeypot field — bots fill it, people don't see it
    if (!rateLimit(`guestbook:${ip(req)}`, 3, 10 * 60_000)) return res.status(429).json({ error: 'You have written a lot of letters! Please wait a little.' });
    const world = readConfig('world').published as WorldConfig;
    const room = world.rooms.find((r) => r.id === roomId && r.template === 'postoffice' && r.visibility !== 'private');
    if (!room || room.settings?.guestbookOpen === false) return res.status(400).json({ error: 'The guestbook is closed right now.' });
    const n = String(name ?? '').trim().slice(0, 60); const m = String(message ?? '').trim().slice(0, 1500);
    if (!n || m.length < 2) return res.status(400).json({ error: 'Please write your name and a little message.' });
    if ((m.match(/https?:\/\//g) ?? []).length > 2) return res.status(400).json({ error: 'Too many links in one letter.' });
    const t = now();
    db.prepare('INSERT INTO items(id, kind, room_id, visibility, data, created_at, updated_at) VALUES(?,?,?,?,?,?,?)')
      .run(newId(), 'guestbook', room.id, 'private', JSON.stringify({ name: n, message: m, stationery: String(stationery ?? 'rose').slice(0, 20), approved: false }), t, t);
    res.json({ ok: true, pending: true });
  });

  // ───────────── search ─────────────
  app.get('/api/search', (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    if (q.length < 2) return res.json({ items: [], rooms: [], entries: [] });
    const like = `%${q.replace(/[%_]/g, '')}%`;
    let items = (db.prepare("SELECT * FROM items WHERE kind != 'media' AND lower(data) LIKE ? ORDER BY updated_at DESC LIMIT 200").all(like) as any[]).map(rowToItem);
    const isOwn = (req as any).owner;
    const world = isOwn ? readConfig('world').draft : publicWorld(readConfig('world').published);
    if (!isOwn) { const rooms = visibleRoomIds(); items = items.filter((i) => publicFilter(i, false, rooms)).map(stripPrivateFields); }
    const rooms = world.rooms.filter((r: any) => r.visibility !== 'unlisted' && `${r.name} ${r.subtitle ?? ''}`.toLowerCase().includes(q));
    const entries = isOwn ? db.prepare('SELECT e.*, f.title AS feed_title FROM feed_entries e JOIN feeds f ON f.id = e.feed_id WHERE lower(e.title) LIKE ? OR lower(e.summary) LIKE ? ORDER BY e.published DESC LIMIT 50').all(like, like) : [];
    res.json({ items: items.slice(0, 100), rooms, entries });
  });

  // ───────────── RSS / Atom feeds (owner only) ─────────────
  const feedRow = (r: any) => ({ id: r.id, url: r.url, title: r.title, siteUrl: r.site_url, category: r.category, lastFetched: r.last_fetched, lastError: r.last_error });
  const storeEntries = (feedId: string, entries: Awaited<ReturnType<typeof discoverAndFetch>>['feed']['entries']) => {
    const ins = db.prepare('INSERT OR IGNORE INTO feed_entries(id, feed_id, guid, title, link, published, summary, image) VALUES(?,?,?,?,?,?,?,?)');
    let added = 0;
    for (const e of entries.slice(0, 100)) {
      if (!e.link) continue;
      added += Number(ins.run(newId(), feedId, e.guid.slice(0, 500), e.title.slice(0, 500), e.link, e.published, e.summary, e.image).changes);
    }
    // Keep each feed tidy: newest 200 entries, but never drop saved ones.
    db.prepare(`DELETE FROM feed_entries WHERE feed_id = ? AND saved = 0 AND id NOT IN (
      SELECT id FROM feed_entries WHERE feed_id = ? ORDER BY published DESC LIMIT 200)`).run(feedId, feedId);
    return added;
  };
  const refreshFeed = async (f: any, force = false) => {
    if (!force && f.last_fetched && Date.now() - Date.parse(f.last_fetched) < 15 * 60_000 && !f.last_error) return { id: f.id, skipped: true };
    try {
      const { feed } = await discoverAndFetch(f.url);
      const added = storeEntries(f.id, feed.entries);
      db.prepare('UPDATE feeds SET last_fetched = ?, last_error = NULL, site_url = COALESCE(site_url, ?) WHERE id = ?').run(now(), feed.siteUrl, f.id);
      return { id: f.id, added };
    } catch (e: any) {
      db.prepare('UPDATE feeds SET last_fetched = ?, last_error = ? WHERE id = ?').run(now(), String(e.message ?? e).slice(0, 300), f.id);
      return { id: f.id, error: String(e.message ?? e) };
    }
  };

  app.get('/api/feeds', owner, (_req, res) => {
    const rows = db.prepare(`SELECT f.*, (SELECT COUNT(*) FROM feed_entries e WHERE e.feed_id = f.id AND e.read = 0) AS unread FROM feeds f ORDER BY f.category, f.title`).all() as any[];
    res.json(rows.map((r) => ({ ...feedRow(r), unread: r.unread })));
  });
  app.post('/api/feeds', owner, express.json(), async (req, res) => {
    const { url, category = 'Internet Discoveries', title } = req.body ?? {};
    if (typeof url !== 'string' || url.length > 2000) return res.status(400).json({ error: 'Please paste a feed or website address.' });
    try {
      const { feedUrl, feed } = await discoverAndFetch(url);
      if (db.prepare('SELECT 1 FROM feeds WHERE url = ?').get(feedUrl)) return res.status(409).json({ error: 'You already follow that feed.' });
      const id = newId();
      db.prepare('INSERT INTO feeds(id, url, title, site_url, category, last_fetched) VALUES(?,?,?,?,?,?)')
        .run(id, feedUrl, String(title || feed.title).slice(0, 200), feed.siteUrl, String(category).slice(0, 80), now());
      const added = storeEntries(id, feed.entries);
      res.status(201).json({ ...feedRow(db.prepare('SELECT * FROM feeds WHERE id = ?').get(id)), added });
    } catch (e: any) {
      res.status(422).json({ error: String(e.message ?? e) });
    }
  });
  app.patch('/api/feeds/:id', owner, express.json(), (req, res) => {
    const { title, category } = req.body ?? {};
    if (title) db.prepare('UPDATE feeds SET title = ? WHERE id = ?').run(String(title).slice(0, 200), req.params.id);
    if (category) db.prepare('UPDATE feeds SET category = ? WHERE id = ?').run(String(category).slice(0, 80), req.params.id);
    res.json(feedRow(db.prepare('SELECT * FROM feeds WHERE id = ?').get(req.params.id)));
  });
  app.delete('/api/feeds/:id', owner, (req, res) => {
    db.prepare('DELETE FROM feeds WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/feeds/refresh', owner, express.json(), async (req, res) => {
    const rows = (req.body?.id ? db.prepare('SELECT * FROM feeds WHERE id = ?').all(req.body.id) : db.prepare('SELECT * FROM feeds').all()) as any[];
    const results = [];
    for (let i = 0; i < rows.length; i += 4) results.push(...await Promise.all(rows.slice(i, i + 4).map((f) => refreshFeed(f, !!req.body?.force))));
    res.json({ results, refreshedAt: now() });
  });
  app.get('/api/feed-entries', owner, (req, res) => {
    const { feedId, category, filter, limit } = req.query as Record<string, string>;
    let sql = 'SELECT e.*, f.title AS feed_title, f.category AS category FROM feed_entries e JOIN feeds f ON f.id = e.feed_id WHERE 1=1';
    const args: any[] = [];
    if (feedId) { sql += ' AND e.feed_id = ?'; args.push(feedId); }
    if (category) { sql += ' AND f.category = ?'; args.push(category); }
    if (filter === 'unread') sql += ' AND e.read = 0';
    if (filter === 'saved') sql += ' AND e.saved = 1';
    sql += ' ORDER BY COALESCE(e.published, \'\') DESC LIMIT ?';
    args.push(Math.min(Number(limit) || 100, 300));
    res.json((db.prepare(sql).all(...args) as any[]).map((r) => ({
      id: r.id, feedId: r.feed_id, feedTitle: r.feed_title, category: r.category, title: r.title, link: r.link,
      published: r.published, summary: r.summary, image: r.image, read: !!r.read, saved: !!r.saved,
    })));
  });
  app.patch('/api/feed-entries/:id', owner, express.json(), (req, res) => {
    if (typeof req.body?.read === 'boolean') db.prepare('UPDATE feed_entries SET read = ? WHERE id = ?').run(Number(req.body.read), req.params.id);
    if (typeof req.body?.saved === 'boolean') db.prepare('UPDATE feed_entries SET saved = ? WHERE id = ?').run(Number(req.body.saved), req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/feed-entries/mark-all-read', owner, express.json(), (req, res) => {
    if (req.body?.feedId) db.prepare('UPDATE feed_entries SET read = 1 WHERE feed_id = ?').run(req.body.feedId);
    else db.exec('UPDATE feed_entries SET read = 1');
    res.json({ ok: true });
  });
  app.get('/api/feeds/opml', owner, (_req, res) => {
    const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
    const rows = db.prepare('SELECT * FROM feeds ORDER BY category').all() as any[];
    const cats = [...new Set(rows.map((r) => r.category))];
    const body = cats.map((c) => `    <outline text="${esc(c)}">\n${rows.filter((r) => r.category === c).map((r) => `      <outline type="rss" text="${esc(r.title)}" xmlUrl="${esc(r.url)}"${r.site_url ? ` htmlUrl="${esc(r.site_url)}"` : ''}/>`).join('\n')}\n    </outline>`).join('\n');
    res.setHeader('Content-Type', 'text/x-opml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ribbonmere-feeds.opml"');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>Ribbonmere subscriptions</title></head>\n  <body>\n${body}\n  </body>\n</opml>\n`);
  });
  app.post('/api/feeds/opml', owner, express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
    const xml = String(req.body ?? '');
    let added = 0;
    const re = /<outline\b[^>]*>/gi;
    let category = 'Imported';
    for (const tag of xml.match(re) ?? []) {
      const attr = (n: string) => tag.match(new RegExp(`${n}="([^"]*)"`, 'i'))?.[1]?.replace(/&amp;/g, '&');
      const xmlUrl = attr('xmlUrl');
      if (!xmlUrl) { category = attr('text') || attr('title') || category; continue; }
      if (!/^https?:\/\//.test(xmlUrl) || db.prepare('SELECT 1 FROM feeds WHERE url = ?').get(xmlUrl)) continue;
      db.prepare('INSERT INTO feeds(id, url, title, site_url, category) VALUES(?,?,?,?,?)')
        .run(newId(), xmlUrl, (attr('title') || attr('text') || xmlUrl).slice(0, 200), attr('htmlUrl') ?? null, category.slice(0, 80));
      added++;
    }
    res.json({ ok: true, added });
  });

  // Link previews for bookmarks and the letterbox.
  app.post('/api/unfurl', owner, express.json(), async (req, res) => {
    try { res.json(await unfurl(String(req.body?.url ?? ''))); }
    catch (e: any) { res.status(422).json({ error: String(e.message ?? e) }); }
  });

  // ───────────── media uploads ─────────────
  app.post('/api/media', owner, express.raw({ type: '*/*', limit: '12mb' }), (req, res) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: 'No file arrived.' });
    const type = sniffImage(buf);
    if (!type) return res.status(415).json({ error: 'Please upload a PNG, JPEG, WebP, GIF or SVG image.' });
    if (type === 'svg' && !isSafeSvg(buf.toString('utf8'))) return res.status(415).json({ error: 'That SVG contains scripts or external references, so it cannot be used safely.' });
    const file = `${crypto.randomBytes(16).toString('hex')}.${type}`;
    fs.writeFileSync(path.join(uploadsDir, file), buf);
    const name = String(req.headers['x-filename'] ?? 'image').slice(0, 120);
    const category = String(req.headers['x-category'] ?? 'Uploads').slice(0, 60);
    const t = now(); const id = newId();
    const data = { name: decodeURIComponent(name), file, url: `/uploads/${file}`, type, size: buf.length, category, decoration: req.headers['x-decoration'] === '1' };
    db.prepare('INSERT INTO items(id, kind, room_id, visibility, data, created_at, updated_at) VALUES(?,?,?,?,?,?,?)').run(id, 'media', null, 'public', JSON.stringify(data), t, t);
    res.status(201).json(rowToItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id)));
  });
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  }, express.static(uploadsDir, { index: false, dotfiles: 'deny' }));

  // ───────────── backup / restore ─────────────
  app.get('/api/export', owner, (req, res) => {
    const backup: any = {
      format: 'ribbonmere-backup', version: 1, exportedAt: now(),
      config: Object.fromEntries(CONFIG_KEYS.map((k) => [k, readConfig(k)])),
      items: (db.prepare('SELECT * FROM items').all() as any[]).map(rowToItem),
      feeds: (db.prepare('SELECT * FROM feeds').all() as any[]).map(feedRow),
      savedEntries: db.prepare('SELECT * FROM feed_entries WHERE saved = 1').all(),
    };
    if (req.query.media === '1') {
      backup.media = fs.readdirSync(uploadsDir).map((f) => ({ file: f, base64: fs.readFileSync(path.join(uploadsDir, f)).toString('base64') }));
    }
    res.setHeader('Content-Disposition', `attachment; filename="ribbonmere-backup-${now().slice(0, 10)}.json"`);
    res.json(backup);
  });
  app.post('/api/import', owner, express.json({ limit: '200mb' }), (req, res) => {
    const b = req.body;
    if (b?.format !== 'ribbonmere-backup') return res.status(400).json({ error: 'That file is not a Ribbonmere backup.' });
    const mode = req.query.mode === 'merge' ? 'merge' : 'replace';
    try {
      db.exec('BEGIN');
      // Safety net: keep the current state as a checkpoint before restoring.
      for (const k of CONFIG_KEYS) db.prepare('INSERT INTO config_versions(key, json, label, created_at) VALUES(?,?,?,?)').run(k, JSON.stringify(readConfig(k).draft), 'Before restoring a backup', now());
      if (mode === 'replace') { db.exec('DELETE FROM items; DELETE FROM feed_entries; DELETE FROM feeds;'); }
      for (const k of CONFIG_KEYS) {
        const c = b.config?.[k];
        if (c?.draft && c?.published) db.prepare('UPDATE config SET draft = ?, published = ?, updated_at = ? WHERE key = ?').run(JSON.stringify(c.draft), JSON.stringify(c.published), now(), k);
      }
      const ins = db.prepare('INSERT OR REPLACE INTO items(id, kind, room_id, visibility, data, created_at, updated_at) VALUES(?,?,?,?,?,?,?)');
      for (const it of b.items ?? []) {
        if (!ITEM_KINDS.includes(it.kind) || !VIS.includes(it.visibility)) continue;
        ins.run(String(it.id), it.kind, it.roomId ?? null, ALWAYS_PRIVATE_KINDS.includes(it.kind) ? 'private' : it.visibility, JSON.stringify(it.data ?? {}), it.createdAt ?? now(), it.updatedAt ?? now());
      }
      for (const f of b.feeds ?? []) {
        db.prepare('INSERT OR IGNORE INTO feeds(id, url, title, site_url, category) VALUES(?,?,?,?,?)').run(String(f.id), String(f.url), String(f.title), f.siteUrl ?? null, String(f.category ?? 'Imported'));
      }
      for (const e of b.savedEntries ?? []) {
        db.prepare('INSERT OR IGNORE INTO feed_entries(id, feed_id, guid, title, link, published, summary, image, read, saved) VALUES(?,?,?,?,?,?,?,?,?,1)')
          .run(e.id, e.feed_id, e.guid, e.title, e.link, e.published, e.summary ?? '', e.image ?? null, e.read ?? 1);
      }
      for (const m of b.media ?? []) {
        const file = path.basename(String(m.file));
        if (/^[a-f0-9]{32}\.(png|jpg|gif|webp|svg)$/.test(file)) fs.writeFileSync(path.join(uploadsDir, file), Buffer.from(m.base64, 'base64'));
      }
      db.exec('COMMIT');
      res.json({ ok: true, mode });
    } catch (e: any) {
      db.exec('ROLLBACK');
      res.status(400).json({ error: `The backup could not be restored: ${e.message}` });
    }
  });

  // ───────────── Book Tracker (Google Sheets) ─────────────
  // The handler is shared with the cloud version; the encrypted token lives in the meta table,
  // which is never part of a backup file.
  const google = createGoogleHandler(opts.google ?? googleConfigFromEnv(process.env, opts.dataDir), {
    get: async () => getMeta(db, 'google') ?? null,
    put: async (v) => setMeta(db, 'google', v),
    del: async () => { db.prepare("DELETE FROM meta WHERE key = 'google'").run(); },
  });
  app.all('/api/google/*', express.json({ limit: '2mb' }), async (req, res) => {
    const r = await google({
      method: req.method, route: (req.params as any)[0] ?? '', query: new URLSearchParams(req.originalUrl.split('?')[1] ?? ''), body: req.body,
      origin: `${req.protocol}://${req.get('host')}`, cookies: parseCookies(req.headers.cookie), isOwner: !!(req as any).owner, secure: req.secure,
    });
    for (const [k, v] of Object.entries(r.headers ?? {})) res.setHeader(k, v);
    if (r.cookies?.length) res.setHeader('Set-Cookie', r.cookies);
    res.setHeader('Cache-Control', 'no-store');
    if (r.redirect) return res.redirect(r.status, r.redirect);
    if (r.html) return res.status(r.status).type('html').send(r.html);
    res.status(r.status).json(r.json);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  return { app, db, setupCode };
}

// ───────────── helpers ─────────────

function seedIfEmpty(db: DB) {
  const has = db.prepare("SELECT 1 FROM config WHERE key = 'world'").get();
  if (has) return;
  const t = now();
  db.prepare('INSERT INTO config(key, draft, published, updated_at) VALUES(?,?,?,?)').run('world', JSON.stringify(DEFAULT_WORLD), JSON.stringify(DEFAULT_WORLD), t);
  const theme = JSON.stringify({ active: COQUETTE, custom: [] });
  db.prepare('INSERT INTO config(key, draft, published, updated_at) VALUES(?,?,?,?)').run('theme', theme, theme, t);
  const ins = db.prepare('INSERT INTO items(id, kind, room_id, visibility, data, created_at, updated_at) VALUES(?,?,?,?,?,?,?)');
  SEED_ITEMS.forEach((s, i) => ins.run(newId(), s.kind, s.roomId, s.visibility, JSON.stringify(s.data), new Date(Date.now() - i * 1000).toISOString(), t));
}

function pruneVersions(db: DB, key: string) {
  db.prepare('DELETE FROM config_versions WHERE key = ? AND id NOT IN (SELECT id FROM config_versions WHERE key = ? ORDER BY id DESC LIMIT 40)').run(key, key);
}

