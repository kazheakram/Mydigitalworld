import type { Item, WorldConfig } from '../../shared/types';
import {
  FIELD_BY_ID, bookKey, fp, planAppend, planSync, toBook,
  type CellWrite, type Conflict, type SheetGrid, type SheetLink, type SyncConfig, type SyncPlan,
} from '../../shared/bookSync';
import { api, items } from './api';

// The browser half of the Book Tracker: asks the server for the sheet, plans with the shared engine,
// then changes the Library through the ordinary item API (so imported books are ordinary books).
// The sheet is only ever written cell-by-cell through the guarded /api/google/write route.

export interface GoogleStatus {
  configured: boolean; pickerReady: boolean; connected: boolean; connectedAt: string | null;
  sheet: { id: string; name: string } | null; allowWrites: boolean;
  backup: { id: string; name: string; at: string; url?: string } | null; redirectUri: string;
}
export interface Tab { gid: number; title: string; rows: number; cols: number }

export interface TrackerState {
  config?: SyncConfig;
  /** Two-way is only possible after a clean first import (the mapping is then "verified"). */
  twoWay: boolean;
  schedule: 'auto' | 'manual';
  verified: boolean;
  firstImportAt?: string;
  ribbonmereBackupAt?: string;
  lastSync?: { at: string; summary: string };
  lastError?: { at: string; message: string };
  conflicts: Conflict[];
  clears: CellWrite[];
  missing: SyncPlan['missing'];
  appOnly: SyncPlan['appOnly'];
  log: { at: string; text: string }[];
}
const EMPTY: TrackerState = { twoWay: false, schedule: 'auto', verified: false, conflicts: [], clears: [], missing: [], appOnly: [], log: [] };

export const google = {
  status: () => api<GoogleStatus>('GET', '/api/google/status'),
  connect: () => api<{ url: string }>('POST', '/api/google/connect', {}),
  disconnect: () => api<{ ok: boolean; revoked: boolean }>('POST', '/api/google/disconnect', {}),
  pickerToken: () => api<{ accessToken: string; apiKey: string; appId: string }>('POST', '/api/google/picker-token', {}),
  select: (spreadsheet: string) => api<{ id: string; name: string; tabs: Tab[] }>('POST', '/api/google/select', { spreadsheet }),
  tabs: () => api<{ id: string; name: string; tabs: Tab[] }>('POST', '/api/google/tabs', {}),
  read: (gid: number) => api<SheetGrid>('POST', '/api/google/read', { gid }),
  backup: () => api<NonNullable<GoogleStatus['backup']>>('POST', '/api/google/backup', {}),
  allowWrites: (allow: boolean) => api<{ allowWrites: boolean }>('POST', '/api/google/writes', { allow }),
  write: (gid: number, writes: (CellWrite & { clear?: boolean })[]) =>
    api<{ results: { ok: boolean; reason?: string }[] }>('POST', '/api/google/write', { gid, writes: writes.map(({ row, col, value, input, expect, guard, clear }) => ({ row, col, value, input, expect, guard, clear })) }),
};

// ── the private state item ──
let stateId: string | null = null;
export async function loadState(): Promise<TrackerState> {
  const list = await items.list<TrackerState>('sheetsync');
  const it = list[0];
  stateId = it?.id ?? null;
  return { ...EMPTY, ...(it?.data ?? {}) };
}
export async function saveState(patch: Partial<TrackerState>): Promise<TrackerState> {
  const cur = await loadState();
  const next = { ...cur, ...patch, log: (patch.log ?? cur.log).slice(0, 30) };
  if (stateId) await items.update(stateId, { data: next, replace: true });
  else stateId = (await items.create('sheetsync', next, { visibility: 'private' })).id;
  return next;
}
const note = (s: TrackerState, text: string) => [{ at: new Date().toISOString(), text }, ...s.log];

export function shelvesOf(world: WorldConfig, roomId: string): string[] {
  return world.rooms.find((r) => r.id === roomId)?.settings?.shelves ?? ['Currently Reading', 'Read', 'Want to Read'];
}

