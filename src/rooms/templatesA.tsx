import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item, Room } from '../../shared/types';
import { useStore } from '../lib/store';
import { items as itemsApi } from '../lib/api';
import { Prose } from '../lib/markdown';
import { embedUrl, prettyDate } from '../lib/util';
import { Empty, ErrorNote, Loading, Modal, Stars, Tag, VisBadge, Window } from '../ui/kit';
import { OwnerBar, useEditor, useItems } from './common';

type P = { room: Room; itemId?: string };

// ───────────── Welcome Cottage ─────────────
export function WelcomeRoom({ room }: P) {
  const { owner, updateWorld, world } = useStore();
  const guide: string[] = room.settings?.guide ?? [];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(guide.join('\n'));
  const [sig, setSig] = useState(room.settings?.signature ?? '');
  const save = async () => {
    await updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...r.settings, guide: text.split('\n').filter(Boolean), signature: sig } } : r)) }));
    setEditing(false);
  };
  return (
    <div className="welcome-room">
      <div className="paper-sheet letter">
        <p className="script big">Dear visitor,</p>
        <p>You've wandered into <strong>{world.name}</strong> — {world.tagline}. This is my home on the internet: a place for the books I love, the things I write and make, the songs I can't stop playing, and the little corners of the web I want to remember.</p>
        <h3 className="smallcaps">a few things to know</h3>
        {editing ? (
          <>
            <textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Guide lines, one per line" />
            <input className="input" value={sig} onChange={(e) => setSig(e.target.value)} aria-label="Signature" />
            <div className="form-actions"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => setEditing(false)}>Cancel</button></div>
          </>
        ) : (
          <ul className="ribbon-list">{guide.map((g, i) => <li key={i}>{g}</li>)}</ul>
        )}
        <p className="script signature">{room.settings?.signature}</p>
      </div>
      <OwnerBar><button className="btn small" onClick={() => setEditing(true)}>Edit the guide & signature</button><span className="muted">Edit the introduction with “Edit room”.</span></OwnerBar>
      <div className="row wrap gap">
        {world.rooms.filter((r) => r.id !== room.id && r.visibility === 'public').slice(0, 6).map((r, i) => (
          <Link key={r.id} to={`/room/${r.id}`} className="paper-tag link-tag" style={{ ['--tilt' as any]: `${(i % 2 ? 1 : -1) * (2 + i)}deg` }}>
            <span className="hand">visit {r.name} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ───────────── Library ─────────────
interface Book { title: string; author?: string; shelf?: string; cover?: string; color?: string; rating?: number; pagesRead?: number; pages?: number; finishedOn?: string; review?: string; quotes?: string[]; recommendedBy?: string; spice?: number; favorite?: boolean; audioListened?: string; audioLength?: string; series?: string; seriesNumber?: number; seriesTotal?: number; summary?: string; favoriteMoment?: string; favoriteCharacter?: string; link?: string; secretMessage?: string; privateNotes?: string; order?: number }
const SPINE_COLORS = ['#d88f9d', '#e9bcc6', '#a7bccd', '#c9a36a', '#b9c9a8', '#9c5465', '#f4d6c6'];

export function LibraryRoom({ room }: P) {
  const { owner, updateWorld } = useStore();
  const shelves: string[] = room.settings?.shelves ?? ['Currently Reading', 'Read', 'Want to Read'];
  const books = useItems<Book>('book', room.id);
  const ed = useEditor('book', room.id, books.reload, { shelves });
  const [open, setOpen] = useState<Item<Book> | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const year = new Date().getFullYear();
  const list = (books.data ?? []).filter((b) => !filter || `${b.data.title} ${b.data.author}`.toLowerCase().includes(filter.toLowerCase()));
  const byShelf = useMemo(() => {
    const m = new Map<string, Item<Book>[]>(shelves.map((s) => [s, []]));
    for (const b of list) {
      const s = b.data.shelf && m.has(b.data.shelf) ? b.data.shelf : (m.has('Other') ? 'Other' : null);
      if (s) m.get(s)!.push(b); else m.set('Other', [b]);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
    return m;
  }, [list, shelves]);
  const goal = Number(room.settings?.goal ?? 0);
  const readThisYear = (books.data ?? []).filter((b) => (b.data.finishedOn ?? '').startsWith(String(year))).length;
  const quotes = (books.data ?? []).flatMap((b) => (b.data.quotes ?? []).map((q) => ({ q, b })));

  const drop = async (shelf: string, beforeId?: string) => {
    if (!drag) return;
    const target = byShelf.get(shelf) ?? [];
    const ids = target.map((b) => b.id).filter((id) => id !== drag);
    const at = beforeId ? ids.indexOf(beforeId) : ids.length;
    ids.splice(at < 0 ? ids.length : at, 0, drag);
    setDrag(null);
    await Promise.all(ids.map((id, i) => itemsApi.update(id, { data: { order: i, ...(id === drag ? { shelf } : {}) } })));
    books.reload();
  };

  const editShelves = async () => {
    const v = prompt('Shelf names, separated by commas:', shelves.join(', '));
    if (v === null) return;
    const g = prompt('Reading goal for this year (number of books, 0 for none):', String(goal));
    await updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...r.settings, shelves: v.split(',').map((s) => s.trim()).filter(Boolean), goal: Number(g) || 0 } } : r)) }));
  };

  return (
    <div className="library">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ shelf: shelves[0], color: SPINE_COLORS[(books.data?.length ?? 0) % SPINE_COLORS.length] })}>+ Add a book</button>
        <button className="btn small ghost" onClick={editShelves}>Shelves & goal</button>
        <span className="muted">Drag books to rearrange them or move them between shelves.</span>
      </OwnerBar>
      <div className="library-top">
        {goal > 0 && (
          <div className="goal-card lace-card">
            <span className="smallcaps">{year} reading goal</span>
            <p className="script">{readThisYear} of {goal}</p>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={readThisYear}><i style={{ width: `${Math.min(100, (readThisYear / goal) * 100)}%` }} /></div>
          </div>
        )}
        <input className="input search-input" placeholder="Find a book…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter books" />
      </div>
      {books.loading && <Loading what="Dusting the shelves" />}
      {books.error && <ErrorNote msg={books.error} retry={books.reload} />}
      {!books.loading && (books.data?.length ?? 0) === 0 && <Empty title="The shelves are waiting" art="📚">{owner ? 'Add your first book with the button above.' : 'No books on display just yet.'}</Empty>}
      {[...byShelf.entries()].map(([shelf, bs]) => (bs.length > 0 || owner) && (
        <section key={shelf} className="shelf-section" aria-label={shelf}>
          <h2 className="shelf-label smallcaps">{shelf} <span className="muted">· {bs.length}</span></h2>
          <div className="shelf" onDragOver={(e) => owner && e.preventDefault()} onDrop={() => drop(shelf)}>
            {bs.map((b, i) => (
              <button key={b.id} className={`book-spine ${b.data.cover ? 'has-cover' : ''}`}
                draggable={owner} onDragStart={() => setDrag(b.id)} onDragOver={(e) => owner && e.preventDefault()} onDrop={(e) => { e.stopPropagation(); drop(shelf, b.id); }}
                style={{ ['--spine' as any]: b.data.color ?? SPINE_COLORS[i % SPINE_COLORS.length], ['--h' as any]: `${130 + ((b.data.pages ?? 280) % 90)}px` }}
                onClick={() => setOpen(b)} aria-label={`${b.data.title}${b.data.author ? ' by ' + b.data.author : ''}`}>
                {b.data.cover ? <img src={b.data.cover} alt="" loading="lazy" /> : <span className="spine-title">{b.data.title}</span>}
                {owner && b.visibility !== 'public' && <span className="spine-lock" aria-hidden>🔒</span>}
              </button>
            ))}
            {bs.length === 0 && <p className="muted shelf-empty">empty shelf — drop a book here</p>}
          </div>
        </section>
      ))}
      {quotes.length > 0 && (
        <section className="quotes-wall">
          <h2 className="script">Pressed between the pages</h2>
          <div className="quote-grid">
            {quotes.slice(0, 12).map(({ q, b }, i) => <Tag key={i} tilt={(i % 3) - 1.5}>“{q}”<br /><small>— {b.data.title}</small></Tag>)}
          </div>
        </section>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''} wide>
        {open && <BookSpread book={open} onEdit={() => { ed.edit(open); setOpen(null); }} />}
      </Modal>
      {ed.modal}
    </div>
  );
}

