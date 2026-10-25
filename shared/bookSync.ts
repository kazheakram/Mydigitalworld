// Book Tracker sync: the pure logic that compares a Google Sheets book tracker with the Library.
// Nothing here talks to Google or the database — it reads a grid of cells plus the books and
// returns a *plan*. The Atelier shows the plan, and only then is anything changed.
//
// Safety rules, enforced here and again on the server:
//   • a missing row, a shorter sheet or a failed read is never a reason to delete a book;
//   • formula cells and the cover column are never written;
//   • a value is only written to the sheet when the cell still holds what we last saw;
//   • blanking a filled cell is never automatic — it becomes a question for the owner;
//   • a book edited in both places becomes a conflict, never a silent overwrite.

/** One cell as the Sheets API reports it in three renderings. */
export interface SheetCell { v: string; f?: string; u?: string | number | boolean | null }
export interface SheetGrid { title: string; gid: number; rows: SheetCell[][] }

export type Direction = 'sync' | 'import' | 'ignore';
export type SyncFieldId =
  | 'title' | 'author' | 'shelf' | 'rating' | 'spice' | 'startedOn' | 'finishedOn' | 'format'
  | 'progress' | 'length' | 'seriesPart' | 'series' | 'genre' | 'price' | 'favorite' | 'review'
  | 'quotes' | 'favoriteMoment' | 'summary' | 'favoriteCharacter' | 'annotations' | 'privateNotes' | 'cover';

export interface ColumnMap {
  col: number;
  header: string;
  field: SyncFieldId | null;
  direction: Direction;
  /** The column is calculated by a formula: Ribbonmere never writes to it. */
  formula?: boolean;
  /** For choice columns: sheet value → Ribbonmere value (e.g. "Kindle 💻" → "E-book"). */
  values?: Record<string, string>;
}

export interface SyncConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  gid: number;
  sheetTitle: string;
  headerRow: number; // 0-based index into the grid
  columns: ColumnMap[];
  roomId: string;
  visibility: 'private' | 'public';
  /** Rows the owner chose not to import (by book key). */
  skipKeys?: string[];
}

export interface SheetLink {
  sheetId: string;
  gid: number;
  key: string;
  row: number; // 1-based sheet row when last seen
  /** Fingerprint of each field's value at the last agreement between the two sides. */
  base: Record<string, string>;
  at: string;
  missingSince?: string;
}

export interface BookLike { id: string; roomId: string | null; data: Record<string, any> }

// ───────────────────────── fields ─────────────────────────

type Kind = 'text' | 'symbols' | 'date' | 'pagesOrTime' | 'part' | 'bool' | 'choice' | 'lines' | 'image';
interface FieldDef { id: SyncFieldId; label: string; kind: Kind; keys: string[]; writable: boolean }

export const SYNC_FIELDS: FieldDef[] = [
  { id: 'title', label: 'Title', kind: 'text', keys: ['title'], writable: true },
  { id: 'author', label: 'Author', kind: 'text', keys: ['author'], writable: true },
  { id: 'shelf', label: 'Status → shelf', kind: 'choice', keys: ['shelf'], writable: true },
  { id: 'rating', label: 'Hearts (star rating)', kind: 'symbols', keys: ['rating'], writable: true },
  { id: 'spice', label: 'Spice', kind: 'symbols', keys: ['spice'], writable: true },
  { id: 'startedOn', label: 'Started on', kind: 'date', keys: ['startedOn'], writable: true },
  { id: 'finishedOn', label: 'Finished on', kind: 'date', keys: ['finishedOn'], writable: true },
  { id: 'format', label: 'Format', kind: 'choice', keys: ['format'], writable: true },
  { id: 'progress', label: 'Pages read / time listened', kind: 'pagesOrTime', keys: ['pagesRead', 'audioListened'], writable: true },
  { id: 'length', label: 'Total pages / length', kind: 'pagesOrTime', keys: ['pages', 'audioLength'], writable: true },
  { id: 'seriesPart', label: 'Number in series (e.g. 2/6)', kind: 'part', keys: ['seriesNumber', 'seriesTotal'], writable: true },
  { id: 'series', label: 'Series', kind: 'text', keys: ['series'], writable: true },
  { id: 'genre', label: 'Genre', kind: 'text', keys: ['genre'], writable: true },
  { id: 'price', label: 'Price', kind: 'text', keys: ['price'], writable: true },
  { id: 'favorite', label: 'Favourite', kind: 'bool', keys: ['favorite'], writable: true },
  { id: 'review', label: 'Review', kind: 'text', keys: ['review'], writable: true },
  { id: 'quotes', label: 'Favourite quotes', kind: 'lines', keys: ['quotes'], writable: true },
  { id: 'favoriteMoment', label: 'Favourite moment', kind: 'text', keys: ['favoriteMoment'], writable: true },
  { id: 'summary', label: 'Summary', kind: 'text', keys: ['summary'], writable: true },
  { id: 'favoriteCharacter', label: 'Favourite character', kind: 'text', keys: ['favoriteCharacter'], writable: true },
  { id: 'annotations', label: 'Margin notes', kind: 'text', keys: ['annotations'], writable: true },
  { id: 'privateNotes', label: 'Private notes', kind: 'text', keys: ['privateNotes'], writable: true },
  { id: 'cover', label: 'Cover (from =IMAGE)', kind: 'image', keys: ['cover'], writable: false },
];
export const FIELD_BY_ID = new Map(SYNC_FIELDS.map((f) => [f.id, f]));

