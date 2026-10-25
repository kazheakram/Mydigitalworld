// The Book Tracker sync engine: reading the owner's sheet layout, mapping columns, and planning
// changes safely (no deletions, no silent overwrites, formulas untouched).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookKey, countSymbols, findHeaderRow, fp, parseDate, parseTime, planAppend, planSync, suggestMapping, verifyMapping,
  type BookLike, type SyncConfig, type SyncPlan,
} from '../../shared/bookSync';
import { SAMPLE, trackerGrid, type FakeBook } from './fixtures/tracker';

const SHELVES = ['Currently Reading', 'Favourites', 'Want to Read', 'Read'];
const NOW = '2026-10-25T12:00:00.000Z';

function configFor(grid = trackerGrid()): SyncConfig {
  const m = suggestMapping(grid, SHELVES);
  assert.equal(m.error, undefined);
  return { spreadsheetId: 'sheet-1', spreadsheetName: 'My book tracker <3', gid: grid.gid, sheetTitle: grid.title, headerRow: m.headerRow, columns: m.columns, roomId: 'library', visibility: 'private' };
}
const col = (c: SyncConfig, header: string) => c.columns.find((x) => x.header === header)!;

/** Applies a plan to an in-memory library the way the Atelier does (creates and updates only). */
function apply(plan: SyncPlan, books: BookLike[], config: SyncConfig): BookLike[] {
  const out = books.map((b) => ({ ...b, data: { ...b.data } }));
  let n = out.length;
  for (const c of plan.creates) out.push({ id: `b${++n}`, roomId: config.roomId, data: { ...c.data, sheetLink: c.link } });
  for (const u of plan.updates) { const b = out.find((x) => x.id === u.bookId)!; Object.assign(b.data, u.patch); }
  for (const w of plan.writes) {
    const b = out.find((x) => x.id === w.bookId)!;
    b.data.sheetLink = { ...b.data.sheetLink, base: { ...b.data.sheetLink.base, [w.field]: fp(w.appValue) } };
  }
  return out;
}
/** Writes planned cells into the grid, as the server would after its checks. */
function writeCells(grid: ReturnType<typeof trackerGrid>, plan: SyncPlan) {
  for (const w of plan.writes) grid.rows[w.row - 1][w.col] = { v: String(w.value), u: w.value };
}

test('dates, times, symbols and keys are read the way the tracker writes them', () => {
  assert.equal(parseDate({ v: '24 Oct 25' }), '2025-10-24');
  assert.equal(parseDate({ v: '1 Sept 25' }), '2025-09-01');
  assert.equal(parseDate({ v: '24 Oct 25', u: 45954 }), '2025-10-24');
  assert.equal(parseDate({ v: 'Oct 24, 2025' }), '2025-10-24');
  assert.equal(parseDate({ v: '2025-02-30' }), null);
  assert.equal(parseDate({ v: 'soon' }), null);
  assert.equal(parseTime('11:27:00'), '11:27:00');
  assert.equal(parseTime('4:10'), '4:10:00');
  assert.equal(parseTime('1h 20m'), '1:20:00');
  assert.equal(countSymbols('⭐⭐⭐⭐'), 4);
  assert.equal(countSymbols('🌶️🌶️🌶️'), 3);
  assert.equal(countSymbols('★★★☆☆'), 3);
  assert.equal(countSymbols('4'), 4);
  assert.equal(countSymbols(''), null);
  assert.equal(bookKey('The Glass Orchard!', 'Mira  Hale'), bookKey('glass orchard', 'mira hale'));
});