function BookSpread({ book, onEdit }: { book: Item<Book>; onEdit: () => void }) {
  const { owner } = useStore();
  const [secret, setSecret] = useState(false);
  const b = book.data;
  const pct = b.pages ? Math.round(((b.pagesRead ?? 0) / b.pages) * 100) : null;
  return (
    <div className="book-spread">
      <div className="book-page left">
        {b.cover ? <img className="book-cover" src={b.cover} alt={`Cover of ${b.title}`} /> : <div className="cloth-cover" style={{ ['--spine' as any]: b.color ?? '#d88f9d' }}><span className="script">{b.title}</span></div>}
        <p className="smallcaps">{b.author}</p>
        {!!b.rating && <Stars value={b.rating} />}
        {(!!b.spice || b.favorite) && <p className="muted">{b.favorite && <span>♡ a favourite</span>}{b.favorite && !!b.spice && ' · '}{!!b.spice && <span aria-label={`spice ${b.spice}`}>{'🌶️'.repeat(Math.min(b.spice, 5))}</span>}</p>}
        {b.series && <p className="muted">{b.series}{b.seriesNumber ? ` · book ${b.seriesNumber}${b.seriesTotal ? ` of ${b.seriesTotal}` : ''}` : ''}</p>}
        {pct === null && b.audioLength && <p className="smallcaps">🎧 {b.audioListened ? `${b.audioListened} / ` : ''}{b.audioLength}</p>}
        {pct !== null && (
          <div className="progress-block">
            <span className="smallcaps">{b.pagesRead ?? 0} / {b.pages} pages · {pct}%</span>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        {b.finishedOn && <p className="muted">finished {prettyDate(b.finishedOn)}</p>}
        {b.recommendedBy && <p className="muted">recommended by {b.recommendedBy}</p>}
        {b.link && <a className="btn small ghost" href={b.link} target="_blank" rel="noopener noreferrer">Find this book ↗</a>}
      </div>
      <div className="book-page right">
        {b.review ? <Prose text={b.review} /> : <p className="muted hand">No review written yet.</p>}
        {b.quotes?.map((q, i) => <blockquote key={i}>{q}</blockquote>)}
        {b.summary && <><p className="smallcaps">summary</p><Prose text={b.summary} /></>}
        {b.favoriteMoment && <><p className="smallcaps">favourite moment</p><Prose text={b.favoriteMoment} /></>}
        {b.favoriteCharacter && <p className="muted">favourite character: {b.favoriteCharacter}</p>}
        {b.secretMessage && (
          <button className="pressed-flower" onClick={() => setSecret(!secret)} aria-expanded={secret} aria-label="A pressed flower is tucked between the pages">❀</button>
        )}
        {secret && <p className="hand secret-msg">{b.secretMessage}</p>}
        {owner && b.privateNotes && <div className="private-note"><span className="smallcaps">🔒 private notes</span><p>{b.privateNotes}</p></div>}
        {owner && <div className="form-actions"><VisBadge v={book.visibility} /><button className="btn small" onClick={onEdit}>Edit book</button></div>}
      </div>
    </div>
  );
}

// ───────────── Journal (Inkwell House) ─────────────
interface Entry { title: string; body?: string; mood?: string; kind?: string; tags?: string[]; archived?: boolean }

export function JournalRoom({ room, itemId }: P) {
  const { owner } = useStore();
  const entries = useItems<Entry>('entry', room.id);
  const ed = useEditor('entry', room.id, entries.reload);
  const [showArchive, setShowArchive] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  if (itemId) return <EntryPage room={room} id={itemId} onEdit={(it) => ed.edit(it)} modal={ed.modal} />;
  const all = entries.data ?? [];
  const tags = [...new Set(all.flatMap((e) => e.data.tags ?? []))];
  const list = all.filter((e) => !!e.data.archived === showArchive && (!tag || e.data.tags?.includes(tag)));
  return (
    <div className="journal">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ kind: 'Diary' })}>+ Write a new page</button>
        <span className="muted">New pages start private. Make one public when you're ready to share it.</span>
      </OwnerBar>
      <div className="row wrap gap filters">
        <button className={`chip ${!tag ? 'on' : ''}`} onClick={() => setTag(null)}>all pages</button>
        {tags.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(t)}>#{t}</button>)}
        {owner && <label className="check"><input type="checkbox" checked={showArchive} onChange={(e) => setShowArchive(e.target.checked)} /> the archive drawer</label>}
      </div>
      {entries.loading && <Loading what="Uncapping the inkwell" />}
      {entries.error && <ErrorNote msg={entries.error} retry={entries.reload} />}
      {!entries.loading && list.length === 0 && <Empty title="A fresh, empty diary" art="✒">{owner ? 'Write your first page above.' : 'No pages have been left out on the desk yet.'}</Empty>}
      <div className="diary-pages">
        {list.map((e, i) => (
          <article key={e.id} className="diary-card" style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }}>
            <Link to={`/room/${room.id}/${e.id}`} className="diary-link">
              <p className="smallcaps">{prettyDate(e.createdAt)} · {e.data.kind ?? 'Diary'}{e.data.mood ? ` · feeling ${e.data.mood}` : ''}</p>
              <h3 className="script">{e.data.title}</h3>
              <p className="excerpt">{(e.data.body ?? '').replace(/[#*>[\]]/g, '').slice(0, 180)}{(e.data.body?.length ?? 0) > 180 ? '…' : ''}</p>
            </Link>
            {owner && <div className="card-foot"><VisBadge v={e.visibility} /><button className="btn small ghost" onClick={() => ed.edit(e)}>Edit</button></div>}
          </article>
        ))}
      </div>
      {ed.modal}
    </div>
  );
}

