import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item, Room } from '../../shared/types';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { items as itemsApi } from '../lib/api';
import { Empty, Loading, VisBadge, useAsync } from '../ui/kit';
import { OwnerBar, useEditor, useItems } from './common';

// The Commonplace Book: quotations, excerpts, passages and reflections, each with its source and,
// optionally, a link to one of your own books, journal pages or notes. Entries start private.

export interface ExcerptData { text: string; type?: string; source?: string; author?: string; page?: string; url?: string; linked?: string; reflection?: string; tags?: string[]; favorite?: boolean }

const KIND_LABEL: Record<string, string> = { book: 'Book', entry: 'Page', note: 'Note' };
const linkLabel = (it: Item<any>) => `${KIND_LABEL[it.kind]}: ${it.data.title || 'Untitled'}`;

/** Plain-text/Markdown export of entries, for keeping or printing. */
export function exportMarkdown(list: ExcerptData[], title: string) {
  const lines = [`# ${title}`, ''];
  for (const e of list) {
    lines.push(...e.text.split('\n').map((l) => `> ${l}`));
    const by = [e.author, e.source && `*${e.source}*`, e.page].filter(Boolean).join(', ');
    if (by) lines.push(`>`, `> — ${by}`);
    if (e.reflection) lines.push('', e.reflection);
    if (e.tags?.length) lines.push('', e.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' '));
    if (e.url) lines.push('', e.url);
    lines.push('', '---', '');
  }
  return lines.join('\n');
}

export function CommonplaceRoom({ room }: { room: Room }) {
  const { owner } = useStore();
  const excerpts = useItems<ExcerptData>('excerpt', room.id);
  // Your own things an entry can link to (owner only; visitors only ever see public items anyway).
  const own = useAsync<Item<any>[]>(async () => (owner ? (await Promise.all((['book', 'entry', 'note'] as const).map((k) => itemsApi.list(k)))).flat() : []), [owner]);
  const linkables = useMemo(() => own.data ?? [], [own.data]);
  const ed = useEditor('excerpt', room.id, () => { excerpts.reload(); award('commonplace'); }, { linkables: linkables.map(linkLabel) });
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const all = excerpts.data ?? [];
  const tags = [...new Set(all.flatMap((e) => e.data.tags ?? []))].sort();
  const types = [...new Set(all.map((e) => e.data.type).filter(Boolean) as string[])];
  const list = all
    .filter((e) => (!tag || e.data.tags?.includes(tag)) && (!type || e.data.type === type) && (!fav || e.data.favorite))
    .filter((e) => !q || [e.data.text, e.data.source, e.data.author, e.data.reflection, ...(e.data.tags ?? [])].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const target = (e: ExcerptData) => (e.linked ? linkables.find((it) => linkLabel(it) === e.linked) : undefined);
  const download = () => {
    const blob = new Blob([exportMarkdown(list.map((e) => e.data), room.name)], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${room.id}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="commonplace">
      <OwnerBar>
        <button className="btn small" onClick={() => ed.add({ type: 'Quote' })}>+ A new entry</button>
        {list.length > 0 && <button className="btn small ghost" onClick={download}>Export as text</button>}
      </OwnerBar>
      <div className="row wrap gap filters">
        <input className="input search-input" type="search" placeholder="Search words, sources, tags…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the commonplace book" />
        <button className={`chip ${fav ? 'on' : ''}`} aria-pressed={fav} onClick={() => setFav(!fav)}>♥ favourites</button>
        {types.map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} aria-pressed={type === t} onClick={() => setType(type === t ? null : t)}>{t}</button>)}
        {tags.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>)}
      </div>
      {excerpts.loading && <Loading what="Opening the commonplace book" />}
      {!excerpts.loading && list.length === 0 && <Empty title={all.length ? 'Nothing matches' : 'Blank, creamy pages'} art="❦">{owner && !all.length ? 'Copy in a line you never want to lose.' : null}</Empty>}
      <div className="cp-pages">
        {list.map((e, i) => {
          const t = target(e.data);
          return (
            <article key={e.id} className="cp-entry" style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }} aria-label={e.data.text.slice(0, 60)}>
              <p className="smallcaps">{e.data.type ?? 'entry'}{e.data.favorite ? ' · ♥' : ''}</p>
              <blockquote className="cp-text">{e.data.text}</blockquote>
              {(e.data.author || e.data.source) && (
                <p className="cp-cite">— {e.data.author}{e.data.author && e.data.source ? ', ' : ''}{e.data.source && (e.data.url ? <a href={e.data.url} target="_blank" rel="noopener noreferrer"><cite>{e.data.source}</cite></a> : <cite>{e.data.source}</cite>)}{e.data.page ? `, ${e.data.page}` : ''}</p>
              )}
              {e.data.reflection && <p className="hand cp-reflection">{e.data.reflection}</p>}
              {e.data.tags?.length ? <p className="cp-tags">{e.data.tags.map((x) => <button key={x} className="linkish" onClick={() => setTag(x)}>#{x}</button>)}</p> : null}
              {t && <p className="small">↳ <Link to={t.roomId ? `/room/${t.roomId}/${t.id}` : '/dollhouse/diary'}>{e.data.linked}</Link></p>}
              {owner && <div className="card-foot"><VisBadge v={e.visibility} /><button className="btn small ghost" onClick={() => ed.edit(e)}>Edit</button></div>}
            </article>
          );
        })}
      </div>
      {ed.modal}
    </div>
  );
}
