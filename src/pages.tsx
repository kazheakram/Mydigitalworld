import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Item } from '../shared/types';
import { useStore } from './lib/store';
import { api } from './lib/api';
import { hostOf } from './lib/util';
import { TopNav } from './ui/Nav';
import { BowIcon, Empty, Field, Loading, VisBadge } from './ui/kit';
import { titleOf } from './rooms/schema';
import { quickSave } from './private/inboxLogic';

export function LoginPage() {
  const { needsSetup, refresh, owner } = useStore();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (owner) nav('/dollhouse'); }, [owner, nav]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api('POST', needsSetup ? '/api/auth/setup' : '/api/auth/login', needsSetup ? { code: code.trim(), password: pw } : { password: pw });
      await refresh();
      nav('/dollhouse');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="page login-page">
      <div className="ribbon-curtain left" aria-hidden /><div className="ribbon-curtain right" aria-hidden />
      <main className="page-main narrow">
        <form className="paper-sheet login-card" onSubmit={submit}>
          <BowIcon size={70} />
          <h1 className="script">{needsSetup ? 'Make this world yours' : 'The private wing'}</h1>
          <p className="smallcaps">{needsSetup ? 'first-time setup' : 'only the owner may pass'}</p>
          {needsSetup && (
            <Field label="Setup code" hint="It was printed in the terminal (or server log) when the site started. Or set OWNER_PASSWORD before starting.">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required />
            </Field>
          )}
          <Field label={needsSetup ? 'Choose a password (8+ characters)' : 'Password'}>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={needsSetup ? 'new-password' : 'current-password'} required minLength={needsSetup ? 8 : 1} autoFocus />
          </Field>
          {err && <p className="error-note" role="alert">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Untying the ribbon…' : needsSetup ? 'Open the door' : 'Step inside'}</button>
          <Link to="/" className="back-link">← back to the village</Link>
        </form>
      </main>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { book: 'Book', entry: 'Journal page', artwork: 'Artwork', music: 'Record', note: 'Garden note', bookmark: 'Bookmark', inbox: 'Letterbox', expedition: 'Expedition', link: 'Link', drink: 'Café', star: 'Star', secret: 'Secret', todo: 'To-do', guestbook: 'Letter' };

export function SearchPage() {
  const { owner, world } = useStore();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [kind, setKind] = useState<string | null>(null);
  const [res, setRes] = useState<{ items: Item[]; rooms: any[]; entries: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = params.get('q') ?? '';
    if (term.length < 2) { setRes(null); return; }
    setLoading(true);
    api('GET', `/api/search?q=${encodeURIComponent(term)}`).then(setRes).finally(() => setLoading(false));
  }, [params, owner]);
  const hrefFor = (it: Item) => {
    if (it.kind === 'inbox') return '/dollhouse/inbox';
    if (it.kind === 'bookmark') return '/dollhouse/bookmarks';
    if (it.kind === 'expedition') return '/stargirl/rabbit-holes';
    if (it.kind === 'todo') return '/dollhouse';
    if ((it.kind === 'entry' || it.kind === 'note') && it.roomId) return `/room/${it.roomId}/${it.id}`;
    if (it.roomId) return `/room/${it.roomId}`;
    return '/';
  };
  const kinds = [...new Set((res?.items ?? []).map((i) => i.kind))];
  const items = (res?.items ?? []).filter((i) => !kind || i.kind === kind);
  return (
    <div className="page">
      <header className="page-header"><Link to="/" className="back-link">← the village</Link><TopNav /></header>
      <main className="page-main narrow" id="main">
        <div className="paper-sheet">
          <h1 className="script page-title">Search {world.name}</h1>
          <form onSubmit={(e) => { e.preventDefault(); setParams({ q }); }} className="quick-add">
            <label className="sr-only" htmlFor="search">Search</label>
            <input id="search" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="books, pages, links, notes…" autoFocus />
            <button className="btn">Search</button>
          </form>
          <p className="muted">{owner ? 'Searching everything, including private things (only you see those).' : 'Searching everything that is public.'}</p>
          {loading && <Loading what="Looking under every stone" />}
          {res && (
            <>
              {kinds.length > 1 && <div className="row wrap gap"><button className={`chip ${!kind ? 'on' : ''}`} onClick={() => setKind(null)}>all</button>{kinds.map((k) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{KIND_LABEL[k] ?? k}</button>)}</div>}
              {res.rooms.length > 0 && !kind && <ul className="search-results">{res.rooms.map((r) => <li key={r.id}><span className="smallcaps">place</span> <Link to={`/room/${r.id}`}>{r.name}</Link></li>)}</ul>}
              <ul className="search-results">
                {items.map((it) => (
                  <li key={it.id}>
                    <span className="smallcaps">{KIND_LABEL[it.kind] ?? it.kind}</span> <Link to={hrefFor(it)}>{titleOf(it.kind, it.data)}</Link> {owner && <VisBadge v={it.visibility} />}
                  </li>
                ))}
                {!kind && res.entries.map((e: any) => <li key={e.id}><span className="smallcaps">from {e.feed_title}</span> <a href={e.link} target="_blank" rel="noopener noreferrer">{e.title}</a></li>)}
              </ul>
              {items.length + res.rooms.length + res.entries.length === 0 && <Empty title="Nothing found" art="🔍">Try another word.</Empty>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** Target of the PWA "share" sheet (Android) and of the bookmarklet: saves straight to the letterbox. */
export function SharePage() {
  const { owner, ready, world } = useStore();
  const [params] = useSearchParams();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState('');
  const text = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ').trim();
  useEffect(() => {
    if (!ready || !owner || !text || state !== 'idle') return;
    setState('saving');
    const url = params.get('url') || text.match(/https?:\/\/\S+/)?.[0];
    quickSave(url ?? text, world.inbox.cooldownHours, { title: params.get('title') ?? undefined, note: url && params.get('text') !== url ? params.get('text') ?? undefined : undefined, source: 'shared' })
      .then(() => setState('saved'), (e) => { setErr(e.message); setState('error'); });
  }, [ready, owner, text]); // eslint-disable-line
  return (
    <div className="page"><main className="page-main narrow">
      <div className="paper-sheet center">
        <BowIcon size={60} />
        {!ready ? <Loading /> : !owner ? <><p className="script big">Please sign in first</p><Link className="btn" to="/login">Sign in</Link></>
          : !text ? <p>Nothing was shared.</p>
          : state === 'saved' ? <><p className="script big">Tucked into your letterbox ✉</p><p className="muted">{hostOf(text) || text.slice(0, 80)}</p><Link className="btn" to="/dollhouse/inbox">Open the letterbox</Link></>
          : state === 'error' ? <p className="error-note">{err}</p> : <Loading what="Saving" />}
      </div>
    </main></div>
  );
}

export function NotFound() {
  return <div className="page"><header className="page-header"><TopNav /></header><main className="page-main narrow"><Empty title="You've wandered off the map" art="🗺"><Link to="/">Back to the village</Link></Empty></main></div>;
}
