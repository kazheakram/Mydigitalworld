import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item } from '../../shared/types';
import { useStore } from '../lib/store';
import { api, items as itemsApi } from '../lib/api';
import { hostOf, prettyDate, timeAgo } from '../lib/util';
import { Empty, Loading, VisBadge, useAsync } from '../ui/kit';
import { useEditor, useItems } from '../rooms/common';
import { ModeShell, SectionTitle } from './Shell';
import type { InboxData } from './inboxLogic';
import type { Entry } from './Conservatory';

// Reading Room: books in progress + everything set aside to read or watch later, in one queue.
export function ReadingRoomPage() {
  const { world } = useStore();
  const lib = world.rooms.find((r) => r.template === 'library');
  const books = useItems<any>('book');
  const inbox = useItems<InboxData>('inbox');
  const saved = useAsync<Entry[]>(() => api('GET', '/api/feed-entries?filter=saved&limit=40'), []);
  const ed = useEditor('book', lib?.id ?? null, books.reload, { shelves: lib?.settings?.shelves });
  const reading = (books.data ?? []).filter((b) => /current|reading/i.test(b.data.shelf ?? ''));
  const want = (books.data ?? []).filter((b) => /want|tbr/i.test(b.data.shelf ?? ''));
  const later = (inbox.data ?? []).filter((i) => i.data.status === 'later');
  const done = async (it: Item<InboxData>) => { await itemsApi.update(it.id, { data: { status: 'archived' } }); inbox.reload(); };
  const bump = async (b: Item<any>, pages: number) => { await itemsApi.update(b.id, { data: { pagesRead: Math.min(b.data.pages ?? 9999, (b.data.pagesRead ?? 0) + pages) } }); books.reload(); };
  return (
    <ModeShell mode="private">
      <SectionTitle title="Reading Room" sub="books · essays · articles · inspiration" />
      <div className="reading-grid">
        <section className="lace-card">
          <h3 className="smallcaps">on my nightstand</h3>
          {books.loading && <Loading />}
          {reading.length === 0 && !books.loading && <p className="muted hand">Nothing on the nightstand.</p>}
          {reading.map((b) => {
            const pct = b.data.pages ? Math.round(((b.data.pagesRead ?? 0) / b.data.pages) * 100) : null;
            return (
              <div key={b.id} className="nightstand-book">
                <span className="mini-spine" style={{ background: b.data.color ?? 'var(--c-rose)' }} />
                <div><strong>{b.data.title}</strong> <span className="muted">{b.data.author}</span>
                  {pct !== null && <div className="progress"><i style={{ width: `${pct}%` }} /></div>}
                  <span className="muted">{b.data.pagesRead ?? 0}/{b.data.pages ?? '?'} pages</span>{' '}
                  <button className="btn small ghost" onClick={() => bump(b, 10)}>+10 pages</button>
                  <button className="btn small ghost" onClick={() => ed.edit(b)}>Edit</button>
                </div>
              </div>
            );
          })}
          <div className="form-actions">
            <button className="btn small" onClick={() => ed.add({ shelf: lib?.settings?.shelves?.[0] ?? 'Currently Reading' })}>+ Add a book</button>
            {lib && <Link className="btn small ghost" to={`/room/${lib.id}`}>Open the library</Link>}
          </div>
          {want.length > 0 && <><h3 className="smallcaps">to read next</h3><p>{want.slice(0, 8).map((b) => b.data.title).join(' · ')}</p></>}
        </section>
        <section className="lace-card">
          <h3 className="smallcaps">read & watch later · {later.length}</h3>
          {later.length === 0 && <p className="muted hand">Your later pile is empty. Use “Later” in the letterbox or the reader.</p>}
          <ul className="queue">
            {later.map((i) => (
              <li key={i.id}>
                <a href={i.data.url} target="_blank" rel="noopener noreferrer">{i.data.title || i.data.content}</a>
                <span className="muted"> {i.data.url ? hostOf(i.data.url) : ''} · {i.data.type}</span>
                <button className="btn small ghost" onClick={() => done(i)}>Done ✓</button>
              </li>
            ))}
          </ul>
          <h3 className="smallcaps">saved from the reader · {saved.data?.length ?? 0}</h3>
          <ul className="queue">{(saved.data ?? []).map((e) => <li key={e.id}><a href={e.link} target="_blank" rel="noopener noreferrer">{e.title}</a> <span className="muted">{e.feedTitle}</span></li>)}</ul>
        </section>
      </div>
      {ed.modal}
    </ModeShell>
  );
}

// Diary: every private page and note in one drawer, plus a fresh page always ready.
export function DiaryPage() {
  const { world } = useStore();
  const journal = world.rooms.find((r) => r.template === 'journal');
  const garden = world.rooms.find((r) => r.template === 'garden');
  const entries = useItems<any>('entry');
  const notes = useItems<any>('note');
  const edE = useEditor('entry', journal?.id ?? null, entries.reload);
  const edN = useEditor('note', garden?.id ?? null, notes.reload, { stages: world.gardenStages.map((s) => s.id) });
  const [show, setShow] = useState<'all' | 'private'>('all');
  const mix = [...(entries.data ?? []).map((e) => ({ ...e, _k: 'entry' as const })), ...(notes.data ?? []).map((n) => ({ ...n, _k: 'note' as const }))]
    .filter((x) => show === 'all' || x.visibility !== 'public')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ModeShell mode="private">
      <SectionTitle title="My Diary" sub="personal notes · daydreams · little things" />
      <div className="row wrap gap filters">
        <button className="btn small" onClick={() => edE.add({ kind: 'Diary', title: prettyDate(new Date().toISOString()) })}>+ Today's page</button>
        <button className="btn small ghost" onClick={() => edN.add({ stage: world.gardenStages[0]?.id })}>+ A little note</button>
        <button className={`chip ${show === 'all' ? 'on' : ''}`} onClick={() => setShow('all')}>everything</button>
        <button className={`chip ${show === 'private' ? 'on' : ''}`} onClick={() => setShow('private')}>only private</button>
      </div>
      {(entries.loading || notes.loading) && <Loading what="Opening the diary" />}
      {!entries.loading && mix.length === 0 && <Empty title="A fresh diary" art="✒">Start with today's page.</Empty>}
      <div className="diary-pages">
        {mix.map((x, i) => (
          <article key={x.id} className="diary-card" style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }}>
            <p className="smallcaps">{x._k === 'entry' ? 'diary page' : 'garden note'} · {timeAgo(x.updatedAt)}</p>
            <h3 className="script">{x.data.title}</h3>
            <p className="excerpt">{(x.data.body ?? '').slice(0, 160)}</p>
            <div className="card-foot">
              <VisBadge v={x.visibility} />
              <button className="btn small ghost" onClick={() => (x._k === 'entry' ? edE.edit(x) : edN.edit(x))}>Edit</button>
              {x.roomId && <Link className="btn small ghost" to={`/room/${x.roomId}/${x.id}`}>Open</Link>}
            </div>
          </article>
        ))}
      </div>
      {edE.modal}{edN.modal}
    </ModeShell>
  );
}
