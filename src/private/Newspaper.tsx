import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item } from '../../shared/types';
import { api, items as itemsApi } from '../lib/api';
import { useFeature } from '../lib/features';
import { useStore } from '../lib/store';
import { isYoutubeFeed } from '../lib/liveWorld';
import { hostOf, prettyDate } from '../lib/util';
import { useItems } from '../rooms/common';
import { resolveWeather, WEATHER_CHOICES } from '../world/Atmosphere';
import { Empty, Field, Loading } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';
import type { Entry } from './Conservatory';

// The Morning Paper: once a day, the newest posts from your own RSS subscriptions are set in
// type as a little newspaper. Editions are kept (privately) so you can leaf back through them.
// Switching it off or resetting it never touches your subscriptions or saved posts.

export interface Story { entryId: string; title: string; link: string; summary: string; image: string | null; feedTitle: string; category: string; published: string | null }
export interface EditionData { date: string; title: string; generatedAt: string; stories: Story[]; read?: string[] }
interface PaperSettings { name?: string; stories?: number; includeRead?: boolean; sections?: 'category' | 'none' }

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plain = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Choose the stories for an edition: newest first, at most two per feed so one blog can't fill the paper. */
export function pickStories(entries: Entry[], feedUrls: Map<string, string>, s: PaperSettings): Story[] {
  const max = Math.min(30, Math.max(4, s.stories ?? 12));
  const perFeed = new Map<string, number>();
  const out: Story[] = [];
  for (const e of entries) {
    if (isYoutubeFeed(feedUrls.get(e.feedId))) continue; // videos belong to the Parlour
    if (!s.includeRead && e.read) continue;
    const n = perFeed.get(e.feedId) ?? 0;
    if (n >= 2) continue;
    perFeed.set(e.feedId, n + 1);
    out.push({ entryId: e.id, title: plain(e.title || 'Untitled'), link: e.link, summary: plain(e.summary ?? '').slice(0, 420), image: e.image, feedTitle: e.feedTitle, category: e.category, published: e.published });
    if (out.length >= max) break;
  }
  return out;
}

