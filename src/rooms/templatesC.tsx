import { useMemo, useState } from 'react';
import type { Item, Room } from '../../shared/types';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { embedUrl, hostOf, prettyDate } from '../lib/util';
import { Empty, Field, Loading, Modal, Stars, VisBadge } from '../ui/kit';
import { OwnerBar, useEditor, useItems } from './common';

// Ribbonmere 2.0 room templates: the Picture House (films), the Record Shop, the Bookshop and the
// Memory Museum. Each is an ordinary room: private or public, placed on the map from Atelier → Rooms.

type P = { room: Room; itemId?: string };

/** A small owner-only editor for a room's list setting (crates, displays, collections…). */
function ListSetting({ room, keyName, label, fallback }: { room: Room; keyName: string; label: string; fallback: string[] }) {
  const { updateWorld } = useStore();
  const value: string[] = room.settings?.[keyName] ?? fallback;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value.join(', '));
  const save = () => {
    const list = text.split(',').map((s) => s.trim()).filter(Boolean);
    updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...(r.settings ?? {}), [keyName]: list } } : r)) }));
    setOpen(false);
  };
  return (
    <>
      <button className="btn small ghost" onClick={() => { setText(value.join(', ')); setOpen(true); }}>{label}…</button>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <Field label={label} hint="Separate with commas. Renaming one here doesn't move what's already in it."><input className="input" value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="form-actions"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
      </Modal>
    </>
  );
}

const paint = (seed: string) => ['var(--c-rose)', 'var(--c-sageDeep)', 'var(--c-roseDeep)', 'var(--c-gold)', 'var(--c-sky)', 'var(--c-pink)'][[...seed].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 6];

