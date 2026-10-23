import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Item } from '../../shared/types';
import { useStore } from '../lib/store';
import { items as itemsApi } from '../lib/api';
import { hostOf, timeAgo } from '../lib/util';
import { Empty, ErrorNote, Field, Loading, Modal } from '../ui/kit';
import { useItems } from '../rooms/common';
import { ModeShell, SectionTitle } from './Shell';
import { isResting, quickSave, reminderDue, type InboxData, type InboxStatus } from './inboxLogic';

// The Letterbox: capture now, decide later. Optional cooldown lets new things rest before review.

export function QuickAdd({ onSaved, autoFocus, compact }: { onSaved?: (it: Item<InboxData>) => void; autoFocus?: boolean; compact?: boolean }) {
  const { world, toast } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const it = await quickSave(text, world.inbox.cooldownHours);
      setText('');
      toast(world.inbox.cooldownHours > 0 ? `Tucked into the letterbox — it can rest for ${world.inbox.cooldownHours}h ♡` : 'Saved to your letterbox ♡');
      onSaved?.(it);
    } catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  };
  return (
    <form className={`quick-add ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <label className="sr-only" htmlFor="quick-add-input">Save a link, idea or note for later</label>
      <input id="quick-add-input" className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus={autoFocus}
        placeholder="Paste a link, or jot an idea…" enterKeyHint="send" />
      <button className="btn" disabled={busy}>{busy ? '…' : 'Save ✉'}</button>
    </form>
  );
}

const TABS: { id: string; label: string }[] = [
  { id: 'new', label: 'Unopened' }, { id: 'resting', label: 'Resting' }, { id: 'later', label: 'Read & watch later' },
  { id: 'keep', label: 'Kept' }, { id: 'archived', label: 'Archive' },
];

export function LetterboxPage() {
  const { world, updateWorld, toast } = useStore();
  const inbox = useItems<InboxData>('inbox');
  const [tab, setTab] = useState('new');
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [peek, setPeek] = useState(false);
  const [moving, setMoving] = useState<Item<InboxData> | null>(null);
  const [editing, setEditing] = useState<Item<InboxData> | null>(null);
  const all = inbox.data ?? [];
  const counts = useMemo(() => ({
    new: all.filter((i) => i.data.status === 'new' && !isResting(i.data)).length,
    resting: all.filter((i) => isResting(i.data)).length,
    later: all.filter((i) => i.data.status === 'later').length,
    keep: all.filter((i) => i.data.status === 'keep').length,
    archived: all.filter((i) => i.data.status === 'archived').length,
  }), [all]);
  const tags = [...new Set(all.flatMap((i) => i.data.tags ?? []))];
  const due = all.filter((i) => reminderDue(i.data));
  const list = all
    .filter((i) => tab === 'resting' ? isResting(i.data) : tab === 'new' ? i.data.status === 'new' && !isResting(i.data) : i.data.status === tab)
    .filter((i) => !q || JSON.stringify(i.data).toLowerCase().includes(q.toLowerCase()))
    .filter((i) => !tagFilter || i.data.tags?.includes(tagFilter))
    .sort((a, b) => (sort === 'newest' ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));

  const setStatus = async (it: Item<InboxData>, status: InboxStatus) => {
    await itemsApi.update(it.id, { data: { status, availableAt: undefined } });
    toast({ keep: 'Kept ♡', later: 'Added to read & watch later', archived: 'Archived', new: 'Back in the letterbox' }[status]);
    inbox.reload();
  };
  const remove = async (it: Item) => { if (confirm('Delete this for good?')) { await itemsApi.remove(it.id); inbox.reload(); } };
  const setCooldown = async () => {
    const v = prompt('Cooldown in hours before new things are ready to review (0 turns it off):', String(world.inbox.cooldownHours));
    if (v === null || isNaN(Number(v))) return;
    await updateWorld((w) => ({ ...w, inbox: { ...w.inbox, cooldownHours: Math.max(0, Number(v)) } }));
    toast(Number(v) > 0 ? `New letters will rest for ${v} hours.` : 'Cooldown is off.');
  };

  return (
    <ModeShell mode="private">
      <SectionTitle title="The Letterbox" sub="capture now · decide later" />
      <div className="letterbox-top lace-card">
        <QuickAdd onSaved={inbox.reload} autoFocus />
        <p className="muted">Cooldown: {world.inbox.cooldownHours > 0 ? `${world.inbox.cooldownHours} hours` : 'off'} · <button className="linkish" onClick={setCooldown}>change</button></p>
      </div>
      {due.length > 0 && (
        <div className="reminders" role="status">
          <span className="smallcaps">⏰ reminders due</span>
          {due.map((d) => <button key={d.id} className="chip" onClick={() => setEditing(d)}>{d.data.title || d.data.content.slice(0, 40)}</button>)}
        </div>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label} <span className="count">{(counts as any)[t.id]}</span></button>)}
      </div>
      <div className="row wrap gap filters">
        <input className="input search-input" placeholder="Search the letterbox…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input select-sm" value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort"><option value="newest">newest first</option><option value="oldest">oldest first</option></select>
        {tags.map((t) => <button key={t} className={`chip ${tagFilter === t ? 'on' : ''}`} onClick={() => setTagFilter(tagFilter === t ? null : t)}>#{t}</button>)}
      </div>
      {inbox.loading && <Loading what="Opening the letterbox" />}
      {inbox.error && <ErrorNote msg={inbox.error} retry={inbox.reload} />}
      {tab === 'resting' && list.length > 0 && !peek && (
        <div className="resting-note paper-sheet">
          <p className="hand">These {list.length} letters are resting, so you can see whether they still feel exciting tomorrow.</p>
          <button className="btn small ghost" onClick={() => setPeek(true)}>Peek anyway</button>
        </div>
      )}
      {!inbox.loading && list.length === 0 && <Empty title={tab === 'new' ? 'Nothing waiting — a tidy little letterbox' : 'Nothing here'} art="✉" />}
      {(tab !== 'resting' || peek) && (
        <div className="envelopes">
          {list.map((it, i) => (
            <article key={it.id} className={`envelope type-${it.data.type}`} style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }}>
              <div className="envelope-flap" aria-hidden />
              <div className="envelope-body">
                {it.data.image && <img src={it.data.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                <div>
                  <p className="smallcaps">{it.data.type}{it.data.url ? ` · ${hostOf(it.data.url)}` : ''} · {timeAgo(it.createdAt)}{isResting(it.data) ? ` · ready ${timeAgo(it.data.availableAt).replace(' ago', '')}` : ''}</p>
                  <h3>{it.data.url ? <a href={it.data.url} target="_blank" rel="noopener noreferrer">{it.data.title || it.data.url}</a> : it.data.content}</h3>
                  {it.data.description && <p className="muted">{it.data.description.slice(0, 160)}</p>}
                  {it.data.note && <p className="hand">{it.data.note}</p>}
                  {it.data.tags?.length > 0 && <p className="muted">{it.data.tags.map((t) => `#${t}`).join(' ')}</p>}
                </div>
              </div>
              <div className="envelope-actions" role="group" aria-label="Decide what to do">
                {it.data.status !== 'keep' && <button className="btn small" onClick={() => setStatus(it, 'keep')}>Keep</button>}
                {it.data.status !== 'later' && <button className="btn small" onClick={() => setStatus(it, 'later')}>Later</button>}
                <button className="btn small" onClick={() => setMoving(it)}>To a collection</button>
                {it.data.status !== 'archived' ? <button className="btn small ghost" onClick={() => setStatus(it, 'archived')}>Archive</button> : <button className="btn small ghost" onClick={() => setStatus(it, 'new')}>Unarchive</button>}
                <button className="btn small ghost" onClick={() => setEditing(it)}>Tags & reminder</button>
                <button className="btn small danger" onClick={() => remove(it)} aria-label="Delete">✕</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <MoveToCollection item={moving} onClose={() => { setMoving(null); inbox.reload(); }} />
      <InboxEdit item={editing} onClose={() => { setEditing(null); inbox.reload(); }} />
    </ModeShell>
  );
}