function EntryPage({ room, id, onEdit, modal }: { room: Room; id: string; onEdit: (it: Item) => void; modal: React.ReactNode }) {
  const { owner } = useStore();
  const [n, setN] = useState(0);
  const [state, setState] = useState<{ it?: Item<Entry>; err?: string }>({});
  useEffect(() => { itemsApi.get<Entry>(id).then((it) => setState({ it }), (e) => setState({ err: e.message })); }, [id, n]);
  if (state.err) return <Empty title="This page has been torn out">{state.err} <Link to={`/room/${room.id}`}>Back to the diary</Link></Empty>;
  if (!state.it) return <Loading />;
  const e = state.it;
  return (
    <article className="paper-sheet lined entry-page">
      <Link to={`/room/${room.id}`} className="back-link">← all pages</Link>
      <p className="smallcaps">{prettyDate(e.createdAt)}{e.data.mood ? ` · feeling ${e.data.mood}` : ''}</p>
      <h2 className="script entry-title">{e.data.title}</h2>
      <Prose text={e.data.body} />
      {e.data.tags?.length ? <p className="muted">{e.data.tags.map((t) => `#${t}`).join(' ')}</p> : null}
      {owner && <div className="form-actions"><VisBadge v={e.visibility} /><button className="btn small" onClick={() => onEdit(e)}>Edit page</button><button className="btn small ghost" onClick={() => setN(n + 1)}>Refresh</button></div>}
      {modal}
    </article>
  );
}

