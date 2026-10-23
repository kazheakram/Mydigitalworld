// Turns an existing Ribbonmere SQLite database (the original home-server version) into a backup file
// you can restore into the Cloudflare + Firebase version. It only READS your data folder — nothing
// there is changed.
//
//   npx tsx scripts/export-sqlite.ts                 (uses ./data)
//   npx tsx scripts/export-sqlite.ts /path/to/data   (another data folder)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.argv[2] ?? 'data');
const dbFile = path.join(dataDir, 'world.db');
if (!fs.existsSync(dbFile)) {
  console.error(`\n  ✗ No Ribbonmere database found at ${dbFile}\n    Pass the folder that contains world.db, e.g.  npx tsx scripts/export-sqlite.ts ./data\n`);
  process.exit(1);
}
const db = new DatabaseSync(dbFile, { readOnly: true });
const cfg = (key: string) => {
  const r = db.prepare('SELECT draft, published, updated_at FROM config WHERE key = ?').get(key) as any;
  return r ? { draft: JSON.parse(r.draft), published: JSON.parse(r.published), updatedAt: r.updated_at } : null;
};
const items = (db.prepare('SELECT * FROM items').all() as any[]).map((r) => ({
  id: r.id, kind: r.kind, roomId: r.room_id, visibility: r.visibility, data: JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at,
}));
const feeds = (db.prepare('SELECT * FROM feeds').all() as any[]).map((r) => ({ id: r.id, url: r.url, title: r.title, siteUrl: r.site_url, category: r.category }));
const savedEntries = db.prepare('SELECT * FROM feed_entries WHERE saved = 1').all();
const uploads = path.join(dataDir, 'uploads');
const media = fs.existsSync(uploads)
  ? fs.readdirSync(uploads).filter((f) => /^[a-f0-9]{32}\.(png|jpg|gif|webp|svg)$/.test(f)).map((f) => ({ file: f, base64: fs.readFileSync(path.join(uploads, f)).toString('base64') }))
  : [];
const backup = { format: 'ribbonmere-backup', version: 1, exportedAt: new Date().toISOString(), config: { world: cfg('world'), theme: cfg('theme') }, items, feeds, savedEntries, media };
const out = path.resolve(`ribbonmere-from-sqlite-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(out, JSON.stringify(backup));
console.log(`\n  ♡ Exported ${items.length} items, ${feeds.length} subscriptions, ${savedEntries.length} saved posts and ${media.length} images.`);
console.log(`    Backup file: ${out}`);
console.log('    Restore it in the new site: Atelier → Backups → Restore from a backup.\n');
