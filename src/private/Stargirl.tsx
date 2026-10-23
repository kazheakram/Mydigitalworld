import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Item } from '../../shared/types';
import { useStore, chime } from '../lib/store';
import { api, items as itemsApi } from '../lib/api';
import { hostOf, isUrl, prettyDate, timeAgo, uid } from '../lib/util';
import { Empty, Field, Loading, Polaroid, Tag, useAsync } from '../ui/kit';
import { useItems } from '../rooms/common';
import { ModeShell, SectionTitle } from './Shell';
import { Vignette } from './Vignette';
import { quickSave } from './inboxLogic';
import type { Entry } from './Conservatory';
import { BookmarkCard } from './Cabinet';

// Stargirl Mode: intentional exploration. Expeditions have a purpose, an optional timer and an end —
// no infinite feed, no streaks, nothing designed to keep you scrolling.

interface Discovery { id: string; url?: string; title?: string; note?: string; savedAt: string; movedTo?: string }
interface Expedition { title: string; mode: 'guided' | 'wander'; goal?: string; notes?: string; timerMinutes?: number; startedAt: string; endedAt?: string; discoveries: Discovery[] }

export function StargirlPage() {
  const { world } = useStore();
  const nav = useNavigate();
  const copy = world.modes.stargirl;
  const exps = useItems<Expedition>('expedition');
  const active = (exps.data ?? []).find((e) => !e.data.endedAt);
  const cards = [
    { title: 'Curated Picks', caption: 'things I love · places to explore', to: '/stargirl/picks', v: 'picks' },
    { title: 'Rabbit Holes', caption: 'curiosities · deep dives · detours', to: '/stargirl/rabbit-holes', v: 'rabbit' },
    { title: 'Reading Room', caption: 'books · essays · quotes', to: '/dollhouse/reading', v: 'reading' },
    { title: 'Saved Discoveries', caption: 'places · ideas · keep for later', to: '/stargirl/discoveries', v: 'discoveries' },
    { title: 'Collections', caption: 'moodboards · a softer world', to: '/dollhouse/bookmarks', v: 'collections' },
  ];
  return (
    <ModeShell mode="stargirl">
      <div className="collage-hero">
        <div className="collage-side left hide-narrow">{copy.notes[1] && <Tag tilt={-5}>{copy.notes[1]}</Tag>}</div>
        <div className="torn-card welcome-torn night">
          <p className="smallcaps">welcome to</p>
          <h2 className="script">{copy.title}</h2>
          <p className="smallcaps soft">“a quiet space for curious minds, late night thoughts, and beautiful discoveries.”</p>
          {active ? <Link className="btn" to="/stargirl/rabbit-holes">Continue: {active.data.title} →</Link> : <Link className="btn" to="/stargirl/rabbit-holes">Set out on an expedition →</Link>}
        </div>
        <div className="collage-side right hide-narrow">{copy.notes[2] && <Tag tilt={4}>{copy.notes[2]}</Tag>}</div>
      </div>
      <div className="polaroid-row">
        {cards.map((c, i) => <Polaroid key={c.title} title={c.title} caption={c.caption} tilt={i % 2 ? 1.5 : -1.5} onClick={() => nav(c.to)}><Vignette kind={c.v} /></Polaroid>)}
      </div>
    </ModeShell>
  );
}

function Timer({ exp }: { exp: Item<Expedition> }) {
  const { soundOn } = useStore();
  const [now, setNow] = useState(Date.now());
  const [rung, setRung] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const mins = exp.data.timerMinutes;
  const elapsed = Math.floor((now - Date.parse(exp.data.startedAt)) / 1000);
  if (!mins) return <span className="timer muted">exploring for {Math.floor(elapsed / 60)} min</span>;
  const left = mins * 60 - elapsed;
  if (left <= 0 && !rung) { setRung(true); chime(soundOn, [784, 659, 523]); }
  const mm = Math.floor(Math.abs(left) / 60), ss = Math.abs(left) % 60;
  return (
    <span className={`timer ${left <= 0 ? 'over' : ''}`} role="timer" aria-live={left <= 0 ? 'assertive' : 'off'}>
      {left > 0 ? `${mm}:${String(ss).padStart(2, '0')} left` : `Time's up ✧ (${mm} min over) — a good moment to wrap up`}
    </span>
  );
}

