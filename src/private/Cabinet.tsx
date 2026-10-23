import { useMemo, useState } from 'react';
import type { Item } from '../../shared/types';
import { useStore } from '../lib/store';
import { items as itemsApi } from '../lib/api';
import { hostOf, linkType } from '../lib/util';
import { Empty, Loading } from '../ui/kit';
import { useEditor, useItems } from '../rooms/common';
import { ModeShell, SectionTitle } from './Shell';

// The Cabinet of Curiosities: bookmarks in collections, presented by what they are —
// videos as tiny televisions, articles as magazines, podcasts as cassettes, pins as polaroids.

interface Bm { url: string; title?: string; description?: string; image?: string; collection?: string; label?: string; tags?: string[]; favorite?: boolean }
const DEFAULT_COLLECTIONS = ['Favourite Websites', 'Watch Later', 'Pinterest Boards', 'Articles', 'Research', 'Reading Platforms'];

export function BookmarkCard({ b, onEdit, onToggleFav }: { b: Item<Bm>; onEdit?: () => void; onToggleFav?: () => void }) {
  const t = b.data.url ? linkType(b.data.url) : 'website';
  return (
    <article className={`treasure t-${t}`}>
      <a href={b.data.url} target="_blank" rel="noopener noreferrer" className="treasure-link">
        <div className="treasure-art">
          {b.data.image ? <img src={b.data.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="treasure-glyph" aria-hidden>{{ video: '▶', podcast: '◉◉', pin: '✿', article: '❧', music: '♫', website: '✉' }[t]}</span>}
        </div>
        <div className="treasure-text">
          <span className="smallcaps">{b.data.label || hostOf(b.data.url)}</span>
          <strong>{b.data.title || hostOf(b.data.url)}</strong>
          {b.data.description && <small>{b.data.description.slice(0, 110)}</small>}
        </div>
      </a>
      <div className="treasure-foot">
        {b.data.tags?.map((t) => <span key={t} className="mini-tag">#{t}</span>)}
        {onToggleFav && <button className={`heart-btn ${b.data.favorite ? 'on' : ''}`} onClick={onToggleFav} aria-pressed={!!b.data.favorite} aria-label="Favourite">♥</button>}
        {onEdit && <button className="btn small ghost" onClick={onEdit}>Edit</button>}
      </div>
    </article>
  );
}

function parseBookmarksHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: { url: string; title: string; collection: string }[] = [];
  doc.querySelectorAll('a[href]').forEach((a) => {
    const url = a.getAttribute('href') ?? '';
    if (!/^https?:\/\//.test(url)) return;
    const folder = a.closest('dl')?.previousElementSibling?.textContent?.trim() || 'Imported';
    out.push({ url, title: a.textContent?.trim() || url, collection: folder });
  });
  return out;
}

export function CabinetPage() {
  const { toast } = useStore();
  const bms = useItems<Bm>('bookmark');
  const all = bms.data ?? [];
  const collections = useMemo(() => [...new Set([...DEFAULT_COLLECTIONS, ...all.map((b) => b.data.collection).filter(Boolean) as string[]])], [all]);
  const ed = useEditor('bookmark', null, bms.reload, { collections });
  const [col, setCol] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const tags = [...new Set(all.flatMap((b) => b.data.tags ?? []))];
  const list = all.filter((b) => (!col || (col === '♥' ? b.data.favorite : b.data.collection === col)) && (!tag || b.data.tags?.includes(tag)) && (!q || JSON.stringify(b.data).toLowerCase().includes(q.toLowerCase())));

  const fav = async (b: Item<Bm>) => { await itemsApi.update(b.id, { data: { favorite: !b.data.favorite } }); bms.reload(); };
  const rename = async () => {
    if (!col || col === '♥') return;
    const name = prompt(`Rename “${col}” to:`, col);
    if (!name || name === col) return;
    await Promise.all(all.filter((b) => b.data.collection === col).map((b) => itemsApi.update(b.id, { data: { collection: name } })));
    setCol(name); bms.reload();
  };
  const importHtml = async (f?: File | null) => {
    if (!f) return;
    const found = parseBookmarksHtml(await f.text());
    const existing = new Set(all.map((b) => b.data.url));
    let n = 0;
    for (const b of found) if (!existing.has(b.url)) { await itemsApi.create('bookmark', b); n++; }
    toast(`Imported ${n} bookmarks ♡`); bms.reload();
  };
  const exportHtml = () => {
    const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
    const groups = collections.map((c) => [c, all.filter((b) => (b.data.collection ?? 'Unsorted') === c)] as const).filter(([, l]) => l.length);
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Ribbonmere bookmarks</H1>\n<DL><p>\n${groups.map(([c, l]) => `  <DT><H3>${esc(c)}</H3>\n  <DL><p>\n${l.map((b) => `    <DT><A HREF="${esc(b.data.url)}">${esc(b.data.title || b.data.url)}</A>`).join('\n')}\n  </DL><p>`).join('\n')}\n</DL><p>\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'ribbonmere-bookmarks.html'; a.click();
  };

  return (
    <ModeShell mode="private">
      <SectionTitle title="The Cabinet of Curiosities" sub="bookmarks · saved corners · little treasures" />
      <div className="cabinet">
        <aside className="cabinet-drawers" aria-label="Collections">
          <button className={`drawer ${!col ? 'on' : ''}`} onClick={() => setCol(null)}>All treasures <span>{all.length}</span></button>
          <button className={`drawer ${col === '♥' ? 'on' : ''}`} onClick={() => setCol('♥')}>♥ Favourites <span>{all.filter((b) => b.data.favorite).length}</span></button>
          {collections.map((c) => <button key={c} className={`drawer ${col === c ? 'on' : ''}`} onClick={() => setCol(c)}>{c} <span>{all.filter((b) => b.data.collection === c).length}</span></button>)}
          <button className="drawer add" onClick={() => { const n = prompt('Name your new collection:'); if (n) { ed.add({ collection: n }); } }}>+ new collection</button>
        </aside>
        <section className="cabinet-shelves">
          <div className="row wrap gap filters">
            <button className="btn small" onClick={() => ed.add({ collection: col && col !== '♥' ? col : 'Favourite Websites' })}>+ Save a link</button>
            {col && col !== '♥' && <button className="btn small ghost" onClick={rename}>Rename collection</button>}
            <input className="input search-input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookmarks" />
            <label className="btn small ghost">Import bookmarks (.html)<input type="file" accept=".html,text/html" hidden onChange={(e) => importHtml(e.target.files?.[0])} /></label>
            <button className="btn small ghost" onClick={exportHtml}>Export</button>
          </div>
          {tags.length > 0 && <div className="row wrap gap">{tags.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>)}</div>}
          {bms.loading && <Loading what="Unlocking the cabinet" />}
          {!bms.loading && list.length === 0 && <Empty title="An empty drawer" art="🗝">Paste a link with “Save a link” — the title and preview are fetched for you when the site allows it.</Empty>}
          <div className="treasures">{list.map((b) => <BookmarkCard key={b.id} b={b} onEdit={() => ed.edit(b)} onToggleFav={() => fav(b)} />)}</div>
        </section>
      </div>
      {ed.modal}
    </ModeShell>
  );
}