function MoveToCollection({ item, onClose }: { item: Item<InboxData> | null; onClose: () => void }) {
  const { toast } = useStore();
  const bms = useItems<any>('bookmark');
  const collections = [...new Set(['Favourite Websites', 'Watch Later', 'Articles', 'Research', ...(bms.data ?? []).map((b) => b.data.collection).filter(Boolean)])];
  const [col, setCol] = useState('Articles');
  if (!item) return null;
  const move = async () => {
    await itemsApi.create('bookmark', {
      url: item.data.url ?? '', title: item.data.title || item.data.content.slice(0, 120), description: item.data.description || item.data.note || (item.data.url ? '' : item.data.content),
      image: item.data.image, collection: col, tags: item.data.tags ?? [],
    });
    await itemsApi.update(item.id, { data: { status: 'archived' } });
    toast(`Filed in ${col} ♡ (the letter is archived)`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="File it in the cabinet">
      <Field label="Collection"><input className="input" list="cols" value={col} onChange={(e) => setCol(e.target.value)} /><datalist id="cols">{collections.map((c) => <option key={c} value={c} />)}</datalist></Field>
      <div className="form-actions"><button className="btn" onClick={move}>File it</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

function InboxEdit({ item, onClose }: { item: Item<InboxData> | null; onClose: () => void }) {
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [remind, setRemind] = useState('');
  const [title, setTitle] = useState('');
  const key = item?.id;
  useEffect(() => { if (item) { setTags((item.data.tags ?? []).join(', ')); setNote(item.data.note ?? ''); setRemind(item.data.remindAt?.slice(0, 16) ?? ''); setTitle(item.data.title ?? ''); } }, [key]);
  if (!item) return null;
  const save = async () => {
    await itemsApi.update(item.id, { data: { tags: tags.split(',').map((s) => s.trim()).filter(Boolean), note, title, remindAt: remind ? new Date(remind).toISOString() : undefined } });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="A little label">
      <div className="item-form">
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Tags" hint="Separate with commas"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <Field label="A note to future me"><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="Remind me on" hint="Reminders show at the top of the letterbox and on your dashboard when due (no phone notifications)."><input className="input" type="datetime-local" value={remind} onChange={(e) => setRemind(e.target.value)} /></Field>
        <div className="form-actions"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </Modal>
  );
}