/** Book fields that never come from or go to the sheet. */
export const RIBBONMERE_ONLY = ['secretMessage', 'order', 'color', 'recommendation', 'wishlist', 'link', 'recommendedBy'];

// ───────────────────────── small helpers ─────────────────────────

const clean = (s: unknown) => (s == null ? '' : String(s)).replace(/\u00a0/g, ' ').trim();
export const norm = (s: unknown) => clean(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/^(the|a|an)\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const headerNorm = (s: string) => clean(s).toLowerCase().replace(/\s+/g, ' ');

/** A book's identity on both sides: title and author, ignoring case, accents and punctuation. */
export const bookKey = (title: unknown, author: unknown) => `${norm(title)}|${norm(author)}`;

/** Short fingerprint of a value (FNV-1a), used for the "last agreed" record. */
export function fp(v: unknown): string {
  const s = canon(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return s === '' ? '' : (h >>> 0).toString(36);
}
/** Canonical text for comparing values: empty, false and [] all mean "nothing". */
export function canon(v: unknown): string {
  if (v == null || v === false) return '';
  if (v === true) return 'true';
  if (Array.isArray(v)) return v.map(clean).filter(Boolean).join('\n');
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '';
  return clean(v);
}
export const same = (a: unknown, b: unknown) => canon(a) === canon(b);

export function colLetter(col: number) {
  let s = ''; let n = col + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
};
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
/** Dates from a sheet: a serial number, "24 Oct 25", "24 October 2025", "Oct 24, 2025" or "2025-10-24". */
export function parseDate(cell: SheetCell): string | null {
  if (typeof cell.u === 'number' && cell.u > 20000 && cell.u < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(cell.u) * 86400000).toISOString().slice(0, 10);
  }
  const s = clean(cell.v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([a-z]{3})[a-z]*\.?[\s\-/.,]+(\d{2,4})$/i.exec(s);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(fullYear(+m[3]), MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/i.exec(s);
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(fullYear(+m[3]), MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return null;
}

/** "11:27:00", "11:27" or "1h 20m" → "11:27:00". */
export function parseTime(s: string): string | null {
  const t = clean(s);
  let m = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) return `${+m[1]}:${m[2]}:${m[3] ?? '00'}`;
  m = /^(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/i.exec(t);
  if (m && (m[1] || m[2])) return `${+(m[1] ?? 0)}:${String(+(m[2] ?? 0)).padStart(2, '0')}:00`;
  return null;
}

const SYMBOL_RE = /\p{Extended_Pictographic}\uFE0F?|[★☆♥♡]/gu;
/** Counts repeated symbols ("⭐⭐⭐⭐" → 4, "🌶️🌶️" → 2) or reads a plain number. */
export function countSymbols(s: string): number | null {
  const t = clean(s);
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const filled = (t.match(SYMBOL_RE) ?? []).filter((c) => !/[☆♡]/.test(c));
  return filled.length ? filled.length + (/½/.test(t) ? 0.5 : 0) : null;
}
/** The symbol a column uses, so written values look like the owner's own. */
function columnSymbol(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) for (const c of clean(v).match(SYMBOL_RE) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const IMAGE_RE = /^=\s*IMAGE\s*\(\s*"(https:\/\/[^"]{1,1500})"/i;
const isFormula = (c: SheetCell | undefined) => !!c?.f && c.f.startsWith('=');
/** Empty, or an unticked checkbox, and not a formula. */
const isBlank = (c: SheetCell | undefined) => !isFormula(c) && (c?.u === false || !clean(c?.v));

// ───────────────────────── reading the sheet ─────────────────────────

/** Finds the header row: the first row (within the top 25) with a "title" column. */
export function findHeaderRow(grid: SheetGrid): number {
  for (let r = 0; r < Math.min(grid.rows.length, 25); r++) {
    if (grid.rows[r]?.some((c) => /(^|\s)(book\s*)?title$/i.test(clean(c.v)))) return r;
  }
  return -1;
}

const SUGGEST: [RegExp, SyncFieldId | null, Direction?][] = [
  [/^(no\.?|#|number|nr\.?)$/, null],
  [/(book )?title$/, 'title'],
  [/cover|image|picture/, 'cover', 'import'],
  [/author|writer/, 'author'],
  [/genre/, 'genre'],
  [/status|shelf/, 'shelf'],
  [/start/, 'startedOn'],
  [/finish|end(ed)? date|date read|completed|date finished/, 'finishedOn'],
  [/format|medium/, 'format'],
  [/left|remaining/, null],
  [/current (page|time)|pages? read|current/, 'progress'],
  [/total (page|time)|^pages?$|length|page count/, 'length'],
  [/part|volume|book #|# in series|number in series|no\. in series/, 'seriesPart'],
  [/series/, 'series'],
  [/price|cost|paid/, 'price', 'ignore'],
  [/quote/, 'quotes'],
  [/moment/, 'favoriteMoment'],
  [/character/, 'favoriteCharacter'],
  [/^favou?rite\??$|^fave$|^fav$/, 'favorite'],
  [/star|rating|score/, 'rating'],
  [/spice|steam|heat/, 'spice'],
  [/progress|percent|%/, null],
  [/review|thoughts/, 'review'],
  [/summary|synopsis|blurb/, 'summary'],
  [/private/, 'privateNotes'],
  [/notes?$/, 'annotations'],
];

const dataRows = (grid: SheetGrid, headerRow: number, titleCol: number) => {
  const out: { r: number; cells: SheetCell[] }[] = [];
  for (let r = headerRow + 1; r < grid.rows.length; r++) {
    const cells = grid.rows[r] ?? [];
    if (clean(cells[titleCol]?.v)) out.push({ r, cells });
  }
  return out;
};

/** First-look mapping for a sheet: matches headers, marks formula columns, guesses value maps. */
export function suggestMapping(grid: SheetGrid, shelves: string[], headerRow = findHeaderRow(grid)): { headerRow: number; columns: ColumnMap[]; error?: string } {
  if (headerRow < 0) return { headerRow, columns: [], error: 'No header row with a "Book title" column was found near the top of this sheet.' };
  const header = grid.rows[headerRow];
  const used = new Set<SyncFieldId>();
  const columns: ColumnMap[] = header.map((c, col) => {
    const h = headerNorm(c.v);
    let field: SyncFieldId | null = null; let direction: Direction = 'ignore';
    if (h) for (const [re, f, dir] of SUGGEST) if (re.test(h)) { field = f && !used.has(f) ? f : null; direction = field ? dir ?? 'sync' : 'ignore'; break; }
    if (field) used.add(field);
    return { col, header: clean(c.v), field, direction };
  });
  const titleCol = columns.find((c) => c.field === 'title')?.col ?? -1;
  if (titleCol < 0) return { headerRow, columns, error: 'No "Book title" column was found.' };
  const rows = dataRows(grid, headerRow, titleCol);
  for (const c of columns) {
    const cells = rows.map((r) => r.cells[c.col]).filter((x) => x && (clean(x.v) || x.f));
    const formulas = cells.filter((x) => isFormula(x) && !IMAGE_RE.test(x.f!)).length;
    if (cells.length && formulas / cells.length >= 0.5) {
      c.formula = true;
      if (c.direction === 'sync') c.direction = 'import';
    }
    if (c.field === 'cover') c.direction = c.direction === 'ignore' ? 'ignore' : 'import';
    if (c.field === 'shelf' || c.field === 'format') c.values = suggestValues(c.field, cells.map((x) => clean(x.v)), shelves);
  }
  return { headerRow, columns };
}

function suggestValues(field: 'shelf' | 'format', values: string[], shelves: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const has = (s: string) => shelves.find((x) => norm(x) === norm(s));
  for (const raw of new Set(values.filter(Boolean))) {
    const v = norm(raw);
    if (field === 'format') {
      out[raw] = /audio|listen/.test(v) ? 'Audiobook' : /kindle|e ?book|digital|kobo|ebook|nook|ipad|phone|pdf|epub/.test(v) ? 'E-book' : 'Paper';
    } else {
      const guess = /finish|read$|^read|done|complete/.test(v) ? 'Read'
        : /start|reading|current|progress/.test(v) ? 'Currently Reading'
          : /want|tbr|to read|not started|wish|planned|unread/.test(v) ? 'Want to Read'
            : /dnf|did not finish|abandon/.test(v) ? 'Did Not Finish' : raw;
      out[raw] = has(guess) ?? has(raw) ?? guess;
    }
  }
  return out;
}

// ───────────────────────── converting values ─────────────────────────

interface ColumnInfo { map: ColumnMap; def: FieldDef; symbol: string | null; booleans: boolean; partText: boolean }

function columnInfo(map: ColumnMap, cells: SheetCell[]): ColumnInfo | null {
  const def = map.field ? FIELD_BY_ID.get(map.field) : undefined;
  if (!def || map.direction === 'ignore') return null;
  const texts = cells.map((c) => clean(c?.v)).filter(Boolean);
  return {
    map, def,
    symbol: def.kind === 'symbols' || def.kind === 'bool' ? columnSymbol(texts) : null,
    booleans: cells.some((c) => typeof c?.u === 'boolean'),
    partText: texts.some((t) => /^\d+\s*\/\s*\d+$/.test(t)),
  };
}

/** Sheet cell → Ribbonmere value (undefined = nothing usable in the cell). */
export function fromSheet(info: ColumnInfo, cell: SheetCell | undefined): any {
  if (!cell) return undefined;
  const t = clean(cell.v);
  switch (info.def.kind) {
    case 'text': return t || undefined;
    case 'lines': return t ? t.split(/\n+/).map(clean).filter(Boolean) : undefined;
    case 'symbols': { const n = countSymbols(t); return n && n > 0 ? n : undefined; }
    case 'date': return parseDate(cell) ?? undefined;
    case 'bool': return typeof cell.u === 'boolean' ? cell.u || undefined : t && !/^(false|no|n|0|-|✗|✘)$/i.test(t) ? true : undefined;
    case 'image': { const m = cell.f ? IMAGE_RE.exec(cell.f) : null; return m?.[1]; }
    case 'choice': return t ? info.map.values?.[t] ?? t : undefined;
    case 'part': {
      const m = /^(\d+(?:\.\d+)?)\s*(?:\/|of)\s*(\d+)$/i.exec(t);
      if (m) return `${+m[1]}/${+m[2]}`;
      return /^\d+(\.\d+)?$/.test(t) ? Number(t) : undefined;
    }
    case 'pagesOrTime': {
      if (t.includes(':') || /\d\s*h/i.test(t)) return parseTime(t) ?? undefined;
      const n = Number(t.replace(/[, ]/g, ''));
      return t && Number.isFinite(n) ? n : undefined;
    }
  }
}

/** Reads a field off a book in the same shape fromSheet produces. */
export function fromBook(def: FieldDef, data: Record<string, any>): any {
  switch (def.kind) {
    case 'pagesOrTime': {
      const [pages, time] = def.keys;
      return data[time] && (data.format === 'Audiobook' || data[pages] == null || data[pages] === '') ? data[time] : data[pages];
    }
    case 'part': {
      const [n, total] = def.keys;
      if (data[n] == null || data[n] === '') return undefined;
      return data[total] ? `${data[n]}/${data[total]}` : Number(data[n]);
    }
    case 'symbols': return Number(data[def.keys[0]]) > 0 ? Number(data[def.keys[0]]) : undefined; // 0 hearts = not rated
    default: return data[def.keys[0]];
  }
}

/** Writes a field onto a book's data (a patch). An empty value clears every key the field uses. */
export function toBook(def: FieldDef, value: any): Record<string, any> {
  if (canon(value) === '') return Object.fromEntries(def.keys.map((k) => [k, def.kind === 'bool' ? false : '']));
  switch (def.kind) {
    case 'pagesOrTime': {
      const [pages, time] = def.keys;
      return typeof value === 'string' ? { [time]: value } : { [pages]: value };
    }
    case 'part': {
      const [n, total] = def.keys;
      if (typeof value === 'string') { const [a, b] = value.split('/'); return { [n]: Number(a), [total]: Number(b) }; }
      return { [n]: value };
    }
    case 'bool': return { [def.keys[0]]: value === true };
    default: return { [def.keys[0]]: value };
  }
}

/** Ribbonmere value → what to type into the sheet. null = this value can't be expressed there. */
export function toSheet(info: ColumnInfo, value: any): { value: string | number | boolean; input: 'RAW' | 'USER_ENTERED' } | null {
  const { def } = info;
  if (!def.writable || info.map.formula) return null;
  const empty = canon(value) === '';
  switch (def.kind) {
    case 'text': return { value: empty ? '' : String(value), input: 'RAW' };
    case 'lines': return { value: empty ? '' : (Array.isArray(value) ? value : [value]).join('\n'), input: 'RAW' };
    case 'symbols': {
      if (empty) return { value: '', input: 'RAW' };
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 0 || n > 10) return null;
      return info.symbol ? { value: info.symbol.repeat(n), input: 'RAW' } : { value: n, input: 'RAW' };
    }
    case 'date': return empty ? { value: '', input: 'RAW' } : /^\d{4}-\d{2}-\d{2}$/.test(value) ? { value, input: 'USER_ENTERED' } : null;
    case 'bool': return info.booleans ? { value: value === true, input: 'RAW' } : { value: value === true ? info.symbol ?? '✓' : '', input: 'RAW' };
    case 'choice': {
      if (empty) return { value: '', input: 'RAW' };
      const sheetValue = Object.entries(info.map.values ?? {}).find(([, v]) => v === value)?.[0];
      return sheetValue !== undefined ? { value: sheetValue, input: 'RAW' } : null;
    }
    case 'part':
      if (empty) return { value: '', input: 'RAW' };
      if (typeof value === 'string') return info.partText ? { value, input: 'RAW' } : { value: Number(value.split('/')[0]), input: 'RAW' };
      return { value: Number(value), input: 'RAW' };
    case 'pagesOrTime':
      if (empty) return { value: '', input: 'RAW' };
      return typeof value === 'string' ? { value, input: 'USER_ENTERED' } : { value: Number(value), input: 'RAW' };
    case 'image': return null;
  }
}

// ───────────────────────── the plan ─────────────────────────

export interface SheetRow { row: number; key: string; title: string; author: string; values: Partial<Record<SyncFieldId, any>> }
export interface CellWrite {
  bookId: string; field: SyncFieldId; row: number; col: number;
  value: string | number | boolean; input: 'RAW' | 'USER_ENTERED';
  /** What the cell held when the plan was made — the server refuses the write if it changed. */
  expect: string;
  /** The title cell must still read this, so a moved row is never written to. */
  guard: { col: number; expect: string };
  /** Ribbonmere's value after the write (becomes the new agreed value). */
  appValue: any;
}
export interface Conflict { bookId: string; title: string; row: number; field: SyncFieldId; label: string; sheet: any; app: any; reason?: 'both' | 'first' | 'sheetCleared' }
export interface FieldChange { field: SyncFieldId; label: string; from: any; to: any }

export interface SyncPlan {
  error?: string;
  headerRow: number;
  sheetBooks: number;
  creates: { row: number; key: string; title: string; data: Record<string, any>; link: SheetLink; duplicateOf?: number }[];
  updates: { bookId: string; title: string; row: number; changes: FieldChange[]; patch: Record<string, any> }[];
  writes: CellWrite[];
  /** Ribbonmere emptied a field the sheet still has: blanking a cell needs the owner's yes. */
  clears: CellWrite[];
  conflicts: Conflict[];
  missing: { bookId: string; title: string; lastRow: number }[];
  duplicates: { key: string; title: string; rows: number[] }[];
  /** Books in the Library room that aren't in the sheet (two-way: can be added on request). */
  appOnly: { bookId: string; title: string }[];
  newShelves: string[];
  warnings: string[];
  unchanged: number;
}

export interface PlanOptions {
  config: SyncConfig;
  grid: SheetGrid;
  books: BookLike[];
  twoWay: boolean;
  now?: string;
  /** Ignore the "sheet suddenly much shorter" safety stop (the owner confirmed it). */
  force?: boolean;
  /** Shelves the target room already has. */
  shelves?: string[];
}

const emptyPlan = (error?: string): SyncPlan => ({ error, headerRow: -1, sheetBooks: 0, creates: [], updates: [], writes: [], clears: [], conflicts: [], missing: [], duplicates: [], appOnly: [], newShelves: [], warnings: [], unchanged: 0 });

export function readRows(config: SyncConfig, grid: SheetGrid): { error: string } | { rows: SheetRow[]; infos: ColumnInfo[] } {
  const header = grid.rows[config.headerRow];
  const titleMap = config.columns.find((c) => c.field === 'title' && c.direction !== 'ignore');
  if (!header || !titleMap) return { error: 'The header row has moved or the title column is not mapped. Nothing was changed — check the sheet, then choose the columns again.' } as const;
  // The header must still say what it said when the mapping was made, or every column could be off by one.
  const moved = config.columns.filter((c) => c.direction !== 'ignore' && norm(header[c.col]?.v) !== norm(c.header));
  if (moved.length) return { error: `The sheet's columns have changed (${moved.map((c) => `"${c.header}"`).join(', ')} moved or renamed). Nothing was changed — review the column choices.` };
  const authorMap = config.columns.find((c) => c.field === 'author' && c.direction !== 'ignore');
  const raw = dataRows(grid, config.headerRow, titleMap.col);
  const infos = config.columns.map((m) => columnInfo(m, raw.map((r) => r.cells[m.col]))).filter(Boolean) as ColumnInfo[];
  const seen = new Map<string, number>();
  const rows: SheetRow[] = raw.map(({ r, cells }) => {
    const title = clean(cells[titleMap.col]?.v);
    const author = authorMap ? clean(cells[authorMap.col]?.v) : '';
    const base = bookKey(title, author);
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    const values: SheetRow['values'] = {};
    for (const info of infos) { const v = fromSheet(info, cells[info.map.col]); if (v !== undefined) values[info.def.id] = v; }
    return { row: r + 1, key: n > 1 ? `${base}#${n}` : base, title, author, values };
  });
  return { rows, infos };
}

export function planSync(o: PlanOptions): SyncPlan {
  const { config, grid } = o;
  const now = o.now ?? new Date().toISOString();
  const read = readRows(config, grid);
  if ('error' in read) return emptyPlan(read.error);
  const { rows, infos } = read;
  const plan = emptyPlan();
  plan.headerRow = config.headerRow;
  plan.sheetBooks = rows.length;
  const titleInfo = infos.find((i) => i.def.id === 'title')!;
  const linked = o.books.filter((b) => b.data.sheetLink?.sheetId === config.spreadsheetId && b.data.sheetLink?.gid === config.gid);

  // Safety stop: a sheet that suddenly lost many books is far more likely a filter, a half-loaded
  // read or the wrong tab than a real clear-out. Nothing is changed unless the owner confirms.
  if (!o.force && linked.length >= 5 && rows.length < linked.length * 0.7) {
    return emptyPlan(`The sheet now shows ${rows.length} books, but ${linked.length} were linked last time. Nothing was changed. If you really removed rows (or a filter is on), check the sheet; to continue anyway, choose "Sync anyway".`);
  }

  // Duplicates inside the sheet (same title and author on several rows).
  const byBase = new Map<string, SheetRow[]>();
  for (const r of rows) { const k = r.key.replace(/#\d+$/, ''); byBase.set(k, [...(byBase.get(k) ?? []), r]); }
  for (const [key, rs] of byBase) if (rs.length > 1) plan.duplicates.push({ key, title: rs[0].title, rows: rs.map((r) => r.row) });

  // Match every sheet row to a book: same key, then a renamed title on the same row with the same author.
  const claimed = new Set<string>();
  const match = new Map<SheetRow, BookLike>();
  const byKey = new Map(linked.map((b) => [b.data.sheetLink.key as string, b]));
  for (const r of rows) {
    const b = byKey.get(r.key);
    if (b && !claimed.has(b.id)) { match.set(r, b); claimed.add(b.id); }
  }
  for (const r of rows) {
    if (match.has(r)) continue;
    const b = linked.find((x) => !claimed.has(x.id) && x.data.sheetLink.row === r.row && norm(x.data.author) === norm(r.author) && norm(r.author) !== '');
    if (b) { match.set(r, b); claimed.add(b.id); plan.warnings.push(`Row ${r.row}: "${b.data.title}" looks renamed to "${r.title}" — treated as the same book.`); }
  }
  // Unlinked Library books with the same title and author are linked, never duplicated.
  const unlinked = o.books.filter((b) => !b.data.sheetLink && b.roomId === config.roomId);
  for (const r of rows) {
    if (match.has(r) || r.key.includes('#')) continue;
    const b = unlinked.find((x) => !claimed.has(x.id) && bookKey(x.data.title, x.data.author) === r.key);
    if (b) { match.set(r, b); claimed.add(b.id); }
  }

  const skip = new Set(config.skipKeys ?? []);
  const shelves = new Set((o.shelves ?? []).map(norm));
  const newShelves = new Set<string>();

  for (const r of rows) {
    const book = match.get(r);
    const titleCell = clean(grid.rows[r.row - 1]?.[titleInfo.map.col]?.v);
    if (!book) {
      if (skip.has(r.key)) continue;
      const data: Record<string, any> = {};
      for (const info of infos) if (r.values[info.def.id] !== undefined) Object.assign(data, toBook(info.def, r.values[info.def.id]));
      if (data.shelf && !shelves.has(norm(data.shelf))) newShelves.add(data.shelf);
      const base = Object.fromEntries(infos.map((i) => [i.def.id, fp(r.values[i.def.id])]));
      const dup = r.key.includes('#') ? byBase.get(r.key.replace(/#\d+$/, ''))?.[0]?.row : undefined;
      plan.creates.push({ row: r.row, key: r.key, title: r.title, data, duplicateOf: dup, link: { sheetId: config.spreadsheetId, gid: config.gid, key: r.key, row: r.row, base, at: now } });
      continue;
    }
    const link: SheetLink | undefined = book.data.sheetLink;
    const base: Record<string, string> = { ...(link?.base ?? {}) };
    const patch: Record<string, any> = {};
    const changes: FieldChange[] = [];
    let touched = false;
    for (const info of infos) {
      const id = info.def.id;
      const sheetV = r.values[id];
      const appV = fromBook(info.def, book.data);
      const known = link && id in (link.base ?? {});
      const sheetChanged = known ? fp(sheetV) !== base[id] : true;
      const appChanged = known ? fp(appV) !== base[id] : true;
      if (same(sheetV, appV)) { if (base[id] !== fp(sheetV)) { base[id] = fp(sheetV); touched = true; } continue; }
      const canWrite = o.twoWay && info.map.direction === 'sync';
      const takeSheet = () => {
        Object.assign(patch, toBook(info.def, sheetV));
        changes.push({ field: id, label: info.def.label, from: appV, to: sheetV });
        base[id] = fp(sheetV); touched = true;
        if (id === 'shelf' && sheetV && !shelves.has(norm(sheetV))) newShelves.add(sheetV);
      };
      if (!known) {
        // First meeting (a book that already existed in Ribbonmere): fill gaps, ask about real differences.
        // Same title or author spelt differently (case, accents): adopt the sheet's spelling.
        if (canon(appV) === '' || ((id === 'title' || id === 'author') && norm(appV) === norm(sheetV))) takeSheet();
        else if (canon(sheetV) === '') { if (canWrite) pushWrite(plan, info, book, r, { col: titleInfo.map.col, text: titleCell }, appV, grid); }
        else plan.conflicts.push({ bookId: book.id, title: r.title, row: r.row, field: id, label: info.def.label, sheet: sheetV, app: appV, reason: 'first' });
        continue;
      }
      // A cell emptied in the sheet never empties Ribbonmere on its own: the owner decides.
      if (sheetChanged && !appChanged && canon(sheetV) === '' && canon(appV) !== '') plan.conflicts.push({ bookId: book.id, title: r.title, row: r.row, field: id, label: info.def.label, sheet: sheetV, app: appV, reason: 'sheetCleared' });
      else if (sheetChanged && !appChanged) takeSheet();
      else if (appChanged && !sheetChanged) { if (canWrite) pushWrite(plan, info, book, r, { col: titleInfo.map.col, text: titleCell }, appV, grid); }
      else plan.conflicts.push({ bookId: book.id, title: r.title, row: r.row, field: id, label: info.def.label, sheet: sheetV, app: appV, reason: 'both' });
    }
    const newLink: SheetLink = { sheetId: config.spreadsheetId, gid: config.gid, key: r.key, row: r.row, base, at: now };
    const linkMoved = !link || link.key !== r.key || link.row !== r.row || link.missingSince;
    if (changes.length || touched || linkMoved) {
      plan.updates.push({ bookId: book.id, title: r.title, row: r.row, changes, patch: { ...patch, sheetLink: newLink } });
    } else plan.unchanged++;
  }

  // Linked books whose row is gone: kept, and only flagged. A missing row never deletes a book.
  for (const b of linked) if (!claimed.has(b.id)) plan.missing.push({ bookId: b.id, title: String(b.data.title ?? ''), lastRow: b.data.sheetLink.row });
  for (const b of unlinked) if (!claimed.has(b.id)) plan.appOnly.push({ bookId: b.id, title: String(b.data.title ?? '') });
  plan.newShelves = [...newShelves];
  return plan;
}

function pushWrite(plan: SyncPlan, info: ColumnInfo, book: BookLike, r: SheetRow, title: { col: number; text: string }, appV: any, grid: SheetGrid) {
  const out = toSheet(info, appV);
  if (!out) { plan.warnings.push(`"${r.title}": ${info.def.label} "${canon(appV)}" has no matching choice in the sheet, so it stays in Ribbonmere only.`); return; }
  const current = clean(grid.rows[r.row - 1]?.[info.map.col]?.v);
  const w: CellWrite = { bookId: book.id, field: info.def.id, row: r.row, col: info.map.col, value: out.value, input: out.input, expect: current, guard: { col: title.col, expect: title.text }, appValue: appV };
  if (out.value === '' && current !== '') plan.clears.push(w);
  else plan.writes.push(w);
}

/** Plans adding Ribbonmere books into empty rows below the last book (two-way, on request). */
export function planAppend(config: SyncConfig, grid: SheetGrid, books: BookLike[]): { writes: CellWrite[]; links: { bookId: string; link: SheetLink }[]; error?: string } {
  const read = readRows(config, grid);
  if ('error' in read) return { writes: [], links: [], error: read.error };
  const titleInfo = read.infos.find((i) => i.def.id === 'title')!;
  const writable = read.infos.filter((i) => i.map.direction === 'sync' && i.def.writable && !i.map.formula);
  const last = read.rows.length ? read.rows[read.rows.length - 1].row - 1 : config.headerRow;
  // Only rows whose every cell we would fill is empty, so nothing of the owner's is ever covered.
  const free: number[] = [];
  for (let r = last + 1; r < grid.rows.length && free.length < books.length; r++) {
    const cells = grid.rows[r] ?? [];
    if (writable.every((i) => isBlank(cells[i.map.col]))) free.push(r);
  }
  if (free.length < books.length) return { writes: [], links: [], error: `The sheet has ${free.length} empty row${free.length === 1 ? '' : 's'} below your books, but ${books.length} ${books.length === 1 ? 'is' : 'are'} needed. Add empty rows at the bottom of the tracker in Google Sheets (so its formulas come along), then try again.` };
  const writes: CellWrite[] = []; const links: { bookId: string; link: SheetLink }[] = [];
  books.forEach((b, i) => {
    const r = free[i] + 1;
    const base: Record<string, string> = {};
    for (const info of writable) {
      const v = fromBook(info.def, b.data);
      const out = canon(v) === '' ? null : toSheet(info, v);
      if (out) writes.push({ bookId: b.id, field: info.def.id, row: r, col: info.map.col, value: out.value, input: out.input, expect: clean(grid.rows[r - 1]?.[info.map.col]?.v), guard: { col: titleInfo.map.col, expect: '' }, appValue: v });
      base[info.def.id] = out ? fp(v) : '';
    }
    links.push({ bookId: b.id, link: { sheetId: config.spreadsheetId, gid: config.gid, key: bookKey(b.data.title, b.data.author), row: r, base, at: new Date().toISOString() } });
  });
  return { writes, links };
}

/** Columns ready for writing: a short report used before two-way can be switched on. */
export function verifyMapping(config: SyncConfig, grid: SheetGrid): { ok: boolean; problems: string[]; writable: string[] } {
  const problems: string[] = [];
  const read = readRows(config, grid);
  if ('error' in read) return { ok: false, problems: [read.error], writable: [] };
  if (!read.rows.length) problems.push('No books were found under the header row.');
  if (!config.columns.some((c) => c.field === 'title' && c.direction !== 'ignore')) problems.push('The title column must be mapped.');
  const fields = config.columns.filter((c) => c.field && c.direction !== 'ignore').map((c) => c.field);
  const twice = fields.filter((f, i) => fields.indexOf(f) !== i);
  if (twice.length) problems.push(`These are mapped to more than one column: ${[...new Set(twice)].join(', ')}.`);
  for (const c of config.columns) {
    if (c.direction === 'sync' && c.formula) problems.push(`"${c.header}" is calculated by a formula, so it can only be imported.`);
    if (c.direction === 'sync' && c.field === 'cover') problems.push('The cover column can only be imported.');
  }
  const writable = read.infos.filter((i) => i.map.direction === 'sync' && i.def.writable && !i.map.formula).map((i) => i.map.header);
  return { ok: problems.length === 0, problems, writable };
}
