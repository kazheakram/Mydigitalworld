import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item } from '../../shared/types';
import { api, items as itemsApi } from '../lib/api';
import { useFeature } from '../lib/features';
import { isYoutubeFeed } from '../lib/liveWorld';
import { useStore } from '../lib/store';
import { embedUrl, timeAgo } from '../lib/util';
import { useItems } from '../rooms/common';
import { Empty, Field, Loading, Modal, useAsync } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';
import type { Entry } from './Conservatory';

// The Video Parlour: a vintage television for the YouTube channels you follow (their public
// feeds, through the reader) and the videos you keep. Saved videos are ordinary bookmarks in the
// "Video Parlour" collection, so they also appear in the Cabinet and in every backup.

export const PARLOUR_COLLECTION = 'Video Parlour';
export interface VideoData { url: string; title?: string; image?: string; collection?: string; description?: string; favorite?: boolean; watchLater?: boolean; playlist?: string; source?: string; watched?: boolean }

export const youtubeId = (url: string) => {
  try {
    const u = new URL(url); const h = u.hostname.replace(/^(www|m)\./, '');
    if (h === 'youtu.be') return u.pathname.slice(1) || null;
    if (h === 'youtube.com') return u.searchParams.get('v') ?? u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/)?.[2] ?? null;
  } catch { /* not a url */ }
  return null;
};
const thumb = (url: string) => { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined; };
const embedFor = (url: string) => { const id = youtubeId(url); return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : embedUrl(url); };

type Tab = 'channels' | 'later' | 'favorites' | 'all' | `pl:${string}`;