test('the header row is found below the banners and columns are suggested, formulas marked', () => {
  const grid = trackerGrid();
  assert.equal(findHeaderRow(grid), 2);
  const c = configFor(grid);
  assert.equal(col(c, 'BOOK TITLE').field, 'title');
  assert.equal(col(c, 'STATUS').field, 'shelf');
  assert.deepEqual(col(c, 'STATUS').values, { Finished: 'Read', Started: 'Currently Reading' });
  assert.deepEqual(col(c, 'FORMAT').values, { 'Kindle 💻': 'E-book', 'Book 📚': 'Paper', 'Audiobook 🎧': 'Audiobook' });
  assert.equal(col(c, 'STARTING DATE').field, 'startedOn');
  assert.equal(col(c, 'STAR RATING').field, 'rating');
  assert.equal(col(c, 'SPICE').field, 'spice');
  assert.equal(col(c, 'CURRENT PAGE / CURRENT TIME').field, 'progress');
  assert.equal(col(c, 'TOTAL PAGE / TOTAL TIME').field, 'length');
  assert.equal(col(c, 'PART NUMBER').field, 'seriesPart');
  assert.equal(col(c, 'SERIES NAME').field, 'series');
  assert.equal(col(c, 'FAVORITE').field, 'favorite');
  assert.equal(col(c, 'FAVORITE QUOTE').field, 'quotes');
  assert.equal(col(c, 'FAVORITE MOMENT').field, 'favoriteMoment');
  assert.equal(col(c, 'FAVORITE CHARACTER').field, 'favoriteCharacter');
  assert.equal(col(c, 'NOTES').field, 'annotations');
  // Calculated and sheet-only columns.
  for (const h of ['NO.', 'PAGES / TIME LEFT', 'PROGRESS']) { assert.equal(col(c, h).field, null); assert.equal(col(c, h).direction, 'ignore'); }
  assert.equal(col(c, 'NO.').formula, true);
  assert.equal(col(c, 'PROGRESS').formula, true);
  assert.equal(col(c, 'COVER').direction, 'import');
  assert.equal(col(c, 'PRICE').direction, 'ignore');
  assert.ok(verifyMapping(c, grid).ok);
});

test('first import: every book is planned once, values converted, nothing written to the sheet', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const plan = planSync({ config: c, grid, books: [], twoWay: false, now: NOW, shelves: SHELVES });
  assert.equal(plan.error, undefined);
  assert.equal(plan.sheetBooks, SAMPLE.length);
  assert.equal(plan.creates.length, SAMPLE.length);
  assert.equal(plan.writes.length + plan.clears.length, 0);
  const glass = plan.creates.find((x) => x.title === 'The Glass Orchard')!.data;
  assert.deepEqual({ ...glass }, {
    title: 'The Glass Orchard', author: 'Mira Hale', genre: 'Romantasy', shelf: 'Read', startedOn: '2025-10-03', finishedOn: '2025-10-24',
    format: 'E-book', pagesRead: 412, pages: 412, seriesNumber: 2, seriesTotal: 6, series: 'Orchard Court', rating: 5, spice: 2,
    review: 'Devoured it.', quotes: ['Every root remembers the rain.'], cover: 'https://covers.example/glass.jpg',
  });
  const hymns = plan.creates.find((x) => x.title === 'Hollow Crown Hymns')!.data;
  assert.equal(hymns.shelf, 'Currently Reading');
  assert.equal(hymns.audioListened, '4:10:00');
  assert.equal(hymns.audioLength, '11:27:00');
  assert.equal(hymns.format, 'Audiobook');
  assert.equal(plan.creates.find((x) => x.title === 'A Study in Quiet')!.data.favorite, true);
  assert.equal(plan.creates[0].link.row, 4); // first book sits on sheet row 4
  // Price stays in the sheet only.
  assert.ok(plan.creates.every((x) => !('price' in x.data)));
});