/** Read the sheet and plan, without changing anything anywhere. */
export async function preview(world: WorldConfig, opts: { force?: boolean; config?: SyncConfig } = {}) {
  const [state, status] = await Promise.all([loadState(), google.status()]);
  const config = opts.config ?? state.config;
  if (!config) throw new Error('Choose the spreadsheet and columns first.');
  const grid = await google.read(config.gid);
  const books = await items.list('book');
  const plan = planSync({ config, grid, books, twoWay: state.twoWay && status.allowWrites, force: opts.force, shelves: shelvesOf(world, config.roomId) });
  return { plan, grid, books, state, status, config };
}

const SPINE = ['#e7a3b4', '#c9a7d8', '#a9c7e3', '#f2c6a0', '#b9d8b0', '#f4b6c2'];

let running: Promise<unknown> | null = null;
/** One sync: preview, then apply. Never deletes a book or a row. */
export async function syncNow(world: WorldConfig, updateWorld: (fn: (w: WorldConfig) => WorldConfig) => Promise<void>, opts: { force?: boolean; first?: boolean } = {}) {
  if (running) return running as Promise<Awaited<ReturnType<typeof doSync>>>;
  running = doSync(world, updateWorld, opts).finally(() => { running = null; });
  return running as Promise<Awaited<ReturnType<typeof doSync>>>;
}

async function doSync(world: WorldConfig, updateWorld: (fn: (w: WorldConfig) => WorldConfig) => Promise<void>, opts: { force?: boolean; first?: boolean }) {
  let state = await loadState();
  try {
    const { plan, books, status, config } = await preview(world, opts);
    if (plan.error) throw new Error(plan.error);
    if (!state.firstImportAt && !opts.first) throw new Error('Preview and confirm the first import before syncing.');
    if (plan.newShelves.length) {
      await updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === config.roomId ? { ...r, settings: { ...r.settings, shelves: [...shelvesOf(w, r.id), ...plan.newShelves.filter((s) => !shelvesOf(w, r.id).includes(s))] } } : r)) }));
    }
    const room = world.rooms.find((r) => r.id === config.roomId);
    let order = books.filter((b) => b.roomId === config.roomId).length;
    for (const c of plan.creates) {
      await items.create('book', { color: SPINE[order % SPINE.length], order: order++, ...c.data, sheetLink: c.link }, { roomId: config.roomId, visibility: room?.visibility === 'private' ? 'private' : config.visibility });
    }
    const links = new Map<string, SheetLink>();
    for (const u of plan.updates) {
      await items.update(u.bookId, { data: u.patch });
      links.set(u.bookId, u.patch.sheetLink);
    }
    let written = 0; const refused: string[] = [];
    if (plan.writes.length && state.twoWay && status.allowWrites) {
      for (let i = 0; i < plan.writes.length; i += 200) {
        const batch = plan.writes.slice(i, i + 200);
        const { results } = await google.write(config.gid, batch);
        for (const [j, r] of results.entries()) {
          const w = batch[j];
          if (!r.ok) { refused.push(`row ${w.row} ${FIELD_BY_ID.get(w.field)?.label ?? w.field} (${r.reason})`); continue; }
          written++;
          const book = books.find((b) => b.id === w.bookId)!;
          const link: SheetLink = links.get(w.bookId) ?? book.data.sheetLink;
          const next = { ...link, base: { ...link.base, [w.field]: fp(w.appValue) } };
          if (w.field === 'title' || w.field === 'author') next.key = bookKey(book.data.title, book.data.author);
          links.set(w.bookId, next);
        }
      }
      for (const [id, link] of links) await items.update(id, { data: { sheetLink: link } });
    }
    const now = new Date().toISOString();
    for (const m of plan.missing) {
      const b = books.find((x) => x.id === m.bookId)!;
      if (!b.data.sheetLink.missingSince) await items.update(b.id, { data: { sheetLink: { ...b.data.sheetLink, missingSince: now } } });
    }
    const summary = [
      plan.creates.length && `${plan.creates.length} new`, plan.updates.filter((u) => u.changes.length).length && `${plan.updates.filter((u) => u.changes.length).length} updated from the sheet`,
      written && `${written} cell${written > 1 ? 's' : ''} written to the sheet`, plan.conflicts.length && `${plan.conflicts.length} question${plan.conflicts.length > 1 ? 's' : ''} for you`,
      plan.missing.length && `${plan.missing.length} not found in the sheet (kept)`,
    ].filter(Boolean).join(', ') || 'everything already matched';
    state = await saveState({
      ...(opts.first ? { firstImportAt: now } : {}), verified: true,
      lastSync: { at: now, summary }, lastError: undefined,
      conflicts: plan.conflicts, clears: plan.clears, missing: plan.missing, appOnly: plan.appOnly,
      log: note(state, `Synced: ${summary}.${refused.length ? ` Not written because the sheet changed meanwhile: ${refused.join('; ')} — they'll be looked at again next time.` : ''}`),
    });
    return { plan, written, refused, state };
  } catch (e: any) {
    state = await saveState({ lastError: { at: new Date().toISOString(), message: String(e.message ?? e) }, log: note(state, `Sync stopped, nothing more was changed: ${e.message ?? e}`) });
    throw e;
  }
}

