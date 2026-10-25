import type { SheetCell, SheetGrid } from '../../../shared/bookSync';

// A small grid shaped like the owner's "Tracker" tab (headers, banner rows above them, formula
// columns, =IMAGE covers, emoji ratings, "24 Oct 25" dates, audiobook times, "2/6" part numbers).
// The books are made up — only the layout follows the real sheet.

export const TRACKER_HEADERS = [
  'NO.', 'BOOK TITLE', 'COVER', 'AUTHOR', 'GENRE', 'STATUS', 'STARTING DATE', 'FINISH DATE', 'FORMAT',
  'CURRENT PAGE / CURRENT TIME', 'TOTAL PAGE / TOTAL TIME', 'PAGES / TIME LEFT', 'PART NUMBER', 'SERIES NAME',
  'PRICE', 'FAVORITE', 'STAR RATING', 'SPICE', 'PROGRESS', 'BRIEF REVIEW', 'FAVORITE QUOTE', 'FAVORITE MOMENT',
  'BOOK SUMMARY', 'FAVORITE CHARACTER', 'NOTES',
];

export interface FakeBook {
  title: string; author: string; genre?: string; status?: string; start?: [string, number]; finish?: [string, number];
  format?: string; current?: string | number; total?: string | number; part?: string; series?: string; price?: string;
  favorite?: boolean; stars?: number; spice?: number; review?: string; quote?: string; moment?: string; summary?: string;
  character?: string; notes?: string; cover?: string;
}

const t = (v: string | number | undefined): SheetCell => (v === undefined || v === '' ? { v: '' } : { v: String(v), u: v });
const f = (formula: string, shown: string): SheetCell => ({ v: shown, f: formula, u: shown });

export function bookRow(n: number, b: FakeBook): SheetCell[] {
  const row = n + 3; // 1-based sheet row
  return [
    f(`=ROW()-3`, String(n)),
    t(b.title),
    b.cover ? { v: '', f: `=IMAGE("${b.cover}")`, u: '' } : { v: '' },
    t(b.author), t(b.genre), t(b.status),
    b.start ? { v: b.start[0], u: b.start[1] } : { v: '' },
    b.finish ? { v: b.finish[0], u: b.finish[1] } : { v: '' },
    t(b.format), t(b.current), t(b.total),
    f(`=K${row}-J${row}`, b.total !== undefined ? '0' : ''),
    t(b.part), t(b.series), t(b.price),
    b.favorite === undefined ? { v: 'FALSE', u: false } : { v: b.favorite ? 'TRUE' : 'FALSE', u: b.favorite },
    t(b.stars ? '⭐'.repeat(b.stars) : ''), t(b.spice ? '🌶️'.repeat(b.spice) : ''),
    f(`=IFERROR(J${row}/K${row},"")`, b.total !== undefined ? '100%' : ''),
    t(b.review), t(b.quote), t(b.moment), t(b.summary), t(b.character), t(b.notes),
  ];
}

export const SAMPLE: FakeBook[] = [
  { title: 'The Glass Orchard', author: 'Mira Hale', genre: 'Romantasy', status: 'Finished', start: ['3 Oct 25', 45933], finish: ['24 Oct 25', 45954], format: 'Kindle 💻', current: 412, total: 412, part: '2/6', series: 'Orchard Court', price: '£4.99', stars: 5, spice: 2, review: 'Devoured it.', quote: 'Every root remembers the rain.', cover: 'https://covers.example/glass.jpg' },
  { title: 'Lanterns at Low Tide', author: 'Odile Varga', genre: 'Romance', status: 'Finished', start: ['1 Sept 25', 45901], finish: ['9 Sept 25', 45909], format: 'Book 📚', current: 320, total: 320, stars: 4, spice: 1, review: 'Soft and salty.' },
  { title: 'Hollow Crown Hymns', author: 'Juniper Ashe', genre: 'Fantasy', status: 'Started', start: ['20 Oct 25', 45950], format: 'Audiobook 🎧', current: '4:10:00', total: '11:27:00', series: 'Hymns', part: '1/3', stars: 0 },
  { title: 'A Study in Quiet', author: 'Rosalind Pike', genre: 'Classic', status: 'Finished', finish: ['2 Aug 25', 45871], format: 'Book 📚', current: 280, total: 280, stars: 3, favorite: true },
  { title: 'Paper Swans', author: 'Ines Morrow', genre: 'Romance', status: 'Finished', format: 'Kindle 💻', current: 290, total: 290, stars: 4, spice: 3 },
  { title: 'The Last Lighthouse', author: 'Tom Easterly', genre: 'Thriller', status: 'Finished', format: 'Kindle 💻', current: 350, total: 350, stars: 4 },
];

export function trackerGrid(books: FakeBook[] = SAMPLE, blankRows = 5): SheetGrid {
  const width = TRACKER_HEADERS.length;
  const pad = (cells: SheetCell[]) => [...cells, ...Array.from({ length: width - cells.length }, () => ({ v: '' }))];
  const rows: SheetCell[][] = [
    pad([{ v: 'TODAY IS' }, { v: '25 Oct 26', f: '=TODAY()', u: 46320 }]),
    pad([{ v: '' }, { v: 'BOOK DETAILS' }, ...Array(17).fill({ v: '' }), { v: 'YOUR REVIEW' }]),
    TRACKER_HEADERS.map((h) => ({ v: h, u: h })),
    ...books.map((b, i) => bookRow(i + 1, b)),
  ];
  // Pre-made empty rows with their formulas in place, like a real tracker template.
  for (let i = 0; i < blankRows; i++) {
    const n = books.length + i + 1; const row = n + 3;
    rows.push(pad([f('=ROW()-3', String(n)), { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, f(`=K${row}-J${row}`, ''), { v: '' }, { v: '' }, { v: '' }, { v: 'FALSE', u: false }, { v: '' }, { v: '' }, f(`=IFERROR(J${row}/K${row},"")`, '')]));
  }
  return { title: 'Tracker', gid: 1234, rows };
}