// ───────────── Gallery (Easel Loft) ─────────────
interface Art { title: string; image?: string; category?: string; medium?: string; date?: string; description?: string; status?: string }
export function GalleryRoom({ room }: P) {
  const { owner } = useStore();
  const works = useItems<Art>('artwork', room.id);
  const ed = useEditor('artwork', room.id, works.reload);
  const [open, setOpen] = useState<Item<Art> | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const cats = [...new Set((works.data ?? []).map((w) => w.data.category).filter(Boolean))] as string[];
  const list = (works.data ?? []).filter((w) => !cat || w.data.category === cat);
  return (
    <div className="gallery">
      <OwnerBar><button className="btn small" onClick={() => ed.add({ status: 'Finished' })}>+ Hang a new piece</button></OwnerBar>
      {cats.length > 0 && <div className="row wrap gap filters"><button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>everything</button>{cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>}
      {works.loading && <Loading what="Hanging the frames" />}
      {!works.loading && list.length === 0 && <Empty title="Bare walls, for now" art="🖼">{owner ? 'Upload artwork with the button above.' : 'The paint is still drying.'}</Empty>}
      <div className="frames">
        {list.map((w, i) => (
          <button key={w.id} className={`frame frame-${i % 3}`} onClick={() => setOpen(w)}>
            {w.data.image ? <img src={w.data.image} alt={w.data.title} loading="lazy" /> : <div className="frame-blank script">{w.data.title}</div>}
            <span className="frame-plaque smallcaps">{w.data.title}</span>
          </button>
        ))}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''} wide>
        {open && (
          <div className="art-detail">
            {open.data.image && <img src={open.data.image} alt={open.data.title} />}
            <div>
              <p className="smallcaps">{[open.data.category, open.data.medium, open.data.date && prettyDate(open.data.date), open.data.status].filter(Boolean).join(' · ')}</p>
              <Prose text={open.data.description} />
              {owner && <div className="form-actions"><VisBadge v={open.visibility} /><button className="btn small" onClick={() => { ed.edit(open); setOpen(null); }}>Edit</button></div>}
            </div>
          </div>
        )}
      </Modal>
      {ed.modal}
    </div>
  );
}