/** Answer a conflict: keep the sheet's value or Ribbonmere's. The next sync carries it out. */
export async function resolveConflict(c: Conflict, keep: 'sheet' | 'app') {
  const book = await items.get(c.bookId);
  const def = FIELD_BY_ID.get(c.field)!;
  const link: SheetLink = book.data.sheetLink;
  // Agreeing on the sheet's value as the starting point: "sheet" makes the book match it; "app"
  // leaves the book as it is, so the next two-way sync writes it into the sheet.
  const base = { ...link.base, [c.field]: fp(c.sheet) };
  await items.update(c.bookId, { data: { ...(keep === 'sheet' ? toBook(def, c.sheet) : {}), sheetLink: { ...link, base } } });
  const s = await loadState();
  await saveState({ conflicts: s.conflicts.filter((x) => !(x.bookId === c.bookId && x.field === c.field)), log: note(s, `"${c.title}" ${def.label}: kept ${keep === 'sheet' ? "the sheet's" : "Ribbonmere's"} version.`) });
}

/** Answer an "empty this cell?" question. */
export async function resolveClear(w: CellWrite, gid: number, empty: boolean) {
  const s = await loadState();
  const book = await items.get(w.bookId);
  const link: SheetLink = book.data.sheetLink;
  if (empty) {
    const { results } = await google.write(gid, [{ ...w, clear: true }]);
    if (!results[0]?.ok) throw new Error(`The sheet changed meanwhile (${results[0]?.reason}). Sync again to see the latest.`);
    await items.update(w.bookId, { data: { sheetLink: { ...link, base: { ...link.base, [w.field]: '' } } } });
  } else {
    // Bring the sheet's value back into Ribbonmere on the next sync.
    await items.update(w.bookId, { data: { sheetLink: { ...link, base: { ...link.base, [w.field]: '' } } } });
  }
  await saveState({ clears: s.clears.filter((x) => !(x.bookId === w.bookId && x.field === w.field)), log: note(s, `"${book.data.title}": ${empty ? 'emptied the cell in the sheet' : 'kept the sheet\'s value'} (${FIELD_BY_ID.get(w.field)?.label}).`) });
}

/** A book whose row is gone: stop linking it (the book stays in the Library). */
export async function unlinkBook(bookId: string) {
  const book = await items.get(bookId);
  const data = { ...book.data }; delete data.sheetLink;
  await items.update(bookId, { data, replace: true });
  const s = await loadState();
  await saveState({ missing: s.missing.filter((m) => m.bookId !== bookId), log: note(s, `"${book.data.title}" is no longer linked to the sheet (still in your Library).`) });
}

/** Two-way: put Library books that aren't in the sheet into its empty rows. */
export async function addToSheet(bookIds: string[]) {
  const s = await loadState();
  if (!s.config) throw new Error('Not set up yet.');
  const grid = await google.read(s.config.gid);
  const books = (await items.list('book')).filter((b: Item) => bookIds.includes(b.id));
  const plan = planAppend(s.config, grid, books);
  if (plan.error) throw new Error(plan.error);
  const { results } = await google.write(s.config.gid, plan.writes);
  const failed = new Set(plan.writes.filter((_, i) => !results[i].ok).map((w) => w.bookId));
  for (const l of plan.links) if (!failed.has(l.bookId)) await items.update(l.bookId, { data: { sheetLink: l.link } });
  await saveState({ appOnly: s.appOnly.filter((a) => !bookIds.includes(a.bookId) || failed.has(a.bookId)), log: note(s, `Added ${plan.links.length - failed.size} book(s) to the sheet.${failed.size ? ` ${failed.size} couldn't be added because the sheet changed meanwhile.` : ''}`) });
  return { added: plan.links.length - failed.size, failed: failed.size };
}
