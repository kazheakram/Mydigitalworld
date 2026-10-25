import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DashboardWidget, Item } from '../../shared/types';
import { useStore } from '../lib/store';
import { api, items as itemsApi } from '../lib/api';
import { hostOf, timeAgo, uid } from '../lib/util';
import { Polaroid, Tag, useAsync } from '../ui/kit';
import { useItems } from '../rooms/common';
import { FEATURE_BY_ID, NOT_YET_BUILT, featureMode } from '../../shared/features';
import { ModeShell } from './Shell';
import { Vignette } from './Vignette';
import { QuickAdd } from './Letterbox';
import { isResting, reminderDue, type InboxData } from './inboxLogic';
import type { Entry } from './Conservatory';

// Dollhouse Mode home: the private sanctuary. Polaroid doors to each section, then the
// customisable widget dashboard — drag to rearrange, resize, hide, or add from the library.

/** The polaroid doors on the Dollhouse home. Optional ones follow their feature's on/hidden/off. */
export const DOLLHOUSE_CARDS: { title: string; caption: string; to: string; v: string; feature?: string }[] = [
  { title: 'Inbox', caption: 'messages · replies · notes', to: '/dollhouse/inbox', v: 'inbox', feature: 'letterbox' },
  { title: 'Reading Room', caption: 'books · essays · articles', to: '/dollhouse/reading', v: 'reading' },
  { title: 'Diary', caption: 'personal notes · daydreams', to: '/dollhouse/diary', v: 'diary' },
  { title: 'Bookmarks', caption: 'saved links · places · ideas', to: '/dollhouse/bookmarks', v: 'bookmarks', feature: 'cabinet' },
  { title: 'Favorites', caption: 'creators I love', to: '/dollhouse/favorites', v: 'favorites', feature: 'reader' },
  { title: 'Theme Closet', caption: 'themes · wallpapers · extras', to: '/atelier/theme', v: 'closet' },
  { title: 'My Bedroom', caption: 'a dollhouse room to decorate', to: '/dollhouse/bedroom', v: 'bedroom', feature: 'bedroom' },
  { title: 'Companions', caption: 'bunnies · fawns · kittens · swans', to: '/dollhouse/pets', v: 'pets', feature: 'pets' },
  { title: 'Morning Paper', caption: 'today’s edition', to: '/dollhouse/newspaper', v: 'newspaper', feature: 'newspaper' },
  { title: 'Video Parlour', caption: 'channels · saved videos', to: '/dollhouse/parlour', v: 'parlour', feature: 'parlour' },
  { title: 'Reading Journal', caption: 'history · wrap-ups', to: '/dollhouse/reading-journal', v: 'journal', feature: 'readingJournal' },
  { title: 'Commonplace Book', caption: 'words worth keeping', to: '/dollhouse/commonplace', v: 'commonplace', feature: 'commonplace' },
  { title: 'Scrapbook', caption: 'pages of little things', to: '/dollhouse/scrapbook', v: 'scrapbook', feature: 'scrapbook' },
  { title: 'Letters', caption: 'stationery · seals', to: '/dollhouse/letters', v: 'letters', feature: 'letters' },
  { title: 'Time Capsules', caption: 'for a future day', to: '/dollhouse/capsules', v: 'capsules', feature: 'capsules' },
  { title: 'Charms', caption: 'pearls · achievements', to: '/dollhouse/charms', v: 'charms', feature: 'pearls' },
];
const WIDGET_FEATURE: Record<string, string> = {
  inbox: 'letterbox', 'quick-add': 'letterbox', feeds: 'reader', 'watch-later': 'cabinet', favorites: 'cabinet', discoveries: 'stargirl', expeditions: 'stargirl',
};

export const WIDGET_LIBRARY: { type: string; title: string; about: string }[] = [
  { type: 'current-reads', title: 'On my nightstand', about: 'Books on your currently-reading shelf' },
  { type: 'inbox', title: 'Unopened letters', about: 'What is waiting in the letterbox' },
  { type: 'feeds', title: 'Fresh from my creators', about: 'Newest posts from your RSS subscriptions' },
  { type: 'watch-later', title: 'Watch later', about: 'Bookmarks in one collection, shown as little TVs' },
  { type: 'journal', title: 'Latest pages', about: 'Your newest diary pages' },
  { type: 'favorites', title: 'Cabinet favourites', about: 'Bookmarks you marked with a heart' },
  { type: 'todo', title: 'Little to-dos', about: 'A small checklist' },
  { type: 'projects', title: 'Growing projects', about: 'Garden notes still growing & art in progress' },
  { type: 'discoveries', title: 'Recent discoveries', about: 'Things saved on your expeditions' },
  { type: 'expeditions', title: 'Expeditions', about: 'Your exploration history' },
  { type: 'quick-add', title: 'Vanity desk', about: 'A quick-save box for links & ideas' },
  { type: 'note', title: 'A note to myself', about: 'A little paper note you can write on' },
];