export function RabbitHolesPage() {
  const { toast } = useStore();
  const exps = useItems<Expedition>('expedition');
  const bms = useItems<any>('bookmark');
  const links = useItems<any>('link');
  const all = exps.data ?? [];
  const active = all.find((e) => !e.data.endedAt);
  const [form, setForm] = useState({ title: '', mode: 'guided' as 'guided' | 'wander', goal: '', timerMinutes: 30 });
  const [disc, setDisc] = useState({ url: '', note: '' });
  const [notes, setNotes] = useState('');
  useEffect(() => { setNotes(active?.data.notes ?? ''); }, [active?.id]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    await itemsApi.create<Expedition>('expedition', { title: form.title || (form.mode === 'wander' ? 'A little wander' : 'An expedition'), mode: form.mode, goal: form.goal, timerMinutes: form.timerMinutes || undefined, startedAt: new Date().toISOString(), discoveries: [], notes: '' });
    exps.reload();
  };
  const save = async (patch: Partial<Expedition>) => { if (active) { await itemsApi.update(active.id, { data: patch }); exps.reload(); } };
  const addDiscovery = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!active || (!disc.url && !disc.note)) return;
    const d: Discovery = { id: uid('d-'), url: isUrl(disc.url) ? disc.url : undefined, note: disc.note || (!isUrl(disc.url) ? disc.url : ''), savedAt: new Date().toISOString() };
    if (d.url) { try { const m = await api('POST', '/api/unfurl', { url: d.url }); d.title = m.title; } catch { /* keep the bare link */ } }
    await save({ discoveries: [...active.data.discoveries, d] });
    setDisc({ url: '', note: '' });
    toast('Pocketed ✧');
  };
  const end = async () => { await save({ endedAt: new Date().toISOString(), notes }); toast('Expedition complete. Everything you found is kept ♡'); };
  const randomFrom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
  const wanderPick = () => { const p = randomFrom([...(bms.data ?? []), ...(links.data ?? [])]); if (p) window.open(p.data.url, '_blank', 'noopener'); else toast('Save a few bookmarks first, then wandering can pick from them.'); };

  return (
    <ModeShell mode="stargirl">
      <SectionTitle title="Rabbit Holes" sub="the explorer's garden · curiosities · deep dives" />
      {exps.loading && <Loading what="Packing the satchel" />}
      {!exps.loading && !active && (
        <form className="lace-card expedition-start" onSubmit={start}>
          <div className="mode-pick" role="radiogroup" aria-label="Kind of exploration">
            <button type="button" role="radio" aria-checked={form.mode === 'guided'} className={`mode-card ${form.mode === 'guided' ? 'on' : ''}`} onClick={() => setForm({ ...form, mode: 'guided' })}>
              <strong className="script">Guided Expedition</strong><small>A topic or goal: researching an author, finding literary criticism, new indie sites…</small>
            </button>
            <button type="button" role="radio" aria-checked={form.mode === 'wander'} className={`mode-card ${form.mode === 'wander' ? 'on' : ''}`} onClick={() => setForm({ ...form, mode: 'wander' })}>
              <strong className="script">Wandering</strong><small>No goal. Drift through your bookmarks, the webring and small-web directories.</small>
            </button>
          </div>
          <Field label="Name this expedition"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.mode === 'guided' ? 'e.g. Sylvia Plath’s letters' : 'e.g. Sunday wandering'} /></Field>
          {form.mode === 'guided' && <Field label="What are you looking for?"><textarea className="input" rows={2} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>}
          <Field label="Gentle timer (minutes)" hint="0 for no timer. When it ends you get a soft reminder — nothing locks or stops you."><input className="input" type="number" min={0} max={600} value={form.timerMinutes} onChange={(e) => setForm({ ...form, timerMinutes: Number(e.target.value) })} /></Field>
          <button className="btn">Set out ✧</button>
        </form>
      )}
      {active && (
        <div className="expedition lace-card">
          <header className="row wrap gap">
            <h3 className="script big">{active.data.title}</h3>
            <span className="smallcaps">{active.data.mode === 'guided' ? 'guided expedition' : 'wandering'}</span>
            <Timer exp={active} />
            <button className="btn small" onClick={end}>End expedition</button>
          </header>
          {active.data.goal && <p className="hand">Looking for: {active.data.goal}</p>}
          <div className="expedition-grid">
            <section>
              <h4 className="smallcaps">pocket a discovery</h4>
              <form onSubmit={addDiscovery} className="item-form">
                <input className="input" placeholder="Paste a link (or a thought)" value={disc.url} onChange={(e) => setDisc({ ...disc, url: e.target.value })} aria-label="Link or thought" />
                <input className="input" placeholder="Why it caught your eye (optional)" value={disc.note} onChange={(e) => setDisc({ ...disc, note: e.target.value })} aria-label="Note" />
                <button className="btn small">Pocket it</button>
              </form>
              <ul className="queue">{active.data.discoveries.map((d) => <li key={d.id}>{d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer">{d.title || hostOf(d.url)}</a> : null} <span className="hand">{d.note}</span></li>)}</ul>
            </section>
            <section>
              <h4 className="smallcaps">field notes</h4>
              <textarea className="input hand-input" rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => save({ notes })} aria-label="Field notes" />
              <h4 className="smallcaps">places to wander</h4>
              <div className="row wrap gap">
                <button className="btn small ghost" onClick={wanderPick}>🎲 a random saved place</button>
                <a className="btn small ghost" href="https://search.marginalia.nu/explore/random" target="_blank" rel="noopener noreferrer">Marginalia: random small site</a>
                <a className="btn small ghost" href="https://wiby.me/surprise/" target="_blank" rel="noopener noreferrer">Wiby: surprise me</a>
                <a className="btn small ghost" href="https://kagi.com/smallweb" target="_blank" rel="noopener noreferrer">Kagi Small Web</a>
                <a className="btn small ghost" href="https://neocities.org/browse" target="_blank" rel="noopener noreferrer">Browse Neocities</a>
              </div>
            </section>
          </div>
        </div>
      )}
      <h3 className="script">Past expeditions</h3>
      {all.filter((e) => e.data.endedAt).length === 0 && <p className="muted hand">None yet — your first is waiting.</p>}
      <div className="diary-pages">
        {all.filter((e) => e.data.endedAt).map((e) => (
          <article key={e.id} className="diary-card">
            <p className="smallcaps">{prettyDate(e.data.startedAt)} · {e.data.mode} · {Math.round((Date.parse(e.data.endedAt!) - Date.parse(e.data.startedAt)) / 60000)} min</p>
            <h3 className="script">{e.data.title}</h3>
            <p className="excerpt">{e.data.discoveries.length} discoveries{e.data.notes ? ` · “${e.data.notes.slice(0, 80)}”` : ''}</p>
            <div className="card-foot"><Link className="btn small ghost" to="/stargirl/discoveries">See finds</Link><button className="btn small ghost" onClick={async () => { if (confirm('Delete this expedition and its finds?')) { await itemsApi.remove(e.id); exps.reload(); } }}>Delete</button></div>
          </article>
        ))}
      </div>
    </ModeShell>
  );
}