// ───────────── The Picture House ─────────────
interface Film { title: string; year?: number; director?: string; status?: string; poster?: string; color?: string; rating?: number; watchedOn?: string; collection?: string; tags?: string[]; review?: string; link?: string }
export function CinemaRoom({ room }: P) {
  const films = useItems<Film>('film', room.id);
  const collections: string[] = room.settings?.collections ?? ['Rainy-day films', 'Golden-age Hollywood', 'Comfort watches'];
  const ed = useEditor('film', room.id, () => { films.reload(); award('collector'); }, { collections });
  const [status, setStatus] = useState<string | null>(null);
  const [col, setCol] = useState<string | null>(null);
  const [open, setOpen] = useState<Item<Film> | null>(null);
  const all = films.data ?? [];
  const list = all.filter((f) => (!status || (f.data.status ?? 'Watched') === status) && (!col || f.data.collection === col));
  const nowShowing = [...all].filter((f) => f.data.status !== 'Watchlist').sort((a, b) => (b.data.watchedOn ?? b.updatedAt).localeCompare(a.data.watchedOn ?? a.updatedAt))[0];
  return (
    <div className="cinema">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ status: 'Watched' })}>+ A film</button>
        <button className="btn small ghost" onClick={() => ed.add({ status: 'Watchlist' })}>+ To the watchlist</button>
        <ListSetting room={room} keyName="collections" label="Collections" fallback={collections} />
      </OwnerBar>
      {nowShowing && (
        <div className="marquee lace-card" aria-label="Now showing">
          <span className="smallcaps">now showing</span>
          <strong className="script">{nowShowing.data.title}</strong>
          {nowShowing.data.year && <span className="muted">({nowShowing.data.year})</span>}
        </div>
      )}
      <div className="row wrap gap filters">
        {[null, 'Watched', 'Favourite', 'Watchlist'].map((s) => <button key={s ?? 'all'} className={`chip ${status === s ? 'on' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>{s ?? 'every film'}</button>)}
        {collections.map((c) => <button key={c} className={`chip ${col === c ? 'on' : ''}`} aria-pressed={col === c} onClick={() => setCol(col === c ? null : c)}>{c}</button>)}
      </div>
      {films.loading && <Loading what="Dimming the lights" />}
      {!films.loading && list.length === 0 && <Empty title="The screen is dark" art="🎞" />}
      <div className="poster-wall">
        {list.map((f) => (
          <button key={f.id} className={`poster ${f.data.status === 'Watchlist' ? 'is-watchlist' : ''}`} onClick={() => setOpen(f)} aria-label={`${f.data.title}${f.data.year ? ` (${f.data.year})` : ''}`}>
            {f.data.poster ? <img src={f.data.poster} alt="" loading="lazy" referrerPolicy="no-referrer" /> : (
              <span className="poster-painted" style={{ background: f.data.color ?? paint(f.data.title) }}>
                <span className="script">{f.data.title}</span>{f.data.director && <small>{f.data.director}</small>}
              </span>
            )}
            {f.data.status === 'Favourite' && <span className="poster-ribbon" aria-hidden>♥</span>}
            {f.data.status === 'Watchlist' && <span className="poster-ticket" aria-hidden>admit one</span>}
          </button>
        ))}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''}>
        {open && (
          <div className="film-detail">
            <p className="muted">{[open.data.year, open.data.director, open.data.status, open.data.collection].filter(Boolean).join(' · ')}</p>
            {open.data.rating ? <Stars value={open.data.rating} /> : null}
            {open.data.watchedOn && <p className="muted">Watched {prettyDate(open.data.watchedOn)}</p>}
            {open.data.review && <p>{open.data.review}</p>}
            {open.data.tags?.length ? <p>{open.data.tags.map((t) => <span key={t} className="chip static">{t}</span>)}</p> : null}
            {open.data.link && <p><a className="btn small ghost" href={open.data.link} target="_blank" rel="noopener noreferrer">{hostOf(open.data.link)} ↗</a></p>}
            <OwnerBar><VisBadge v={open.visibility} /><button className="btn small" onClick={() => { ed.edit(open); setOpen(null); }}>Edit</button></OwnerBar>
          </div>
        )}
      </Modal>
      {ed.modal}
    </div>
  );
}

// ───────────── The Record Shop ─────────────
interface Record_ { title: string; artist?: string; type?: string; link?: string; color?: string; cover?: string; note?: string; crate?: string; format?: string; year?: number; rating?: number; review?: string }
export function RecordStoreRoom({ room }: P) {
  const recs = useItems<Record_>('music', room.id);
  const crates: string[] = room.settings?.crates ?? ['New arrivals', 'Sad sunsets', 'French pop', 'Soundtracks'];
  const ed = useEditor('music', room.id, () => { recs.reload(); award('collector'); }, { crates });
  const [open, setOpen] = useState<Item<Record_> | null>(null);
  const [q, setQ] = useState('');
  const list = (recs.data ?? []).filter((r) => !q || `${r.data.title} ${r.data.artist}`.toLowerCase().includes(q.toLowerCase()));
  const byCrate = useMemo(() => {
    const m = new Map<string, Item<Record_>[]>(crates.map((c) => [c, []]));
    for (const r of list) { const c = r.data.crate && m.has(r.data.crate) ? r.data.crate : 'Unsorted'; m.set(c, [...(m.get(c) ?? []), r]); }
    return [...m.entries()].filter(([, l]) => l.length);
  }, [list, crates]);
  const artists = [...new Set((recs.data ?? []).map((r) => r.data.artist).filter(Boolean) as string[])].sort();
  const player = open?.data.link ? embedUrl(open.data.link) : null;
  return (
    <div className="recordstore">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ type: 'Album', crate: crates[0], format: 'Vinyl' })}>+ A record</button>
        <ListSetting room={room} keyName="crates" label="Crates" fallback={crates} />
      </OwnerBar>
      <div className="row wrap gap filters">
        <input className="input search-input" type="search" placeholder="Flip through… title or artist" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search records" />
        {artists.length > 0 && <span className="muted small">{artists.length} artist{artists.length > 1 ? 's' : ''}: {artists.slice(0, 8).join(' · ')}{artists.length > 8 ? '…' : ''}</span>}
      </div>
      {recs.loading && <Loading what="Dusting the sleeves" />}
      {!recs.loading && byCrate.length === 0 && <Empty title="The crates are empty" art="💿" />}
      {byCrate.map(([crate, l]) => (
        <section key={crate} className="crate" aria-label={`Crate: ${crate}`}>
          <h3 className="crate-label">{crate}</h3>
          <div className="crate-row">
            {l.map((r, i) => (
              <button key={r.id} className="sleeve" style={{ ['--i' as any]: i, background: r.data.cover ? undefined : r.data.color ?? paint(r.data.title) }} onClick={() => setOpen(r)} aria-label={`${r.data.title}${r.data.artist ? ` by ${r.data.artist}` : ''}`}>
                {r.data.cover ? <img src={r.data.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sleeve-text"><strong>{r.data.title}</strong><small>{r.data.artist}</small></span>}
                {r.data.format && <span className="sleeve-format">{r.data.format}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''}>
        {open && (
          <div>
            <p className="muted">{[open.data.artist, open.data.year, open.data.format, open.data.type].filter(Boolean).join(' · ')}</p>
            {open.data.rating ? <Stars value={open.data.rating} /> : null}
            {open.data.review && <p>{open.data.review}</p>}
            {open.data.note && <p className="hand">“{open.data.note}”</p>}
            {player && <iframe className="embed" src={player} title={`Listen to ${open.data.title}`} height={152} allow="encrypted-media" loading="lazy" />}
            {open.data.link && !player && <a className="btn small ghost" href={open.data.link} target="_blank" rel="noopener noreferrer">Listen on {hostOf(open.data.link)} ↗</a>}
            <OwnerBar><VisBadge v={open.visibility} /><button className="btn small" onClick={() => { ed.edit(open); setOpen(null); }}>Edit</button></OwnerBar>
          </div>
        )}
      </Modal>
      {ed.modal}
    </div>
  );
}

// ───────────── The Bookshop ─────────────
interface ShopBook { title: string; author?: string; shelf?: string; cover?: string; color?: string; recommendation?: string; wishlist?: boolean; secretMessage?: string; link?: string; rating?: number; review?: string; quotes?: string[] }
export function BookstoreRoom({ room }: P) {
  const books = useItems<ShopBook>('book', room.id);
  const displays: string[] = room.settings?.displays ?? ['Staff picks', 'For rainy days', 'The poetry corner'];
  const ed = useEditor('book', room.id, books.reload, { shelves: displays });
  const [open, setOpen] = useState<Item<ShopBook> | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const all = books.data ?? [];
  const wish = all.filter((b) => b.data.wishlist);
  const groups = [...displays, ...new Set(all.map((b) => b.data.shelf).filter((s) => s && !displays.includes(s)) as string[])]
    .map((d) => [d, all.filter((b) => (b.data.shelf ?? displays[0]) === d)] as const).filter(([, l]) => l.length);
  return (
    <div className="bookstore">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ shelf: displays[0] })}>+ A book for the shop</button>
        <ListSetting room={room} keyName="displays" label="Displays" fallback={displays} />
      </OwnerBar>
      <p className="muted center small">Nothing here is for sale: just recommendations, the way a friend would press a book into your hands.</p>
      {books.loading && <Loading what="Turning the sign to open" />}
      {!books.loading && all.length === 0 && <Empty title="The shelves are bare" art="📖" />}
      {groups.map(([d, l]) => (
        <section key={d} className="shop-display" aria-label={`Display: ${d}`}>
          <h3 className="shop-sign script">{d}</h3>
          <div className="shop-table">
            {l.map((b, i) => (
              <div key={b.id} className="shop-book" style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }}>
                <button className="shop-cover" onClick={() => setOpen(b)} aria-label={`${b.data.title}${b.data.author ? ` by ${b.data.author}` : ''}`} style={{ background: b.data.cover ? undefined : b.data.color ?? paint(b.data.title) }}>
                  {b.data.cover ? <img src={b.data.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span><strong className="script">{b.data.title}</strong><small>{b.data.author}</small></span>}
                </button>
                {b.data.recommendation && <p className="shop-card hand">{b.data.recommendation}</p>}
                {b.data.secretMessage && <button className="pressed-flower" onClick={() => setSecret(b.data.secretMessage!)} aria-label={`Something is tucked inside ${b.data.title}`}>❀</button>}
              </div>
            ))}
          </div>
        </section>
      ))}
      {wish.length > 0 && (
        <section className="lace-card shop-wishlist" aria-label="Wishlist">
          <h3 className="smallcaps">my wishlist</h3>
          <ul>{wish.map((b) => <li key={b.id}><button className="linkish" onClick={() => setOpen(b)}>{b.data.title}</button> {b.data.author && <span className="muted">· {b.data.author}</span>}</li>)}</ul>
        </section>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''}>
        {open && (
          <div>
            {open.data.author && <p className="muted">by {open.data.author}</p>}
            {open.data.recommendation && <p className="hand">{open.data.recommendation}</p>}
            {open.data.review && <p>{open.data.review}</p>}
            {open.data.quotes?.map((q, i) => <blockquote key={i} className="hand">“{q}”</blockquote>)}
            {open.data.link && <a className="btn small ghost" href={open.data.link} target="_blank" rel="noopener noreferrer">Find it at {hostOf(open.data.link)} ↗</a>}
            <OwnerBar><VisBadge v={open.visibility} /><button className="btn small" onClick={() => { ed.edit(open); setOpen(null); }}>Edit</button></OwnerBar>
          </div>
        )}
      </Modal>
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Tucked between the pages"><p className="hand secret-msg">{secret}</p></Modal>
      {ed.modal}
    </div>
  );
}

// ───────────── The Memory Museum ─────────────
interface Memory { title: string; date?: string; image?: string; exhibition?: string; place?: string; people?: string[]; description?: string }
export function MuseumRoom({ room }: P) {
  const mems = useItems<Memory>('memory', room.id);
  const exhibitions: string[] = room.settings?.exhibitions ?? ['Summers', 'Firsts', 'People I love'];
  const ed = useEditor('memory', room.id, () => { mems.reload(); award('collector'); }, { exhibitions });
  const [view, setView] = useState<'halls' | 'timeline'>('halls');
  const [open, setOpen] = useState<Item<Memory> | null>(null);
  const all = mems.data ?? [];
  const halls = [...exhibitions, ...new Set(all.map((m) => m.data.exhibition).filter((e) => e && !exhibitions.includes(e)) as string[])]
    .map((e) => [e, all.filter((m) => (m.data.exhibition ?? exhibitions[0]) === e)] as const).filter(([, l]) => l.length);
  const timeline = [...all].sort((a, b) => (a.data.date ?? '9999').localeCompare(b.data.date ?? '9999'));
  const years = [...new Set(timeline.map((m) => m.data.date?.slice(0, 4) ?? 'Undated'))];
  const Frame = ({ m }: { m: Item<Memory> }) => (
    <button className="museum-frame" onClick={() => setOpen(m)} aria-label={m.data.title}>
      {m.data.image ? <img src={m.data.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="museum-blank script">{m.data.title}</span>}
      <span className="museum-plaque"><strong>{m.data.title}</strong>{m.data.date && <small>{prettyDate(m.data.date)}</small>}</span>
    </button>
  );
  return (
    <div className="museum">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ exhibition: exhibitions[0], date: new Date().toISOString().slice(0, 10) })}>+ A memory</button>
        <ListSetting room={room} keyName="exhibitions" label="Exhibitions" fallback={exhibitions} />
      </OwnerBar>
      <div className="row wrap gap filters" role="tablist" aria-label="Museum views">
        <button role="tab" aria-selected={view === 'halls'} className={`chip ${view === 'halls' ? 'on' : ''}`} onClick={() => setView('halls')}>Exhibition halls</button>
        <button role="tab" aria-selected={view === 'timeline'} className={`chip ${view === 'timeline' ? 'on' : ''}`} onClick={() => setView('timeline')}>Timeline</button>
      </div>
      {mems.loading && <Loading what="Unlocking the galleries" />}
      {!mems.loading && all.length === 0 && <Empty title="The galleries are waiting" art="🏛" />}
      {view === 'halls' && halls.map(([e, l]) => (
        <section key={e} className="museum-hall" aria-label={`Exhibition: ${e}`}>
          <h3 className="museum-hall-title script">{e}</h3>
          <div className="museum-wall">{l.map((m) => <Frame key={m.id} m={m} />)}</div>
        </section>
      ))}
      {view === 'timeline' && (
        <ol className="museum-timeline">
          {years.map((y) => (
            <li key={y}>
              <span className="museum-year">{y}</span>
              <div className="museum-wall">{timeline.filter((m) => (m.data.date?.slice(0, 4) ?? 'Undated') === y).map((m) => <Frame key={m.id} m={m} />)}</div>
            </li>
          ))}
        </ol>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''} wide>
        {open && (
          <div className="museum-detail">
            {open.data.image && <img src={open.data.image} alt="" referrerPolicy="no-referrer" />}
            <p className="muted">{[open.data.date && prettyDate(open.data.date), open.data.place, open.data.people?.length && `with ${open.data.people.join(', ')}`].filter(Boolean).join(' · ')}</p>
            {open.data.description && <p>{open.data.description}</p>}
            <OwnerBar><VisBadge v={open.visibility} /><button className="btn small" onClick={() => { ed.edit(open); setOpen(null); }}>Edit</button></OwnerBar>
          </div>
        )}
      </Modal>
      {ed.modal}
    </div>
  );
}
