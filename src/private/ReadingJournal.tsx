import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item } from '../../shared/types';
import { items as itemsApi } from '../lib/api';
import { useStore } from '../lib/store';
import { useEditor, useItems } from '../rooms/common';
import { Empty, Field, Loading, Modal, Stars } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';

// The Reading Journal: your reading history, told gently. Everything is worked out from the books
// already on your library shelves — nothing new to keep up with. Challenges are optional,
// have no deadlines, and never nag.

export interface BookData { title: string; author?: string; shelf?: string; pages?: number; pagesRead?: number; rating?: number; finishedOn?: string; startedOn?: string; genre?: string; series?: string; seriesNumber?: number; format?: string; review?: string; quotes?: string[]; annotations?: string; color?: string; cover?: string }
export interface ChallengeData { title: string; target: number; unit: 'books' | 'pages' | 'authors' | 'genres'; year: number; note?: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const yearOf = (d?: string) => (d ? Number(d.slice(0, 4)) : NaN);
const monthOf = (d?: string) => (d ? Number(d.slice(5, 7)) - 1 : NaN);
const top = (xs: (string | undefined)[], n = 5) => {
  const m = new Map<string, number>();
  for (const x of xs) if (x?.trim()) m.set(x.trim(), (m.get(x.trim()) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
};

/** Reading statistics for one year (pure, so it is easy to test). */
export function yearStats(books: BookData[], year: number) {
  const done = books.filter((b) => yearOf(b.finishedOn) === year);
  const pages = done.reduce((n, b) => n + (Number(b.pages) || 0), 0);
  const rated = done.filter((b) => b.rating);
  return {
    done, pages,
    byMonth: MONTHS.map((_, i) => done.filter((b) => monthOf(b.finishedOn) === i)),
    authors: top(done.map((b) => b.author)),
    genres: top(done.map((b) => b.genre)),
    avgRating: rated.length ? rated.reduce((n, b) => n + (b.rating ?? 0), 0) / rated.length : 0,
    longest: [...done].sort((a, b) => (Number(b.pages) || 0) - (Number(a.pages) || 0))[0],
    favourite: [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0],
    formats: top(done.map((b) => b.format)),
  };
}
export function challengeProgress(c: ChallengeData, books: BookData[]) {
  const s = yearStats(books, c.year);
  return c.unit === 'books' ? s.done.length : c.unit === 'pages' ? s.pages : c.unit === 'authors' ? new Set(s.done.map((b) => b.author?.trim()).filter(Boolean)).size : new Set(s.done.map((b) => b.genre?.trim()).filter(Boolean)).size;
}

export function ReadingJournalPage() {
  const { world } = useStore();
  const libraries = world.rooms.filter((r) => r.template === 'library');
  const libIds = new Set(libraries.map((r) => r.id));
  const all = useItems<BookData>('book');
  const books = useMemo(() => (all.data ?? []).filter((b) => !b.roomId || libIds.has(b.roomId)), [all.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = books.map((b) => b.data);
  const challenges = useItems<ChallengeData>('challenge');
  const ed = useEditor('book', libraries[0]?.id ?? null, all.reload, { shelves: libraries[0]?.settings?.shelves });
  const years = [...new Set([new Date().getFullYear(), ...data.map((b) => yearOf(b.finishedOn)).filter((y) => !isNaN(y))])].sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const [tab, setTab] = useState<'year' | 'month' | 'history' | 'series' | 'reviews'>('year');
  const [month, setMonth] = useState(new Date().getMonth());
  const [newChallenge, setNewChallenge] = useState(false);
  const s = yearStats(data, year);
  const maxMonth = Math.max(1, ...s.byMonth.map((m) => m.length));
  const reading = books.filter((b) => /current|reading/i.test(b.data.shelf ?? ''));
  const series = useMemo(() => {
    const m = new Map<string, Item<BookData>[]>();
    for (const b of books) if (b.data.series?.trim()) m.set(b.data.series.trim(), [...(m.get(b.data.series.trim()) ?? []), b]);
    return [...m.entries()].map(([name, l]) => [name, l.sort((a, b) => (a.data.seriesNumber ?? 99) - (b.data.seriesNumber ?? 99))] as const).sort((a, b) => a[0].localeCompare(b[0]));
  }, [books]);
  const history = [...books].filter((b) => b.data.finishedOn).sort((a, b) => b.data.finishedOn!.localeCompare(a.data.finishedOn!));

  if (!all.loading && libraries.length === 0) {
    return <ModeShell mode="private"><SectionTitle title="Reading Journal" /><Empty title="No library yet" art="📚">Add a Library room in <Link to="/atelier/rooms">Atelier → Rooms</Link> and your reading history will gather here.</Empty></ModeShell>;
  }
  return (
    <ModeShell mode="private">
      <SectionTitle title="Reading Journal" sub="history · gentle statistics · wrap-ups" />
      {all.loading && <Loading what="Turning the pages" />}
      <div className="row wrap gap rj-bar">
        <div role="tablist" aria-label="Reading journal pages" className="row wrap gap">
          {([['year', 'The year'], ['month', 'Monthly wrap-up'], ['history', 'History'], ['series', 'Series'], ['reviews', 'Reviews & notes']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <label className="row gap"><span className="smallcaps">year</span>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </label>
        <button className="btn small ghost" onClick={() => ed.add({ shelf: 'Read', finishedOn: new Date().toISOString().slice(0, 10) })}>+ Log a finished book</button>
      </div>

      {tab === 'year' && (
        <div className="rj-grid">
          <section className="lace-card rj-wrap" aria-label={`${year} in books`}>
            <h3 className="script">{year} in books</h3>
            <div className="rj-figures">
              <p><strong>{s.done.length}</strong><span>books finished</span></p>
              <p><strong>{s.pages.toLocaleString()}</strong><span>pages</span></p>
              <p><strong>{s.avgRating ? s.avgRating.toFixed(1) : '–'}</strong><span>average hearts</span></p>
              <p><strong>{s.authors.length}</strong><span>authors</span></p>
            </div>
            <div className="rj-months" role="img" aria-label={`Books finished each month: ${s.byMonth.map((m, i) => `${MONTHS[i]} ${m.length}`).join(', ')}`}>
              {s.byMonth.map((m, i) => (
                <div key={i} className="rj-month"><span className="rj-bar-fill" style={{ height: `${(m.length / maxMonth) * 100}%` }} title={`${m.length}`} />{m.length > 0 && <b>{m.length}</b>}<small>{MONTHS[i][0]}</small></div>
              ))}
            </div>
            {s.favourite && <p className="hand">Most loved: <strong>{s.favourite.title}</strong>{s.favourite.author ? ` by ${s.favourite.author}` : ''}</p>}
            {s.longest?.pages && <p className="muted">Longest: {s.longest.title} ({s.longest.pages} pages)</p>}
          </section>
          <section className="lace-card">
            <h3 className="smallcaps">authors you returned to</h3>
            {s.authors.length ? <ol className="rj-list">{s.authors.map(([a, n]) => <li key={a}>{a} <span className="muted">· {n}</span></li>)}</ol> : <p className="muted">Finish a book to begin.</p>}
            <h3 className="smallcaps">genres</h3>
            {s.genres.length ? <p>{s.genres.map(([g, n]) => <span key={g} className="chip static">{g} · {n}</span>)}</p> : <p className="muted">Add a genre to your books to see a little mix here.</p>}
            {s.formats.length > 0 && <p className="muted">{s.formats.map(([f, n]) => `${f}: ${n}`).join(' · ')}</p>}
          </section>
          <section className="lace-card">
            <h3 className="smallcaps">on the nightstand</h3>
            {reading.length ? <ul className="rj-list">{reading.map((b) => <li key={b.id}><button className="linkish" onClick={() => ed.edit(b)}>{b.data.title}</button> {b.data.pages ? <span className="muted">· {Math.round(((b.data.pagesRead ?? 0) / b.data.pages) * 100)}%</span> : null}</li>)}</ul> : <p className="muted">Nothing in progress — that's fine.</p>}
          </section>
          <section className="lace-card rj-challenges" aria-label="Reading challenges">
            <h3 className="smallcaps">gentle challenges · optional</h3>
            <p className="muted small">No deadlines, no streaks. Reaching one is simply nice; not reaching one means nothing at all.</p>
            {(challenges.data ?? []).filter((c) => c.data.year === year).map((c) => {
              const n = challengeProgress(c.data, data);
              const pct = Math.min(100, Math.round((n / Math.max(1, c.data.target)) * 100));
              return (
                <div key={c.id} className="rj-challenge">
                  <p><strong>{c.data.title}</strong> <span className="muted">{n} of {c.data.target} {c.data.unit}{n >= c.data.target ? ' ✿' : ''}</span></p>
                  <div className="progress"><i style={{ width: `${pct}%` }} /></div>
                  <button className="linkish" onClick={() => itemsApi.remove(c.id).then(challenges.reload)}>let it go</button>
                </div>
              );
            })}
            <button className="btn small ghost" onClick={() => setNewChallenge(true)}>+ A gentle challenge</button>
          </section>
        </div>
      )}

      {tab === 'month' && (
        <section className="lace-card rj-monthly">
          <label className="row gap"><span className="smallcaps">month</span>
            <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">{MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
          </label>
          <h3 className="script">{MONTH_NAMES[month]} {year}</h3>
          {s.byMonth[month].length === 0 ? <p className="muted hand">A quiet month for books. Perhaps it was full of other things.</p> : (
            <>
              <p>{s.byMonth[month].length} book{s.byMonth[month].length > 1 ? 's' : ''} · {s.byMonth[month].reduce((n, b) => n + (Number(b.pages) || 0), 0)} pages</p>
              <ul className="rj-wrapup">
                {s.byMonth[month].map((b, i) => (
                  <li key={i}><span className="mini-spine" style={{ background: b.color ?? 'var(--c-rose)' }} /><strong>{b.title}</strong> {b.author && <span className="muted">{b.author}</span>} {b.rating ? <Stars value={b.rating} /> : null}
                    {b.quotes?.[0] && <blockquote className="hand">“{b.quotes[0]}”</blockquote>}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section className="lace-card">
          {history.length === 0 ? <p className="muted">Books with a “finished on” date appear here, newest first.</p> : (
            <ol className="rj-history">
              {history.map((b) => <li key={b.id}><time>{b.data.finishedOn}</time> <button className="linkish" onClick={() => ed.edit(b)}>{b.data.title}</button> <span className="muted">{b.data.author}{b.data.pages ? ` · ${b.data.pages}p` : ''}{b.data.format ? ` · ${b.data.format}` : ''}</span></li>)}
            </ol>
          )}
        </section>
      )}

      {tab === 'series' && (
        <section className="lace-card">
          {series.length === 0 ? <p className="muted">Give books a series name (in the book's form) and they'll be gathered here in order.</p> : series.map(([name, l]) => (
            <div key={name} className="rj-series">
              <h3 className="script">{name}</h3>
              <ol>{l.map((b) => <li key={b.id} className={b.data.finishedOn || /read$/i.test(b.data.shelf ?? '') ? 'done' : ''}>{b.data.seriesNumber ? `#${b.data.seriesNumber} ` : ''}<button className="linkish" onClick={() => ed.edit(b)}>{b.data.title}</button> <span className="muted">· {b.data.shelf}</span></li>)}</ol>
            </div>
          ))}
        </section>
      )}

      {tab === 'reviews' && (
        <div className="rj-reviews">
          {books.filter((b) => b.data.review || b.data.annotations || b.data.quotes?.length).length === 0 && <Empty title="No reviews yet" art="✒">Write a review, margin notes or favourite quotes in any book's form.</Empty>}
          {books.filter((b) => b.data.review || b.data.annotations || b.data.quotes?.length).map((b) => (
            <article key={b.id} className="lace-card" aria-label={`Notes on ${b.data.title}`}>
              <h3 className="script">{b.data.title}</h3>
              {b.data.rating ? <Stars value={b.data.rating} /> : null}
              {b.data.review && <p>{b.data.review}</p>}
              {b.data.annotations && <p className="hand rj-margin">{b.data.annotations}</p>}
              {b.data.quotes?.map((q, i) => <blockquote key={i} className="hand">“{q}”</blockquote>)}
              <button className="btn small ghost" onClick={() => ed.edit(b)}>Edit</button>
            </article>
          ))}
        </div>
      )}

      <ChallengeModal open={newChallenge} year={year} onClose={() => setNewChallenge(false)} onSaved={() => { setNewChallenge(false); challenges.reload(); }} />
      {ed.modal}
    </ModeShell>
  );
}

function ChallengeModal({ open, year, onClose, onSaved }: { open: boolean; year: number; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(12);
  const [unit, setUnit] = useState<ChallengeData['unit']>('books');
  const save = async () => {
    await itemsApi.create<ChallengeData>('challenge', { title: title.trim() || `${target} ${unit} in ${year}`, target: Math.max(1, target), unit, year });
    setTitle(''); onSaved();
  };
  return (
    <Modal open={open} onClose={onClose} title="A gentle challenge">
      <Field label="Name"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Read more poetry, twelve classics…" /></Field>
      <div className="row wrap gap">
        <Field label="Target"><input className="input" type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></Field>
        <Field label="Counting">
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as ChallengeData['unit'])}>
            <option value="books">books</option><option value="pages">pages</option><option value="authors">different authors</option><option value="genres">different genres</option>
          </select>
        </Field>
      </div>
      <p className="muted small">Counts books finished in {year}. Private, and you can let it go at any time.</p>
      <div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Begin</button></div>
    </Modal>
  );
}
