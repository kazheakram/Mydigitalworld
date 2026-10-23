import { useState, type FormEvent } from 'react';
import type { Feed } from '../../shared/types';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { hostOf, timeAgo } from '../lib/util';
import { Empty, ErrorNote, Field, Loading, Modal, useAsync } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';
import { quickSave } from './inboxLogic';

// The Glass Conservatory: an RSS/Atom reader. Chronological, never algorithmic.

export interface Entry { id: string; feedId: string; feedTitle: string; category: string; title: string; link: string; published: string | null; summary: string; image: string | null; read: boolean; saved: boolean }
type FeedRow = Feed & { unread: number };
const CATEGORIES = ['Books & Literature', 'Writing & Creativity', 'Academics & Learning', 'Design & Inspiration', 'Music & Culture', 'Internet Discoveries', 'Personal Interests'];

export function ConservatoryPage() {
  const { toast, world } = useStore();
  const feeds = useAsync<FeedRow[]>(() => api('GET', '/api/feeds'), []);
  const [feedId, setFeedId] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'saved'>('all');
  const entries = useAsync<Entry[]>(() => api('GET', `/api/feed-entries?${new URLSearchParams({ ...(feedId ? { feedId } : {}), ...(cat ? { category: cat } : {}), filter })}`), [feedId, cat, filter]);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [manage, setManage] = useState<FeedRow | null>(null);
  const list = feeds.data ?? [];
  const cats = [...new Set([...list.map((f) => f.category)])];
  const lastFetched = list.map((f) => f.lastFetched).filter(Boolean).sort().pop();

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api('POST', '/api/feeds/refresh', { force: true });
      const failed = r.results.filter((x: any) => x.error).length;
      setLastRefresh(r.refreshedAt);
      toast(failed ? `Refreshed — ${failed} feed${failed > 1 ? 's' : ''} couldn't be reached.` : 'All feeds refreshed ♡');
      feeds.reload(); entries.reload();
    } finally { setRefreshing(false); }
  };
  const mark = async (e: Entry, patch: Partial<Pick<Entry, 'read' | 'saved'>>) => {
    await api('PATCH', `/api/feed-entries/${e.id}`, patch);
    entries.set((entries.data ?? []).map((x) => (x.id === e.id ? { ...x, ...patch } : x)));
    if ('read' in patch) feeds.reload();
  };
  const toLetterbox = async (e: Entry) => {
    await quickSave(e.link, 0, { title: e.title, description: e.summary, image: e.image ?? undefined, status: 'later', source: e.feedTitle });
    toast('Sent to your read & watch later pile ♡');
  };
  const importOpml = async (f?: File | null) => {
    if (!f) return;
    const r = await api('POST', '/api/feeds/opml', await f.text(), { 'content-type': 'text/xml' });
    toast(`Imported ${r.added} subscriptions. Press refresh to fetch them.`); feeds.reload();
  };

  return (
    <ModeShell mode="private">
      <SectionTitle title="Favorites" sub="the creators I love · newest first, never an algorithm" />
      <div className="conservatory">
        <aside className="feed-list lace-card" aria-label="Subscriptions">
          <button className="btn small" onClick={() => setAdding(true)}>+ Follow someone</button>
          <button className={`drawer ${!feedId && !cat ? 'on' : ''}`} onClick={() => { setFeedId(null); setCat(null); }}>Everything <span>{list.reduce((n, f) => n + f.unread, 0)}</span></button>
          {cats.map((c) => (
            <div key={c} className="feed-cat">
              <button className={`drawer cat ${cat === c && !feedId ? 'on' : ''}`} onClick={() => { setCat(c); setFeedId(null); }}>{c}</button>
              {list.filter((f) => f.category === c).map((f) => (
                <div key={f.id} className="feed-row">
                  <button className={`drawer sub ${feedId === f.id ? 'on' : ''}`} onClick={() => { setFeedId(f.id); setCat(null); }} title={f.lastError ? `Couldn't reach: ${f.lastError}` : f.url}>
                    {f.lastError ? '⚠ ' : ''}{f.title} <span>{f.unread || ''}</span>
                  </button>
                  <button className="icon-btn tiny" aria-label={`Manage ${f.title}`} onClick={() => setManage(f)}>⋯</button>
                </div>
              ))}
            </div>
          ))}
          <div className="feed-tools">
            <label className="linkish">Import OPML<input type="file" accept=".opml,.xml,text/xml" hidden onChange={(e) => importOpml(e.target.files?.[0])} /></label>
            {' · '}<a className="linkish" href="/api/feeds/opml">Export OPML</a>
          </div>
        </aside>
        <section className="feed-entries">
          <div className="row wrap gap filters">
            {(['all', 'unread', 'saved'] as const).map((f) => <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
            <button className="btn small" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>
            <button className="btn small ghost" onClick={async () => { await api('POST', '/api/feed-entries/mark-all-read', feedId ? { feedId } : {}); entries.reload(); feeds.reload(); }}>Mark all read</button>
            <span className="muted">last updated {timeAgo(lastRefresh ?? lastFetched) || 'never'}</span>
          </div>
          {feeds.loading || entries.loading ? <Loading what="Opening the glasshouse" /> : null}
          {entries.error && <ErrorNote msg={entries.error} retry={entries.reload} />}
          {!feeds.loading && list.length === 0 && (
            <Empty title="No one to follow yet" art="❦">
              Follow a blog, a Substack, a podcast or a YouTube channel. Paste its website address and the reader finds its feed when one exists.
            </Empty>
          )}
          {!entries.loading && list.length > 0 && (entries.data?.length ?? 0) === 0 && <Empty title={filter === 'unread' ? 'All caught up ♡' : 'Nothing here yet'} art="☕" />}
          <ol className="entries">
            {(entries.data ?? []).map((e) => (
              <li key={e.id} className={`entry-card ${e.read ? 'read' : ''}`}>
                {e.image && <img src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                <div>
                  <p className="smallcaps">{e.feedTitle} · {e.published ? timeAgo(e.published) : 'undated'}</p>
                  <h3><a href={e.link} target="_blank" rel="noopener noreferrer" onClick={() => !e.read && mark(e, { read: true })}>{e.title}</a></h3>
                  {e.summary && <p className="muted">{e.summary.slice(0, 220)}{e.summary.length > 220 ? '…' : ''}</p>}
                  <div className="row wrap gap">
                    <button className="btn small ghost" onClick={() => mark(e, { read: !e.read })}>{e.read ? 'Mark unread' : 'Mark read'}</button>
                    <button className={`btn small ${e.saved ? '' : 'ghost'}`} onClick={() => mark(e, { saved: !e.saved })}>{e.saved ? '♥ Saved' : '♡ Save'}</button>
                    <button className="btn small ghost" onClick={() => toLetterbox(e)}>Read later</button>
                    <span className="muted">{hostOf(e.link)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <AddFeed open={adding} onClose={() => setAdding(false)} onAdded={() => { feeds.reload(); entries.reload(); }} categories={[...new Set([...CATEGORIES, ...cats])]} />
      <ManageFeed feed={manage} onClose={() => { setManage(null); feeds.reload(); entries.reload(); }} categories={[...new Set([...CATEGORIES, ...cats])]} />
      <span hidden>{world.name}</span>
    </ModeShell>
  );
}

function AddFeed({ open, onClose, onAdded, categories }: { open: boolean; onClose: () => void; onAdded: () => void; categories: string[] }) {
  const { toast } = useStore();
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const f = await api('POST', '/api/feeds', { url, category });
      toast(`Now following ${f.title} ♡ (${f.added} posts)`); setUrl(''); onAdded(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Follow a new creator">
      <form className="item-form" onSubmit={submit}>
        <Field label="Website, feed or YouTube channel address" hint={<>Works with RSS/Atom feeds, most blogs and Substacks (e.g. <code>name.substack.com</code>), podcasts, and YouTube channel links that contain <code>/channel/UC…</code> or a playlist. Sites without a feed can be saved as bookmarks instead.</>}>
          <input className="input" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
        </Field>
        <Field label="Category"><input className="input" list="feed-cats" value={category} onChange={(e) => setCategory(e.target.value)} /><datalist id="feed-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
        {err && <p className="error-note" role="alert">{err}</p>}
        <div className="form-actions"><button className="btn" disabled={busy}>{busy ? 'Looking for the feed…' : 'Follow'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function ManageFeed({ feed, onClose, categories }: { feed: FeedRow | null; onClose: () => void; categories: string[] }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [k, setK] = useState<string | null>(null);
  if (feed && k !== feed.id) { setK(feed.id); setTitle(feed.title); setCategory(feed.category); }
  if (!feed) return null;
  return (
    <Modal open onClose={onClose} title="Subscription">
      <div className="item-form">
        <Field label="Name"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Category"><input className="input" list="feed-cats2" value={category} onChange={(e) => setCategory(e.target.value)} /><datalist id="feed-cats2">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <p className="muted">Feed: {feed.url}{feed.lastError ? <><br />⚠ Last refresh failed: {feed.lastError}</> : null}</p>
        <div className="form-actions">
          <button className="btn" onClick={async () => { await api('PATCH', `/api/feeds/${feed.id}`, { title, category }); onClose(); }}>Save</button>
          <button className="btn danger" onClick={async () => { if (confirm(`Unfollow ${feed.title}? Saved posts from it will be removed too.`)) { await api('DELETE', `/api/feeds/${feed.id}`); onClose(); } }}>Unfollow</button>
        </div>
      </div>
    </Modal>
  );
}
