import { useMemo, useState, type FormEvent } from 'react';
import { InteriorBackground } from '../world/Interior';
import { Link } from 'react-router-dom';
import type { Item, Room } from '../../shared/types';
import { useStore, chime } from '../lib/store';
import { api, items as itemsApi } from '../lib/api';
import { Prose, wikiLinks } from '../lib/markdown';
import { hostOf, prettyDate, timeAgo } from '../lib/util';
import { Empty, ErrorNote, Field, Loading, Modal, Tag, VisBadge } from '../ui/kit';
import { OwnerBar, useEditor, useItems } from './common';
import { Scene } from '../world/Scene';

type P = { room: Room; itemId?: string };

// ───────────── Post Office ─────────────
const STATIONERY = [
  { id: 'rose', label: 'Rose letter' }, { id: 'lace', label: 'Lace card' }, { id: 'sky', label: 'Blue airmail' }, { id: 'cream', label: 'Plain cream' },
];
export function PostOfficeRoom({ room }: P) {
  const { owner, toast, updateWorld } = useStore();
  const letters = useItems<any>('guestbook', room.id);
  const [form, setForm] = useState({ name: '', message: '', website: '', stationery: room.settings?.stationery ?? 'rose' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const contacts: { label: string; url: string }[] = room.settings?.contacts ?? [];
  const open = room.settings?.guestbookOpen !== false;

  const send = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('POST', '/api/guestbook', { ...form, roomId: room.id }); setSent(true); setForm({ ...form, message: '' }); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const approve = async (it: Item, ok: boolean) => {
    if (ok) await itemsApi.update(it.id, { visibility: 'public', data: { approved: true } });
    else await itemsApi.remove(it.id);
    toast(ok ? 'Letter pinned to the board ♡' : 'Letter removed.');
    letters.reload();
  };
  const editContacts = async () => {
    const v = prompt('Contact links, one per line as "Label | https://…" (mailto: works too):', contacts.map((c) => `${c.label} | ${c.url}`).join('\n'));
    if (v === null) return;
    const list = v.split('\n').map((l) => l.split('|').map((s) => s.trim())).filter(([l, u]) => l && /^(https?:|mailto:)/.test(u ?? '')).map(([label, url]) => ({ label, url }));
    await updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...r.settings, contacts: list } } : r)) }));
  };
  const toggleOpen = () => updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...r.settings, guestbookOpen: !open } } : r)) }));

  const pending = (letters.data ?? []).filter((l) => !l.data.approved);
  const shown = (letters.data ?? []).filter((l) => l.data.approved);
  return (
    <div className="postoffice">
      <OwnerBar>
        <button className="btn small ghost" onClick={editContacts}>Edit contact links</button>
        <button className="btn small ghost" onClick={toggleOpen}>{open ? 'Close the guestbook' : 'Open the guestbook'}</button>
      </OwnerBar>
      {owner && pending.length > 0 && (
        <section className="lace-card moderation">
          <h2 className="smallcaps">letters waiting for you · {pending.length}</h2>
          {pending.map((l) => (
            <div key={l.id} className={`letter-card st-${l.data.stationery}`}>
              <p className="hand">{l.data.message}</p><p className="smallcaps">— {l.data.name} · {timeAgo(l.createdAt)}</p>
              <div className="form-actions"><button className="btn small" onClick={() => approve(l, true)}>Pin it up</button><button className="btn small danger" onClick={() => approve(l, false)}>Throw away</button></div>
            </div>
          ))}
        </section>
      )}
      <div className="post-grid">
        <section className={`paper-sheet letter st-${form.stationery}`}>
          <h2 className="script">Write me a letter</h2>
          {!open ? <p className="hand">The post office is closed for now. Please come back later ♡</p> : sent ? (
            <div className="sent"><p className="script big">Sealed & sent ✉</p><p>Thank you! Your letter will appear on the board once it has been read.</p><button className="btn small ghost" onClick={() => setSent(false)}>Write another</button></div>
          ) : (
            <form onSubmit={send} className="item-form">
              <Field group label="Stationery">
                <span className="row wrap">{STATIONERY.map((s) => <button type="button" key={s.id} className={`chip st-chip st-${s.id} ${form.stationery === s.id ? 'on' : ''}`} onClick={() => setForm({ ...form, stationery: s.id })}>{s.label}</button>)}</span>
              </Field>
              <Field label="Your name"><input className="input" maxLength={60} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Your letter"><textarea className="input hand-input" rows={5} maxLength={1500} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
              {/* honeypot: hidden from people, tempting to bots */}
              <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
              {err && <p className="error-note" role="alert">{err}</p>}
              <button className="btn" disabled={busy}>{busy ? 'Sealing…' : 'Seal with a kiss & send'}</button>
              <p className="muted">Letters are read before they're pinned to the board.</p>
            </form>
          )}
        </section>
        <aside className="contacts">
          <h2 className="smallcaps">find me elsewhere</h2>
          {contacts.length === 0 && <p className="muted">No links yet.</p>}
          {contacts.map((c, i) => <a key={i} className="stamp-link" href={c.url} target="_blank" rel="noopener noreferrer"><span className="stamp-edge">{c.label}</span></a>)}
        </aside>
      </div>
      <section className="letter-board">
        <h2 className="script">The letter board</h2>
        {letters.loading && <Loading />}
        {!letters.loading && shown.length === 0 && <p className="muted hand">No letters pinned up yet — be the first?</p>}
        <div className="letters">
          {shown.map((l, i) => (
            <div key={l.id} className={`letter-card st-${l.data.stationery}`} style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }}>
              <p className="hand">{l.data.message}</p>
              <p className="smallcaps">— {l.data.name} · {prettyDate(l.createdAt)}</p>
              {owner && <button className="btn small ghost" onClick={() => approve(l, false)}>Remove</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ───────────── Café Meringue ─────────────
interface Drink { name: string; description?: string; color?: string; pairing?: string; link?: string }
export function CafeRoom({ room }: P) {
  const { owner, soundOn } = useStore();
  const drinks = useItems<Drink>('drink', room.id);
  const ed = useEditor('drink', room.id, drinks.reload);
  const [chosen, setChosen] = useState<Item<Drink> | null>(null);
  return (
    <div className="cafe">
      <OwnerBar><button className="btn small" onClick={() => ed.add({ color: '#f2c1cc' })}>+ Add to the menu</button></OwnerBar>
      <div className="cafe-grid">
        <section className="menu-board paper-sheet">
          <h2 className="script">Today's menu</h2>
          {drinks.loading && <Loading what="Warming the milk" />}
          {!drinks.loading && (drinks.data?.length ?? 0) === 0 && <p className="muted">The menu is blank.</p>}
          <ul className="menu">
            {(drinks.data ?? []).map((d) => (
              <li key={d.id}>
                <button className={`menu-item ${chosen?.id === d.id ? 'on' : ''}`} onClick={() => { setChosen(d); chime(soundOn, [660, 990]); }}>
                  <span className="cup-dot" style={{ background: d.data.color }} aria-hidden />
                  <span><strong>{d.data.name}</strong><small>{d.data.description}</small></span>
                </button>
                {owner && <button className="btn small ghost" onClick={() => ed.edit(d)}>Edit</button>}
              </li>
            ))}
          </ul>
        </section>
        <section className="table-scene" aria-live="polite">
          {chosen ? (
            <div className="served" key={chosen.id}>
              <svg viewBox="0 0 120 110" className="served-cup" aria-hidden>
                <ellipse cx={60} cy={98} rx={52} ry={9} fill="var(--c-trim)" stroke="var(--c-ink)" strokeOpacity={0.3} />
                <path d="M22 40 H98 Q96 94 60 94 Q24 94 22 40 Z" fill="var(--c-trim)" stroke="var(--c-ink)" strokeOpacity={0.35} strokeWidth={2} />
                <ellipse cx={60} cy={40} rx={38} ry={8} fill={chosen.data.color ?? 'var(--c-pink)'} />
                <path d="M98 50 q18 2 12 18 q-5 10 -16 8" stroke="var(--c-ink)" strokeOpacity={0.35} strokeWidth={5} fill="none" />
                <path className="steam" d="M48 30 q-8 -12 0 -22 M66 30 q-8 -12 0 -22" stroke="var(--c-inkSoft)" strokeWidth={2.5} fill="none" opacity={0.5} />
              </svg>
              <p className="script big">{chosen.data.name}</p>
              <Tag tilt={-2}>Pairs perfectly with… {chosen.data.pairing}</Tag>
              {chosen.data.link && <a className="btn small" href={chosen.data.link} target="_blank" rel="noopener noreferrer">The recommendation ↗</a>}
            </div>
          ) : <p className="hand muted">Choose something from the menu and I'll bring it to your table.</p>}
        </section>
      </div>
      {ed.modal}
    </div>
  );
}

// ───────────── Digital Garden (Seedling Greenhouse) ─────────────
interface Note { title: string; body?: string; stage?: string; tags?: string[] }
export function GardenRoom({ room, itemId }: P) {
  const { owner, world } = useStore();
  const notes = useItems<Note>('note', room.id);
  const stages = world.gardenStages;
  const ed = useEditor('note', room.id, notes.reload, { stages: stages.map((s) => s.id) });
  const [stage, setStage] = useState<string | null>(null);
  const all = notes.data ?? [];
  const byTitle = useMemo(() => new Map(all.map((n) => [n.data.title.toLowerCase(), n])), [all]);
  const resolve = (t: string) => { const n = byTitle.get(t.toLowerCase()); return n ? `/room/${room.id}/${n.id}` : null; };
  const stageOf = (id?: string) => stages.find((s) => s.id === id) ?? stages[0];

  if (itemId) {
    const n = all.find((x) => x.id === itemId);
    if (notes.loading) return <Loading />;
    if (!n) return <Empty title="This seed hasn't sprouted">It may be private or gone. <Link to={`/room/${room.id}`}>Back to the garden</Link></Empty>;
    const backlinks = all.filter((o) => o.id !== n.id && wikiLinks(o.data.body).some((t) => t.toLowerCase() === n.data.title.toLowerCase()));
    return (
      <article className="paper-sheet garden-note">
        <Link to={`/room/${room.id}`} className="back-link">← the whole garden</Link>
        <p className="smallcaps">{stageOf(n.data.stage)?.emoji} {stageOf(n.data.stage)?.label} · planted {prettyDate(n.createdAt)} · tended {timeAgo(n.updatedAt)}</p>
        <h2 className="script entry-title">{n.data.title}</h2>
        <Prose text={n.data.body} resolve={resolve} />
        {backlinks.length > 0 && (
          <aside className="backlinks"><h3 className="smallcaps">notes that grow towards this one</h3>
            <ul>{backlinks.map((b) => <li key={b.id}><Link to={`/room/${room.id}/${b.id}`}>{b.data.title}</Link></li>)}</ul>
          </aside>
        )}
        {owner && <div className="form-actions"><VisBadge v={n.visibility} /><button className="btn small" onClick={() => ed.edit(n)}>Tend this note</button></div>}
        {ed.modal}
      </article>
    );
  }
  const list = all.filter((n) => !stage || n.data.stage === stage);
  return (
    <div className="garden">
      <OwnerBar><button className="btn small" onClick={() => ed.add({ stage: stages[0]?.id })}>+ Plant a seed</button><span className="muted">Notes start private. Rename stages in the Atelier → Village settings.</span></OwnerBar>
      <div className="row wrap gap filters">
        <button className={`chip ${!stage ? 'on' : ''}`} onClick={() => setStage(null)}>the whole garden</button>
        {stages.map((s) => <button key={s.id} className={`chip ${stage === s.id ? 'on' : ''}`} onClick={() => setStage(s.id)}>{s.emoji} {s.label}</button>)}
      </div>
      {notes.loading && <Loading what="Watering the seedlings" />}
      {notes.error && <ErrorNote msg={notes.error} retry={notes.reload} />}
      {!notes.loading && list.length === 0 && <Empty title="Freshly turned soil" art="🌱">{owner ? 'Plant your first idea.' : 'Nothing has sprouted here yet.'}</Empty>}
      <div className="seed-beds">
        {list.map((n) => (
          <Link key={n.id} to={`/room/${room.id}/${n.id}`} className={`seed-card stage-${n.data.stage}`}>
            <span className="seed-stage" aria-label={stageOf(n.data.stage)?.label}>{stageOf(n.data.stage)?.emoji}</span>
            <strong>{n.data.title}</strong>
            <small className="muted">{(n.data.body ?? '').replace(/[[\]*#>]/g, '').slice(0, 90)}</small>
            {owner && n.visibility !== 'public' && <span className="spine-lock">🔒</span>}
          </Link>
        ))}
      </div>
      {ed.modal}
    </div>
  );
}

// ───────────── Observatory ─────────────
interface StarD { title: string; category?: string; description?: string; status?: string; link?: string }
export function ObservatoryRoom({ room }: P) {
  const { owner } = useStore();
  const stars = useItems<StarD>('star', room.id);
  const ed = useEditor('star', room.id, stars.reload);
  const [open, setOpen] = useState<Item<StarD> | null>(null);
  const pos = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return { x: 6 + (h % 88), y: 8 + ((h >> 8) % 70) }; };
  return (
    <div className="observatory">
      <OwnerBar><button className="btn small" onClick={() => ed.add({ category: 'Dream', status: 'Someday' })}>+ Place a new star</button></OwnerBar>
      <div className="night-sky" role="list" aria-label="Stars: dreams, curiosities and plans">
        {Array.from({ length: 60 }, (_, i) => <i key={i} className="tiny-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 7) * -0.8}s` }} />)}
        {(stars.data ?? []).map((s) => {
          const p = pos(s.id);
          return (
            <button key={s.id} role="listitem" className={`wish-star cat-${(s.data.category ?? '').toLowerCase()} ${s.data.status === 'Came true' ? 'came-true' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setOpen(s)}>
              <span aria-hidden>✦</span><span className="wish-label">{s.data.title}</span>
            </button>
          );
        })}
        {!stars.loading && (stars.data?.length ?? 0) === 0 && <p className="sky-empty hand">{owner ? 'The sky is clear — place your first star.' : 'A clear night. No stars charted yet.'}</p>}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.data.title ?? ''}>
        {open && <div><p className="smallcaps">{open.data.category} · {open.data.status}</p><Prose text={open.data.description} />{open.data.link && <a href={open.data.link} target="_blank" rel="noopener noreferrer">{hostOf(open.data.link)} ↗</a>}
          {owner && <div className="form-actions"><VisBadge v={open.visibility} /><button className="btn small" onClick={() => { ed.edit(open); setOpen(null); }}>Edit</button></div>}</div>}
      </Modal>
      {ed.modal}
    </div>
  );
}

// ───────────── Secret Garden ─────────────
interface SecretD { title: string; message?: string; link?: string }
export function SecretRoom({ room }: P) {
  const { owner, soundOn } = useStore();
  const secrets = useItems<SecretD>('secret', room.id);
  const ed = useEditor('secret', room.id, secrets.reload);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  return (
    <div className="secret-garden">
      <OwnerBar><button className="btn small" onClick={() => ed.add()}>+ Hide a secret</button><span className="muted">This room is unlisted: only people who find the bunny (or have the link) get here.</span></OwnerBar>
      <div className="secret-beds">
        {(secrets.data ?? []).map((s, i) => {
          const isOpen = opened.has(s.id);
          return (
            <div key={s.id} className={`secret-spot ${isOpen ? 'open' : ''}`} style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }}>
              <button onClick={() => { setOpened(new Set([...opened, s.id])); chime(soundOn, [988, 1319]); }} aria-expanded={isOpen}>
                <span aria-hidden>{isOpen ? '❀' : '❦'}</span> {s.data.title}
              </button>
              {isOpen && <p className="hand">{s.data.message} {s.data.link && <a href={s.data.link} target="_blank" rel="noopener noreferrer">↗</a>}</p>}
              {owner && <button className="btn small ghost" onClick={() => ed.edit(s)}>Edit</button>}
            </div>
          );
        })}
      </div>
      {ed.modal}
    </div>
  );
}

// ───────────── Collection (e.g. the Webring Well) ─────────────
interface LinkD { url: string; title?: string; description?: string; category?: string; image?: string }
export function CollectionRoom({ room }: P) {
  const { owner } = useStore();
  const links = useItems<LinkD>('link', room.id);
  const ed = useEditor('link', room.id, links.reload);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const all = links.data ?? [];
  const cats = [...new Set(all.map((l) => l.data.category).filter(Boolean))] as string[];
  const list = all.filter((l) => (!cat || l.data.category === cat) && (!q || JSON.stringify(l.data).toLowerCase().includes(q.toLowerCase())));
  const wander = () => { const pick = list[Math.floor(Math.random() * list.length)]; if (pick) window.open(pick.data.url, '_blank', 'noopener'); };
  return (
    <div className="collection">
      <OwnerBar><button className="btn small" onClick={() => ed.add()}>+ Add a link</button></OwnerBar>
      <div className="row wrap gap filters">
        <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>everything</button>
        {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        <input className="input search-input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search this collection" />
        {list.length > 0 && <button className="btn small" onClick={wander}>🪙 Toss a coin (random visit)</button>}
      </div>
      {links.loading && <Loading />}
      {!links.loading && list.length === 0 && <Empty title="Nothing in the well yet" art="🪙" />}
      <div className="tickets">
        {list.map((l, i) => (
          <div key={l.id} className="ticket" style={{ ['--tilt' as any]: `${(i % 4) - 1.5}deg` }}>
            <a href={l.data.url} target="_blank" rel="noopener noreferrer">
              {l.data.image && <img src={l.data.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
              <span className="smallcaps">{l.data.category ?? hostOf(l.data.url)}</span>
              <strong className="script">{l.data.title || hostOf(l.data.url)}</strong>
              <small>{l.data.description}</small>
              <span className="ticket-host">{hostOf(l.data.url)} ↗</span>
            </a>
            {owner && <button className="btn small ghost" onClick={() => ed.edit(l)}>Edit</button>}
          </div>
        ))}
      </div>
      {ed.modal}
    </div>
  );
}

// ───────────── Freeform room ─────────────
export function FreeformRoom({ room }: P) {
  const { owner } = useStore();
  const objs = room.scene ?? [];
  return (
    <div className="freeform">
      <OwnerBar><Link className="btn small" to={`/atelier/room/${room.id}`}>Arrange this room in the Atelier</Link></OwnerBar>
      {objs.length === 0 ? <Empty title="An empty, sunlit room" art="✧">{owner ? 'Open the Atelier to place furniture, images, text and links.' : 'Nothing has been arranged here yet.'}</Empty> : (
        <div className="freeform-stage" style={{ background: room.sceneBackground }}>
          <Scene width={1200} height={750} objects={objs} ariaLabel={room.name} showLabels="always"
            background={room.settings?.interior ? <InteriorBackground interior={room.settings.interior} /> : <rect width={1200} height={750} fill={room.sceneBackground ? 'transparent' : 'var(--c-cream)'} />}
            onActivate={(o) => { if (o.href) (o.href.startsWith('/') ? (window.location.href = o.href) : window.open(o.href, '_blank', 'noopener')); }} />
        </div>
      )}
    </div>
  );
}