export function NewspaperPage() {
  const { toast, world } = useStore();
  const feature = useFeature('newspaper');
  const settings = feature.settings as PaperSettings;
  const name = settings.name || 'The Ribbonmere Gazette';
  const editions = useItems<EditionData>('edition');
  const [openId, setOpenId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const list = useMemo(() => [...(editions.data ?? [])].sort((a, b) => b.data.date.localeCompare(a.data.date)), [editions.data]);
  const today = list.find((e) => e.data.date === todayKey());
  const current = list.find((e) => e.id === openId) ?? today ?? list[0];

  const printedToday = useRef(false);
  const print = async (replace?: Item<EditionData>, auto = false) => {
    setPrinting(true);
    try {
      const [feeds, entries] = await Promise.all([api<{ id: string; url: string }[]>('GET', '/api/feeds'), api<Entry[]>('GET', '/api/feed-entries?limit=200')]);
      if (!feeds.length) { if (!auto) toast('Follow a few blogs or newsletters in Favorites first — the paper is made from them.'); return; }
      const stories = pickStories(entries, new Map(feeds.map((f) => [f.id, f.url])), settings);
      const data: EditionData = { date: todayKey(), title: name, generatedAt: new Date().toISOString(), stories, read: replace?.data.read ?? [] };
      if (replace) await itemsApi.update(replace.id, { data, replace: true });
      else await itemsApi.create<EditionData>('edition', data);
      setOpenId(null);
      editions.reload();
    } catch (e: any) { toast(e.message ?? 'The press is stuck — try again in a moment.'); }
    finally { setPrinting(false); }
  };
  // A fresh edition the first time you open the paper each day (only if you follow feeds).
  useEffect(() => {
    if (editions.data && !today && !printedToday.current) { printedToday.current = true; print(undefined, true); }
  }, [editions.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (ed: Item<EditionData>, s: Story) => {
    const read = Array.from(new Set([...(ed.data.read ?? []), s.entryId]));
    await itemsApi.update(ed.id, { data: { read } });
    api('PATCH', `/api/feed-entries/${encodeURIComponent(s.entryId)}`, { read: true }).catch(() => {}); // the post may have expired from the feed
    editions.reload();
  };
  const save = async (s: Story) => {
    try { await api('PATCH', `/api/feed-entries/${encodeURIComponent(s.entryId)}`, { saved: true }); toast('Saved to your reader ♡'); }
    catch { toast('That post has left the feed, so it can’t be saved there — the link still works.'); }
  };

  const sections = useMemo(() => {
    if (!current) return [];
    const [, ...rest] = current.data.stories;
    if (settings.sections === 'none') return [['', rest] as const];
    const m = new Map<string, Story[]>();
    for (const s of rest) m.set(s.category || 'Miscellany', [...(m.get(s.category || 'Miscellany') ?? []), s]);
    return [...m.entries()];
  }, [current, settings.sections]);
  const weather = WEATHER_CHOICES.find((w) => w.id === resolveWeather(world))?.name ?? 'Fair';

  return (
    <ModeShell mode="private">
      <SectionTitle title="The Morning Paper" sub="today’s edition · from the creators you follow" />
      <div className="row wrap gap paper-tools">
        {today && <button className="btn small" disabled={printing} onClick={() => print(today)}>{printing ? 'Printing…' : 'Print a fresh edition'}</button>}
        <button className="btn small ghost" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>Paper settings</button>
        <Link className="btn small ghost" to="/dollhouse/favorites">Manage subscriptions</Link>
      </div>
      {showSettings && (
        <div className="lace-card paper-settings row wrap gap">
          <Field label="Name of the paper"><input className="input" defaultValue={name} onBlur={(e) => feature.setSettings({ name: e.target.value.trim() || undefined })} /></Field>
          <Field label="Stories per edition"><input className="input" type="number" min={4} max={30} defaultValue={settings.stories ?? 12} onBlur={(e) => feature.setSettings({ stories: Number(e.target.value) || 12 })} /></Field>
          <Field label="Sections">
            <select className="input" value={settings.sections ?? 'category'} onChange={(e) => feature.setSettings({ sections: e.target.value })}>
              <option value="category">by category</option><option value="none">one long page</option>
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={!!settings.includeRead} onChange={(e) => feature.setSettings({ includeRead: e.target.checked })} /> include posts I’ve already read</label>
        </div>
      )}

      {(editions.loading || (printing && !current)) && <Loading what="Setting the type" />}
      {!editions.loading && !printing && !current && (
        <Empty title="No edition yet" art="📰">The paper is made from your RSS subscriptions. <Link to="/dollhouse/favorites">Follow a few creators</Link>, then come back.</Empty>
      )}

      {current && (
        <article className="newspaper" aria-label={`${current.data.title}, ${prettyDate(current.data.date + 'T12:00:00')}`}>
          <header className="paper-masthead">
            <p className="paper-ears"><span>No. {list.length - list.indexOf(current)}</span><span>{weather}</span></p>
            <h2 className="paper-name">{current.data.title}</h2>
            <p className="paper-dateline">{new Date(current.data.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {current.data.stories.length} stories</p>
          </header>
          {current.data.stories.length === 0 && <p className="center hand">A quiet morning: nothing new from your creators. Enjoy the calm.</p>}
          {current.data.stories[0] && <StoryBlock s={current.data.stories[0]} lead read={(current.data.read ?? []).includes(current.data.stories[0].entryId)} onRead={() => markRead(current, current.data.stories[0])} onSave={() => save(current.data.stories[0])} />}
          {sections.map(([cat, stories]) => (
            <section key={cat} className="paper-section">
              {cat && <h3 className="paper-section-title">{cat}</h3>}
              <div className="paper-columns">
                {stories.map((s) => <StoryBlock key={s.entryId} s={s} read={(current.data.read ?? []).includes(s.entryId)} onRead={() => markRead(current, s)} onSave={() => save(s)} />)}
              </div>
            </section>
          ))}
        </article>
      )}

      {list.length > 1 && (
        <section className="lace-card paper-archive">
          <h3 className="smallcaps">the archive</h3>
          <ul>
            {list.map((e) => {
              const unread = e.data.stories.filter((s) => !(e.data.read ?? []).includes(s.entryId)).length;
              return (
                <li key={e.id}>
                  <button className={`linkish ${e.id === current?.id ? 'on' : ''}`} onClick={() => setOpenId(e.id)}>{prettyDate(e.data.date + 'T12:00:00')}</button>
                  <span className="muted"> · {e.data.stories.length} stories{unread ? ` · ${unread} unread` : ' · all read'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </ModeShell>
  );
}

function StoryBlock({ s, lead, read, onRead, onSave }: { s: Story; lead?: boolean; read: boolean; onRead: () => void; onSave: () => void }) {
  return (
    <div className={`paper-story ${lead ? 'lead' : ''} ${lead && s.image ? 'has-img' : ''} ${read ? 'is-read' : ''}`}>
      {s.image && (lead || s.summary.length < 200) && <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      <h4><a href={s.link} target="_blank" rel="noopener noreferrer" onClick={onRead}>{s.title}</a></h4>
      <p className="paper-byline">{s.feedTitle}{s.link ? ` · ${hostOf(s.link)}` : ''}</p>
      {s.summary && <p className="paper-text">{lead ? s.summary : s.summary.slice(0, 220) + (s.summary.length > 220 ? '…' : '')}</p>}
      <p className="paper-actions">
        {read ? <span className="muted">read ✓</span> : <button className="linkish" onClick={onRead}>mark read</button>}
        {' · '}<button className="linkish" onClick={onSave}>save</button>
      </p>
    </div>
  );
}