export function DiscoveriesPage() {
  const { toast } = useStore();
  const exps = useItems<Expedition>('expedition');
  const saved = useAsync<Entry[]>(() => api('GET', '/api/feed-entries?filter=saved&limit=100'), []);
  const all = (exps.data ?? []).flatMap((e) => e.data.discoveries.map((d) => ({ d, e })));
  const move = async (exp: Item<Expedition>, d: Discovery, to: 'inbox' | 'cabinet') => {
    if (to === 'inbox') await quickSave(d.url ?? d.note ?? '', 0, { title: d.title, note: d.note, source: exp.data.title });
    else await itemsApi.create('bookmark', { url: d.url, title: d.title || d.url, description: d.note, collection: 'Discoveries', tags: [] });
    await itemsApi.update(exp.id, { data: { discoveries: exp.data.discoveries.map((x) => (x.id === d.id ? { ...x, movedTo: to } : x)) } });
    toast(to === 'inbox' ? 'Sent to the letterbox ✉' : 'Filed in the cabinet under Discoveries ♡');
    exps.reload();
  };
  return (
    <ModeShell mode="stargirl">
      <SectionTitle title="Saved Discoveries" sub="places · ideas · people · little joys" />
      {exps.loading && <Loading />}
      {!exps.loading && all.length === 0 && (saved.data?.length ?? 0) === 0 && <Empty title="Nothing pocketed yet" art="✧"><Link to="/stargirl/rabbit-holes">Set out on an expedition</Link> and pocket what you find.</Empty>}
      <div className="tickets">
        {all.map(({ d, e }, i) => (
          <div key={d.id} className="ticket night-ticket" style={{ ['--tilt' as any]: `${(i % 4) - 1.5}deg` }}>
            <div className="ticket-inner">
              <span className="smallcaps">{e.data.title} · {timeAgo(d.savedAt)}</span>
              {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer"><strong className="script">{d.title || hostOf(d.url)}</strong></a> : <strong className="script">a thought</strong>}
              {d.note && <small className="hand">{d.note}</small>}
            </div>
            <div className="row wrap">
              {d.movedTo ? <span className="muted">moved to {d.movedTo === 'inbox' ? 'letterbox' : 'cabinet'} ✓</span> : <>
                <button className="btn small ghost" onClick={() => move(e, d, 'inbox')}>→ Letterbox</button>
                {d.url && <button className="btn small ghost" onClick={() => move(e, d, 'cabinet')}>→ Cabinet</button>}
              </>}
            </div>
          </div>
        ))}
      </div>
      {(saved.data?.length ?? 0) > 0 && <>
        <h3 className="script">Starred from the reader</h3>
        <ul className="queue">{saved.data!.map((s) => <li key={s.id}><a href={s.link} target="_blank" rel="noopener noreferrer">{s.title}</a> <span className="muted">{s.feedTitle}</span></li>)}</ul>
      </>}
    </ModeShell>
  );
}

export function PicksPage() {
  const { world } = useStore();
  const bms = useItems<any>('bookmark');
  const links = useItems<any>('link');
  const favs = (bms.data ?? []).filter((b) => b.data.favorite);
  const collectionRooms = world.rooms.filter((r) => r.template === 'collection');
  return (
    <ModeShell mode="stargirl">
      <SectionTitle title="Curated Picks" sub="beautiful corners of the web" />
      <h3 className="smallcaps">♥ my favourites</h3>
      {favs.length === 0 && <p className="muted hand">Heart a bookmark in the cabinet and it appears here.</p>}
      <div className="treasures">{favs.map((b) => <BookmarkCard key={b.id} b={b} />)}</div>
      {collectionRooms.map((r) => (
        <section key={r.id}>
          <h3 className="smallcaps">{r.name}</h3>
          <div className="treasures">{(links.data ?? []).filter((l) => l.roomId === r.id).map((l) => <BookmarkCard key={l.id} b={l} />)}</div>
          <Link className="btn small ghost" to={`/room/${r.id}`}>Open {r.name}</Link>
        </section>
      ))}
    </ModeShell>
  );
}