test('a second sync with nothing changed plans nothing at all', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  const again = planSync({ config: c, grid, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(again.creates.length + again.updates.length + again.writes.length + again.conflicts.length + again.missing.length, 0);
  assert.equal(again.unchanged, SAMPLE.length);
});

test('sheet edits flow in; Ribbonmere edits flow out only in two-way, to the right cell, with guards', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  let books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  // In the sheet: a new review. In Ribbonmere: a new rating on another book.
  grid.rows[4][col(c, 'BRIEF REVIEW').col] = { v: 'Even better the second time.' };
  const quiet = books.find((b) => b.data.title === 'A Study in Quiet')!;
  quiet.data.rating = 5;
  const ro = planSync({ config: c, grid, books, twoWay: false, now: NOW, shelves: SHELVES });
  assert.equal(ro.updates.length, 1);
  assert.deepEqual(ro.updates[0].changes.map((x) => [x.field, x.to]), [['review', 'Even better the second time.']]);
  assert.equal(ro.writes.length, 0, 'read-only never writes');
  const tw = planSync({ config: c, grid, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(tw.writes.length, 1);
  const w = tw.writes[0];
  assert.equal(w.field, 'rating');
  assert.equal(w.value, '⭐⭐⭐⭐⭐', 'written in the sheet\'s own style');
  assert.equal(w.row, 7);
  assert.equal(w.col, col(c, 'STAR RATING').col);
  assert.equal(w.expect, '⭐⭐⭐');
  assert.deepEqual(w.guard, { col: col(c, 'BOOK TITLE').col, expect: 'A Study in Quiet' });
  books = apply(tw, books, c); writeCells(grid, tw);
  const settled = planSync({ config: c, grid, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(settled.writes.length + settled.updates.length + settled.conflicts.length, 0);
});

test('a book edited in both places becomes a conflict, never an overwrite', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  grid.rows[3][col(c, 'BRIEF REVIEW').col] = { v: 'Sheet words.' };
  books.find((b) => b.data.title === 'The Glass Orchard')!.data.review = 'Ribbonmere words.';
  const plan = planSync({ config: c, grid, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(plan.conflicts.length, 1);
  assert.deepEqual([plan.conflicts[0].sheet, plan.conflicts[0].app, plan.conflicts[0].reason], ['Sheet words.', 'Ribbonmere words.', 'both']);
  assert.equal(plan.writes.length, 0);
  assert.ok(plan.updates.every((u) => !('review' in u.patch)));
});

test('blanking is never automatic in either direction', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  grid.rows[3][col(c, 'BRIEF REVIEW').col] = { v: '' };
  books.find((b) => b.data.title === 'Lanterns at Low Tide')!.data.review = '';
  const plan = planSync({ config: c, grid, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].reason, 'sheetCleared');
  assert.equal(plan.conflicts[0].app, 'Devoured it.');
  assert.equal(plan.writes.length, 0);
  assert.equal(plan.clears.length, 1, 'emptying a filled cell waits for a yes');
  assert.equal(plan.clears[0].expect, 'Soft and salty.');
});

test('missing rows and a much shorter sheet never delete anything', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  const fewer = trackerGrid(SAMPLE.filter((b) => b.title !== 'Paper Swans'));
  const one = planSync({ config: c, grid: fewer, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.deepEqual(one.missing.map((m) => m.title), ['Paper Swans']);
  assert.equal(one.error, undefined);
  // Most rows gone at once (a filter, the wrong tab, a half-loaded read): stop and change nothing.
  const tiny = trackerGrid(SAMPLE.slice(0, 2));
  const stop = planSync({ config: c, grid: tiny, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.match(stop.error!, /Nothing was changed/);
  assert.equal(stop.creates.length + stop.updates.length + stop.writes.length, 0);
  const forced = planSync({ config: c, grid: tiny, books, twoWay: true, now: NOW, shelves: SHELVES, force: true });
  assert.equal(forced.missing.length, 4);
  // A plan has no way to express deleting a book or a row.
  assert.ok(!('deletes' in forced));
});

test('a changed header row stops the sync instead of writing into the wrong column', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const shifted = trackerGrid();
  for (const r of shifted.rows) r.splice(2, 0, { v: '' }); // someone inserted a column
  const plan = planSync({ config: c, grid: shifted, books: [], twoWay: true, now: NOW, shelves: SHELVES });
  assert.match(plan.error!, /columns have changed/);
});

test('sorting the sheet moves rows but keeps every link; renames on the same row are followed', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  const sorted = trackerGrid([...SAMPLE].reverse());
  const plan = planSync({ config: c, grid: sorted, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(plan.creates.length + plan.missing.length + plan.conflicts.length + plan.writes.length, 0);
  assert.equal(plan.updates.length, SAMPLE.length - (SAMPLE.length % 2)); // every row except the middle moved
  const renamed = trackerGrid(SAMPLE.map((b) => (b.title === 'Paper Swans' ? { ...b, title: 'Paper Swans (Anniversary Edition)' } : b)));
  const r = planSync({ config: c, grid: renamed, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(r.creates.length, 0);
  assert.equal(r.missing.length, 0);
  assert.equal(r.updates.length, 1);
  assert.equal(r.updates[0].patch.title, 'Paper Swans (Anniversary Edition)');
});

test('books already in the Library are linked, not duplicated; differences become questions', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const existing: BookLike[] = [
    { id: 'old1', roomId: 'library', data: { title: 'the glass orchard', author: 'Mira Hale', review: 'My own words', secretMessage: 'hi' } },
    { id: 'old2', roomId: 'library', data: { title: 'Not In The Sheet', author: 'Someone' } },
    { id: 'old3', roomId: 'bookstore', data: { title: 'Paper Swans', author: 'Ines Morrow' } },
  ];
  const plan = planSync({ config: c, grid, books: existing, twoWay: false, now: NOW, shelves: SHELVES });
  assert.equal(plan.creates.length, SAMPLE.length - 1, 'the Glass Orchard is linked instead of created');
  const up = plan.updates.find((u) => u.bookId === 'old1')!;
  assert.equal(up.patch.author, undefined);
  assert.equal(up.patch.genre, 'Romantasy', 'gaps are filled');
  assert.ok(!('secretMessage' in up.patch), 'Ribbonmere-only fields are never touched');
  assert.deepEqual(plan.conflicts.map((x) => [x.bookId, x.field, x.reason]), [['old1', 'review', 'first']]);
  assert.deepEqual(plan.appOnly, [{ bookId: 'old2', title: 'Not In The Sheet' }]);
  assert.ok(plan.creates.some((x) => x.title === 'Paper Swans'), 'a Bookshop book is a different shelf entirely');
});

test('duplicate rows are reported and skipped rows stay skipped', () => {
  const dupes: FakeBook[] = [...SAMPLE, { ...SAMPLE[1], status: 'Started' }];
  const grid = trackerGrid(dupes);
  const c = configFor(grid);
  const plan = planSync({ config: c, grid, books: [], twoWay: false, now: NOW, shelves: SHELVES });
  assert.deepEqual(plan.duplicates.map((d) => d.rows), [[5, 10]]);
  assert.equal(plan.creates.find((x) => x.row === 10)!.duplicateOf, 5);
  const skipped = planSync({ config: { ...c, skipKeys: [plan.creates.find((x) => x.row === 10)!.key] }, grid, books: [], twoWay: false, now: NOW, shelves: SHELVES });
  assert.equal(skipped.creates.length, SAMPLE.length);
});

test('formula and cover columns are never written; unknown choices stay in Ribbonmere', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const books = apply(planSync({ config: c, grid, books: [], twoWay: true, now: NOW, shelves: SHELVES }), [], c);
  const b = books.find((x) => x.data.title === 'Paper Swans')!;
  b.data.cover = 'https://elsewhere.example/new.jpg';
  b.data.shelf = 'Favourites'; // a decorative shelf with no status in the sheet
  const plan = planSync({ config: c, grid, books, twoWay: true, now: NOW, shelves: SHELVES });
  assert.equal(plan.writes.length, 0);
  assert.ok(plan.warnings.some((w) => /Favourites/.test(w)));
  verifyMapping({ ...c, columns: c.columns.map((x) => (x.header === 'PROGRESS' ? { ...x, field: 'review', direction: 'sync' } : x)) }, grid).problems.forEach((p) => assert.match(p, /formula|more than one/));
});

test('new Ribbonmere books go only into truly empty rows, leaving formulas in place', () => {
  const grid = trackerGrid();
  const c = configFor(grid);
  const book: BookLike = { id: 'new1', roomId: 'library', data: { title: 'Moth Letters', author: 'Ada Wren', shelf: 'Want to Read', rating: 0, format: 'Paper' } };
  const plan = planAppend(c, grid, [book]);
  assert.equal(plan.error, undefined);
  assert.ok(plan.writes.every((w) => w.row === SAMPLE.length + 4 && w.guard.expect === ''));
  assert.deepEqual(plan.writes.map((w) => [w.field, w.value]).sort(), [['author', 'Ada Wren'], ['format', 'Book 📚'], ['title', 'Moth Letters']].sort());
  assert.ok(!plan.writes.some((w) => col(c, 'NO.').col === w.col || col(c, 'PROGRESS').col === w.col));
  const full = planAppend(c, trackerGrid(SAMPLE, 0), [book]);
  assert.match(full.error!, /empty row/);
});