// ───────────── Music (Gramophone Pavilion) ─────────────
interface Rec { title: string; artist?: string; type?: string; link?: string; color?: string; cover?: string; note?: string }
export function MusicRoom({ room }: P) {
  const { owner } = useStore();
  const recs = useItems<Rec>('music', room.id);
  const ed = useEditor('music', room.id, recs.reload);
  const [playing, setPlaying] = useState<Item<Rec> | null>(null);
  const embed = playing?.data.link ? embedUrl(playing.data.link) : null;
  return (
    <div className="music">
      <OwnerBar><button className="btn small" onClick={() => ed.add({ type: 'Album' })}>+ Add a record</button></OwnerBar>
      {playing && (
        <Window title={`now playing · ${playing.data.title}`} subtitle={playing.data.artist} onClose={() => setPlaying(null)} className="now-playing">
          <div className="player-row">
            <div className={`vinyl spinning`} style={{ ['--sleeve' as any]: playing.data.color ?? '#d88f9d' }} aria-hidden />
            <div className="player-body">
              {playing.data.note && <p className="hand">{playing.data.note}</p>}
              {embed ? <iframe title={`${playing.data.title} player`} src={embed} loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
                : playing.data.link ? <a className="btn" href={playing.data.link} target="_blank" rel="noopener noreferrer">Listen ↗</a> : <p className="muted">No link added for this record.</p>}
            </div>
          </div>
        </Window>
      )}
      {recs.loading && <Loading what="Winding the gramophone" />}
      {!recs.loading && (recs.data?.length ?? 0) === 0 && <Empty title="The record crate is empty" art="♫">{owner ? 'Add albums, songs and playlists above.' : 'Come back for a song soon.'}</Empty>}
      <div className="records">
        {(recs.data ?? []).map((r) => (
          <div key={r.id} className="record">
            <button className="sleeve" style={{ ['--sleeve' as any]: r.data.color ?? '#d88f9d' }} onClick={() => setPlaying(r)} aria-label={`Play ${r.data.title}`}>
              {r.data.cover ? <img src={r.data.cover} alt="" loading="lazy" /> : <span className="script">{r.data.title}</span>}
              <span className="vinyl-peek" aria-hidden />
            </button>
            <p><strong>{r.data.title}</strong><br /><span className="muted">{r.data.artist} · {r.data.type}</span></p>
            {owner && <button className="btn small ghost" onClick={() => ed.edit(r)}>Edit</button>}
          </div>
        ))}
      </div>
      {ed.modal}
    </div>
  );
}