export function ParlourPage() {
  const { toast } = useStore();
  const yt = useFeature('youtubeFeeds');
  const feeds = useAsync<{ id: string; url: string; title: string }[]>(() => api('GET', '/api/feeds'), []);
  const ytFeeds = (feeds.data ?? []).filter((f) => isYoutubeFeed(f.url));
  const entries = useAsync<Entry[]>(() => api('GET', '/api/feed-entries?limit=300'), []);
  const bms = useItems<VideoData>('bookmark');
  const saved = (bms.data ?? []).filter((b) => b.data.collection === PARLOUR_COLLECTION);
  const playlists = [...new Set(saved.map((b) => b.data.playlist).filter(Boolean) as string[])].sort();
  const [tab, setTab] = useState<Tab>('channels');
  const [q, setQ] = useState('');
  const [playing, setPlaying] = useState<{ url: string; title: string; item?: Item<VideoData> } | null>(null);
  const [adding, setAdding] = useState('');
  const ytIds = new Set(ytFeeds.map((f) => f.id));
  const channelVideos = (entries.data ?? []).filter((e) => ytIds.has(e.feedId));
  const match = (s?: string) => !q || (s ?? '').toLowerCase().includes(q.toLowerCase());

  const shownSaved = useMemo(() => saved.filter((b) =>
    (tab === 'all' || (tab === 'later' && b.data.watchLater) || (tab === 'favorites' && b.data.favorite) || (tab.startsWith('pl:') && b.data.playlist === tab.slice(3)))
    && (match(b.data.title) || match(b.data.description) || match(b.data.source))), [saved, tab, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const keep = async (url: string, title: string, extra: Partial<VideoData> = {}) => {
    const existing = saved.find((b) => youtubeId(b.data.url) === youtubeId(url) || b.data.url === url);
    if (existing) { await itemsApi.update(existing.id, { data: extra }); bms.reload(); return existing; }
    const it = await itemsApi.create<VideoData>('bookmark', { url, title, image: thumb(url), collection: PARLOUR_COLLECTION, ...extra });
    bms.reload();
    return it;
  };
  const addByLink = async () => {
    const url = adding.trim();
    if (!/^https?:\/\//.test(url) || !embedFor(url)) { toast('Paste a YouTube video link (youtube.com/watch?v=… or youtu.be/…).'); return; }
    await keep(url, 'A saved video', { watchLater: true });
    setAdding(''); toast('Tucked into Watch Later ♡');
  };
  const patch = async (b: Item<VideoData>, data: Partial<VideoData>) => { await itemsApi.update(b.id, { data }); bms.reload(); };

  const TABS: [Tab, string][] = [['channels', 'Channels'], ['later', 'Watch later'], ['favorites', 'Favourites'], ['all', 'Everything saved'], ...playlists.map((p) => [`pl:${p}`, `▸ ${p}`] as [Tab, string])];

  return (
    <ModeShell mode="private">
      <SectionTitle title="The Video Parlour" sub="channels · saved videos · watch later" />
      <div className="parlour-bar row wrap gap">
        <div className="row wrap gap" role="tablist" aria-label="Parlour shelves">
          {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <input className="input parlour-search" type="search" placeholder="Search videos…" aria-label="Search videos" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="row wrap gap parlour-add">
        <input className="input" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Paste a YouTube link to save it…" aria-label="YouTube link to save" onKeyDown={(e) => e.key === 'Enter' && addByLink()} />
        <button className="btn small" onClick={addByLink}>Save video</button>
      </div>

      {tab === 'channels' && (
        <>
          {!yt.available && <p className="muted center">YouTube channel feeds are switched off in the Feature Manager, so only your saved videos are shown.</p>}
          {yt.available && (feeds.loading || entries.loading) && <Loading what="Warming up the valves" />}
          {yt.available && !feeds.loading && ytFeeds.length === 0 && (
            <Empty title="No channels yet" art="📺">Follow a YouTube channel in <Link to="/dollhouse/favorites">Favorites</Link> — paste its channel link — and its new videos will appear here.</Empty>
          )}
          {yt.available && (
            <div className="tv-grid">
              {channelVideos.filter((e) => match(e.title) || match(e.feedTitle)).slice(0, 60).map((e) => {
                const keptItem = saved.find((b) => youtubeId(b.data.url) === youtubeId(e.link));
                return (
                  <article key={e.id} className={`tv-card ${e.read ? 'is-read' : ''}`} aria-label={e.title}>
                    <button className="tv-screen" onClick={() => { setPlaying({ url: e.link, title: e.title, item: keptItem }); api('PATCH', `/api/feed-entries/${encodeURIComponent(e.id)}`, { read: true }).catch(() => {}); }} aria-label={`Play ${e.title}`}>
                      {(e.image || thumb(e.link)) && <img src={e.image || thumb(e.link)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(ev) => { ev.currentTarget.style.visibility = 'hidden'; }} />}
                      <span className="tv-play" aria-hidden>▶</span>
                    </button>
                    <p className="tv-title">{e.title}</p>
                    <p className="muted small">{e.feedTitle} · {timeAgo(e.published)}</p>
                    <div className="row wrap gap">
                      <button className="linkish" onClick={() => keep(e.link, e.title, { watchLater: true, source: e.feedTitle, image: e.image ?? thumb(e.link) }).then(() => toast('Saved for later ♡'))}>{keptItem?.data.watchLater ? 'in watch later ✓' : 'watch later'}</button>
                      <button className="linkish" onClick={() => keep(e.link, e.title, { favorite: true, source: e.feedTitle, image: e.image ?? thumb(e.link) }).then(() => toast('A favourite ♥'))}>♥</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab !== 'channels' && (
        <>
          {bms.loading && <Loading />}
          {!bms.loading && shownSaved.length === 0 && <Empty title="Nothing on this shelf" art="📼">Save videos from your channels, or paste a link above.</Empty>}
          <div className="tv-grid">
            {shownSaved.map((b) => (
              <article key={b.id} className={`tv-card ${b.data.watched ? 'is-read' : ''}`} aria-label={b.data.title || b.data.url}>
                <button className="tv-screen" onClick={() => setPlaying({ url: b.data.url, title: b.data.title || 'Video', item: b })} aria-label={`Play ${b.data.title || 'video'}`}>
                  {(b.data.image || thumb(b.data.url)) && <img src={b.data.image || thumb(b.data.url)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(ev) => { ev.currentTarget.style.visibility = 'hidden'; }} />}
                  <span className="tv-play" aria-hidden>▶</span>
                </button>
                <p className="tv-title">{b.data.title}</p>
                {b.data.description && <p className="muted small hand">“{b.data.description.slice(0, 90)}”</p>}
                <div className="row wrap gap">
                  <label className="check"><input type="checkbox" checked={!!b.data.watchLater} onChange={(e) => patch(b, { watchLater: e.target.checked })} /> later</label>
                  <label className="check"><input type="checkbox" checked={!!b.data.favorite} onChange={(e) => patch(b, { favorite: e.target.checked })} /> ♥</label>
                  <button className="linkish" onClick={() => itemsApi.remove(b.id).then(bms.reload)}>remove</button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title ?? ''} wide>
        {playing && <Player url={playing.url} title={playing.title} item={saved.find((b) => youtubeId(b.data.url) === youtubeId(playing.url)) ?? playing.item}
          playlists={playlists} onKeep={(extra) => keep(playing.url, playing.title, extra)} onPatch={patch} />}
      </Modal>
    </ModeShell>
  );
}

function Player({ url, title, item, playlists, onKeep, onPatch }: { url: string; title: string; item?: Item<VideoData>; playlists: string[]; onKeep: (d: Partial<VideoData>) => Promise<unknown>; onPatch: (b: Item<VideoData>, d: Partial<VideoData>) => Promise<void> }) {
  const src = embedFor(url);
  const [notes, setNotes] = useState(item?.data.description ?? '');
  const [pl, setPl] = useState(item?.data.playlist ?? '');
  const save = (d: Partial<VideoData>) => (item ? onPatch(item, d) : onKeep(d));
  return (
    <div className="parlour-player">
      <div className="tv-set">
        {src ? <iframe src={src} title={title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" /> : <p className="center">This video can’t be shown here. <a href={url} target="_blank" rel="noopener noreferrer">Open it on its website</a>.</p>}
      </div>
      <p className="muted small"><a href={url} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></p>
      <Field label="My notes"><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stayed with you…" /></Field>
      <div className="row wrap gap">
        <Field label="Playlist">
          <input className="input" list="parlour-playlists" value={pl} onChange={(e) => setPl(e.target.value)} placeholder="e.g. rainy afternoons" />
          <datalist id="parlour-playlists">{playlists.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={() => save({ description: notes || undefined, playlist: pl.trim() || undefined, watched: true })}>{item ? 'Save notes' : 'Keep this video'}</button>
        {item && <label className="check"><input type="checkbox" checked={!!item.data.watched} onChange={(e) => onPatch(item, { watched: e.target.checked })} /> watched</label>}
      </div>
    </div>
  );
}