export function DollhousePage() {
  const { world, updateWorld, appearance } = useStore();
  const nav = useNavigate();
  const widgetOn = (type: string) => { const f = WIDGET_FEATURE[type]; return !f || featureMode(world, f) === 'on'; };
  const copy = world.modes.private;
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const widgets = world.dashboard;
  const setWidgets = (w: DashboardWidget[]) => updateWorld((x) => ({ ...x, dashboard: w }));
  const move = (id: string, to: number) => {
    const list = widgets.filter((w) => w.id !== id);
    list.splice(to, 0, widgets.find((w) => w.id === id)!);
    setWidgets(list);
  };
  const patch = (id: string, p: Partial<DashboardWidget>) => setWidgets(widgets.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const cards = DOLLHOUSE_CARDS.filter((c) => !c.feature || (featureMode(world, c.feature) === 'on' && !NOT_YET_BUILT.has(c.feature)))
    .filter((c) => !(appearance === 'quiet' && c.feature && FEATURE_BY_ID.get(c.feature)?.quietHides));
  return (
    <ModeShell mode="private">
      <div className="collage-hero">
        <div className="collage-side left hide-narrow decor-only">
          {copy.notes[1] && <Tag tilt={-6}>{copy.notes[1]}</Tag>}
          {copy.notes[2] && <Tag tilt={4}>{copy.notes[2]}</Tag>}
        </div>
        <div className="torn-card welcome-torn">
          <p className="smallcaps">welcome to</p>
          <h2 className="script">{copy.title}</h2>
          <p className="smallcaps soft">“a personal space for quieter days, gentler thoughts, and things I love.”</p>
          {featureMode(world, 'letterbox') === 'on' && <QuickAdd compact />}
        </div>
        <div className="collage-side right hide-narrow decor-only">
          {copy.notes[3] && <Tag tilt={5}>{copy.notes[3]}</Tag>}
          <Link to="/" className="paper-tag link-tag" style={{ ['--tilt' as any]: '-3deg' }}><span className="hand">back out to the village ↩</span></Link>
        </div>
      </div>
      <div className="polaroid-row">
        {cards.map((c, i) => <Polaroid key={c.title} title={c.title} caption={c.caption} tilt={(i % 2 ? 1.5 : -1.5)} onClick={() => nav(c.to)}><Vignette kind={c.v} /></Polaroid>)}
      </div>

      <div className="dash-head">
        <h2 className="script">My little room</h2>
        <button className="btn small ghost" onClick={() => setEditing(!editing)} aria-pressed={editing}>{editing ? 'Done arranging' : 'Arrange widgets'}</button>
      </div>
      {editing && (
        <div className="widget-library lace-card" aria-label="Widget library">
          <span className="smallcaps">add a widget:</span>
          {WIDGET_LIBRARY.map((w) => (
            <button key={w.type} className="chip" title={w.about} onClick={() => setWidgets([...widgets, { id: uid('w-'), type: w.type, title: w.title, size: 'small', options: w.type === 'watch-later' ? { collection: 'Watch Later' } : {} }])}>+ {w.title}</button>
          ))}
          {widgets.some((w) => w.hidden) && <span className="muted">Hidden: {widgets.filter((w) => w.hidden).map((w) => <button key={w.id} className="linkish" onClick={() => patch(w.id, { hidden: false })}>{w.title}</button>)}</span>}
        </div>
      )}
      <div className="dashboard">
        {widgets.filter((w) => (editing || !w.hidden) && widgetOn(w.type)).map((w, i) => (
          <div key={w.id} className={`widget size-${w.size} ${w.hidden ? 'is-hidden' : ''} ${editing ? 'editing' : ''}`}
            draggable={editing} onDragStart={() => setDrag(w.id)} onDragOver={(e) => editing && e.preventDefault()} onDrop={() => { if (drag && drag !== w.id) move(drag, i); setDrag(null); }}>
            <div className="widget-frame">
              <header>
                {editing ? <input className="input widget-title-input" value={w.title} onChange={(e) => patch(w.id, { title: e.target.value })} aria-label="Widget title" /> : <h3 className="script">{w.title}</h3>}
                {editing && (
                  <div className="widget-tools">
                    <button className="icon-btn tiny" aria-label="Move earlier" onClick={() => move(w.id, Math.max(0, i - 1))}>←</button>
                    <button className="icon-btn tiny" aria-label="Move later" onClick={() => move(w.id, i + 1)}>→</button>
                    <button className="icon-btn tiny" aria-label="Change size" onClick={() => patch(w.id, { size: w.size === 'small' ? 'medium' : w.size === 'medium' ? 'large' : 'small' })}>⤢</button>
                    <button className="icon-btn tiny" aria-label={w.hidden ? 'Show' : 'Hide'} onClick={() => patch(w.id, { hidden: !w.hidden })}>{w.hidden ? '◌' : '◉'}</button>
                    <button className="icon-btn tiny" aria-label="Remove widget" onClick={() => setWidgets(widgets.filter((x) => x.id !== w.id))}>✕</button>
                  </div>
                )}
              </header>
              {editing && w.type === 'watch-later' && <input className="input" value={w.options?.collection ?? ''} onChange={(e) => patch(w.id, { options: { ...w.options, collection: e.target.value } })} aria-label="Collection to show" placeholder="Collection name" />}
              <div className="widget-body"><WidgetBody w={w} onNote={(text) => patch(w.id, { options: { ...w.options, text } })} /></div>
            </div>
          </div>
        ))}
      </div>
    </ModeShell>
  );
}

const More = ({ to, children = 'open →' }: { to: string; children?: ReactNode }) => <Link className="widget-more smallcaps" to={to}>{children}</Link>;

function WidgetBody({ w, onNote }: { w: DashboardWidget; onNote: (t: string) => void }) {
  switch (w.type) {
    case 'current-reads': return <CurrentReads />;
    case 'inbox': return <InboxPile />;
    case 'feeds': return <FeedsWidget />;
    case 'watch-later': return <BookmarkWidget filter={(b) => b.data.collection === (w.options?.collection ?? 'Watch Later')} tv />;
    case 'favorites': return <BookmarkWidget filter={(b) => !!b.data.favorite} />;
    case 'journal': return <JournalWidget />;
    case 'todo': return <TodoWidget />;
    case 'projects': return <ProjectsWidget />;
    case 'discoveries': return <DiscoveriesWidget />;
    case 'expeditions': return <ExpeditionsWidget />;
    case 'quick-add': return <QuickAdd compact />;
    case 'note': return <textarea className="input hand-input paper-note" rows={4} defaultValue={w.options?.text ?? ''} onBlur={(e) => onNote(e.target.value)} aria-label="Note to myself" />;
    default: return <p className="muted">This widget type isn't available.</p>;
  }
}

function CurrentReads() {
  const books = useItems<any>('book');
  const list = (books.data ?? []).filter((b) => /current|reading/i.test(b.data.shelf ?? ''));
  return (
    <>
      <div className="mini-shelf">
        {list.slice(0, 7).map((b) => <span key={b.id} className="mini-book" style={{ background: b.data.color ?? 'var(--c-rose)' }} title={b.data.title}><span>{b.data.title}</span></span>)}
        {list.length === 0 && <p className="muted hand">Nothing on the nightstand.</p>}
      </div>
      {list[0]?.data.pages && <p className="muted">{list[0].data.title}: {Math.round(((list[0].data.pagesRead ?? 0) / list[0].data.pages) * 100)}% read</p>}
      <More to="/dollhouse/reading" />
    </>
  );
}
function InboxPile() {
  const inbox = useItems<InboxData>('inbox');
  const all = inbox.data ?? [];
  const waiting = all.filter((i) => i.data.status === 'new' && !isResting(i.data));
  const resting = all.filter((i) => isResting(i.data)).length;
  const due = all.filter((i) => reminderDue(i.data)).length;
  return (
    <>
      <div className="letter-pile" aria-label={`${waiting.length} unopened letters`}>
        {waiting.slice(0, 4).map((_, i) => <span key={i} className="pile-letter" style={{ ['--i' as any]: i }} />)}
        <span className="pile-count script">{waiting.length}</span>
      </div>
      <ul className="queue small">{waiting.slice(0, 3).map((i) => <li key={i.id}>{i.data.title || i.data.content.slice(0, 50)}</li>)}</ul>
      <p className="muted">{resting > 0 && `${resting} resting · `}{due > 0 && `⏰ ${due} reminder${due > 1 ? 's' : ''} due`}</p>
      <More to="/dollhouse/inbox" />
    </>
  );
}
function FeedsWidget() {
  const entries = useAsync<Entry[]>(() => api('GET', '/api/feed-entries?filter=unread&limit=6'), []);
  return (
    <>
      {(entries.data ?? []).length === 0 && <p className="muted hand">{entries.loading ? 'Opening the glasshouse…' : 'All caught up, or no subscriptions yet.'}</p>}
      <ul className="queue small">{(entries.data ?? []).map((e) => <li key={e.id}><a href={e.link} target="_blank" rel="noopener noreferrer">{e.title}</a> <span className="muted">· {e.feedTitle} · {timeAgo(e.published)}</span></li>)}</ul>
      <More to="/dollhouse/favorites" />
    </>
  );
}
function BookmarkWidget({ filter, tv }: { filter: (b: Item<any>) => boolean; tv?: boolean }) {
  const bms = useItems<any>('bookmark');
  const list = (bms.data ?? []).filter(filter);
  return (
    <>
      {list.length === 0 && <p className="muted hand">{bms.loading ? '…' : 'Nothing here yet.'}</p>}
      <div className={tv ? 'tv-row' : 'curio-row'}>
        {list.slice(0, 6).map((b) => (
          <a key={b.id} className={tv ? 'mini-tv' : 'curio'} href={b.data.url} target="_blank" rel="noopener noreferrer" title={b.data.title}>
            {tv ? <span className="tv-screen">{b.data.image ? <img src={b.data.image} alt="" referrerPolicy="no-referrer" loading="lazy" /> : '▶'}</span> : null}
            <span className="curio-label">{b.data.title || hostOf(b.data.url)}</span>
          </a>
        ))}
      </div>
      <More to="/dollhouse/bookmarks" />
    </>
  );
}
function JournalWidget() {
  const entries = useItems<any>('entry');
  return <><ul className="queue small">{(entries.data ?? []).slice(0, 4).map((e) => <li key={e.id}><Link to={`/room/${e.roomId}/${e.id}`}>{e.data.title}</Link> <span className="muted">· {timeAgo(e.updatedAt)}</span></li>)}</ul>{(entries.data ?? []).length === 0 && <p className="muted hand">No pages yet.</p>}<More to="/dollhouse/diary" /></>;
}
function TodoWidget() {
  const todos = useItems<any>('todo');
  const [text, setText] = useState('');
  const add = async () => { if (!text.trim()) return; await itemsApi.create('todo', { text, done: false }); setText(''); todos.reload(); };
  return (
    <div className="todo">
      <ul>
        {(todos.data ?? []).slice().reverse().map((t) => (
          <li key={t.id} className={t.data.done ? 'done' : ''}>
            <label className="check"><input type="checkbox" checked={!!t.data.done} onChange={async () => { await itemsApi.update(t.id, { data: { done: !t.data.done } }); todos.reload(); }} /> {t.data.text}</label>
            <button className="icon-btn tiny" aria-label="Remove" onClick={async () => { await itemsApi.remove(t.id); todos.reload(); }}>✕</button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="row"><input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="a little task…" aria-label="New to-do" /><button className="btn small">+</button></form>
    </div>
  );
}
function ProjectsWidget() {
  const notes = useItems<any>('note');
  const art = useItems<any>('artwork');
  const list = [...(notes.data ?? []).filter((n) => n.data.stage === 'growing'), ...(art.data ?? []).filter((a) => a.data.status === 'In progress')];
  return <><ul className="queue small">{list.slice(0, 5).map((x) => <li key={x.id}><Link to={`/room/${x.roomId}${x.kind === 'note' ? `/${x.id}` : ''}`}>{x.data.title}</Link> <span className="muted">· {x.kind === 'note' ? 'growing note' : 'art in progress'}</span></li>)}</ul>{list.length === 0 && <p className="muted hand">Nothing growing right now.</p>}</>;
}
function DiscoveriesWidget() {
  const exps = useItems<any>('expedition');
  const disc = (exps.data ?? []).flatMap((e) => (e.data.discoveries ?? []).map((d: any) => ({ ...d, exp: e.data.title }))).sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
  return <><ul className="queue small">{disc.slice(0, 5).map((d: any) => <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.title || hostOf(d.url) || d.note}</a> <span className="muted">· {d.exp}</span></li>)}</ul>{disc.length === 0 && <p className="muted hand">No discoveries yet.</p>}<More to="/stargirl/discoveries" /></>;
}
function ExpeditionsWidget() {
  const exps = useItems<any>('expedition');
  const list = exps.data ?? [];
  const active = list.find((e) => !e.data.endedAt);
  return <>{active && <p><strong>Exploring now:</strong> {active.data.title}</p>}<ul className="queue small">{list.filter((e) => e.data.endedAt).slice(0, 4).map((e) => <li key={e.id}>{e.data.title} <span className="muted">· {(e.data.discoveries ?? []).length} finds</span></li>)}</ul>{list.length === 0 && <p className="muted hand">No expeditions yet.</p>}<More to="/stargirl/rabbit-holes">set out →</More></>;
}
