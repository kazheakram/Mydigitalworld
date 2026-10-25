import { useState } from 'react';
import type { Item } from '../../shared/types';
import { items as itemsApi } from '../lib/api';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { hostOf, prettyDate } from '../lib/util';
import { useItems } from '../rooms/common';
import { Empty, Field, ImagePicker, Loading, Modal } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';

// Time Capsules: a letter, some photographs and links, sealed for a future day.
// Nothing is ever locked away for good: you can open a capsule early, or unseal it to change it.
// Capsules are always private.

export interface CapsuleData { title: string; letter: string; images: string[]; links: string[]; openOn: string; sealedAt?: string; openedAt?: string; openedEarly?: boolean }
const today = () => new Date().toISOString().slice(0, 10);
export const isReady = (c: CapsuleData, now = today()) => c.openOn <= now;
const inAYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
const daysUntil = (d: string) => Math.ceil((Date.parse(d + 'T00:00:00') - Date.parse(today() + 'T00:00:00')) / 86400_000);

export function CapsulesPage() {
  const { toast } = useStore();
  const caps = useItems<CapsuleData>('capsule');
  const [editing, setEditing] = useState<Item<CapsuleData> | 'new' | null>(null);
  const [early, setEarly] = useState<Item<CapsuleData> | null>(null);
  const [reading, setReading] = useState<Item<CapsuleData> | null>(null);
  const list = [...(caps.data ?? [])].sort((a, b) => a.data.openOn.localeCompare(b.data.openOn));
  const open = async (c: Item<CapsuleData>, earlyOpen = false) => {
    const data = { openedAt: new Date().toISOString(), openedEarly: earlyOpen };
    await itemsApi.update(c.id, { data });
    award('capsule-opened');
    setEarly(null); setReading({ ...c, data: { ...c.data, ...data } }); caps.reload();
  };
  const reseal = async (c: Item<CapsuleData>) => {
    await itemsApi.update(c.id, { data: { ...c.data, openedAt: undefined, openedEarly: undefined }, replace: true });
    setReading(null); caps.reload(); toast('Sealed again ♡');
  };
  return (
    <ModeShell mode="private">
      <SectionTitle title="Time Capsules" sub="letters · photographs · links for a future day" />
      <p className="center muted">Seal something for your future self. You can always open it early, or unseal it to add more. Nothing is ever locked away.</p>
      <div className="row wrap gap" style={{ justifyContent: 'center' }}><button className="btn" onClick={() => setEditing('new')}>+ A new time capsule</button></div>
      {caps.loading && <Loading what="Finding the shovel" />}
      {!caps.loading && list.length === 0 && <Empty title="Nothing buried yet" art="⏳">Write to yourself a year from now.</Empty>}
      <div className="capsule-grid">
        {list.map((c) => {
          const ready = isReady(c.data); const opened = !!c.data.openedAt; const days = daysUntil(c.data.openOn);
          return (
            <article key={c.id} className={`capsule ${opened ? 'is-open' : ready ? 'is-ready' : 'is-sealed'}`} aria-label={c.data.title}>
              <div className="capsule-jar" aria-hidden><span className="capsule-ribbon" /><span className="capsule-glow">{opened ? '✉' : ready ? '✨' : '⏳'}</span></div>
              <h3 className="script">{c.data.title}</h3>
              <p className="smallcaps">{opened ? `opened ${prettyDate(c.data.openedAt)}${c.data.openedEarly ? ' (a little early)' : ''}` : ready ? 'ready to open' : `opens ${prettyDate(c.data.openOn + 'T12:00:00')} · in ${days} day${days === 1 ? '' : 's'}`}</p>
              <p className="muted small">{c.data.images.length} photo{c.data.images.length === 1 ? '' : 's'} · {c.data.links.length} link{c.data.links.length === 1 ? '' : 's'} · sealed {prettyDate(c.data.sealedAt)}</p>
              <div className="row wrap gap">
                {opened ? <button className="btn small" onClick={() => setReading(c)}>Read it</button>
                  : ready ? <button className="btn small" onClick={() => open(c)}>Open the capsule</button>
                    : <button className="btn small ghost" onClick={() => setEarly(c)}>Open early…</button>}
                {!opened && <button className="btn small ghost" onClick={() => setEditing(c)}>Unseal to change</button>}
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={!!early} onClose={() => setEarly(null)} title="Open it early?">
        <p>“{early?.data.title}” is meant for {early && prettyDate(early.data.openOn + 'T12:00:00')}. You're always allowed to open it sooner, and you can seal it again afterwards.</p>
        <div className="form-actions"><button className="btn ghost" onClick={() => setEarly(null)}>Let it wait</button><button className="btn" onClick={() => early && open(early, true)}>Open it now</button></div>
      </Modal>
      <Modal open={!!reading} onClose={() => setReading(null)} title={reading?.data.title ?? ''} wide>
        {reading && (
          <div className="capsule-contents">
            <p className="smallcaps">sealed {prettyDate(reading.data.sealedAt)} · for {prettyDate(reading.data.openOn + 'T12:00:00')}</p>
            {reading.data.letter && <div className="capsule-letter hand">{reading.data.letter.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
            {reading.data.images.length > 0 && <div className="capsule-photos">{reading.data.images.map((src) => <img key={src} src={src} alt="" referrerPolicy="no-referrer" />)}</div>}
            {reading.data.links.length > 0 && <ul>{reading.data.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer">{hostOf(l) || l}</a></li>)}</ul>}
            <div className="form-actions"><button className="btn ghost" onClick={() => reseal(reading)}>Seal it again</button></div>
          </div>
        )}
      </Modal>
      {editing && <CapsuleForm item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); caps.reload(); }} />}
    </ModeShell>
  );
}

function CapsuleForm({ item, onClose, onSaved }: { item?: Item<CapsuleData>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<CapsuleData>(item?.data ?? { title: '', letter: '', images: [], links: [], openOn: inAYear() });
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  const set = (p: Partial<CapsuleData>) => setD((x) => ({ ...x, ...p }));
  const addLink = () => { const l = link.trim(); if (!/^https?:\/\//.test(l)) { setErr('Links need to start with https://'); return; } set({ links: [...d.links, l] }); setLink(''); setErr(''); };
  const seal = async () => {
    if (!d.openOn) { setErr('Choose a day for it to open.'); return; }
    const data = { ...d, title: d.title.trim() || `For ${prettyDate(d.openOn + 'T12:00:00')}`, sealedAt: new Date().toISOString() };
    if (item) await itemsApi.update(item.id, { data, replace: true }); else await itemsApi.create<CapsuleData>('capsule', data);
    award('capsule');
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={item ? 'Unsealed for a moment' : 'A new time capsule'} wide>
      <Field label="Name"><input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="To me, next spring" /></Field>
      <Field label="Open on" hint="You can still open it early if you like."><input className="input" type="date" value={d.openOn} onChange={(e) => set({ openOn: e.target.value })} /></Field>
      <Field label="A letter to the future"><textarea className="input" rows={7} value={d.letter} onChange={(e) => set({ letter: e.target.value })} placeholder="Dear future me…" /></Field>
      <div className="row wrap gap capsule-photos">{d.images.map((src) => <span key={src} className="capsule-thumb"><img src={src} alt="" /><button className="icon-btn" aria-label="Remove photo" onClick={() => set({ images: d.images.filter((x) => x !== src) })}>✕</button></span>)}</div>
      <ImagePicker label="Add a photograph" value="" onChange={(src) => src && set({ images: [...d.images, src] })} />
      <Field label="Links to keep">
        <span className="row gap"><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" onKeyDown={(e) => e.key === 'Enter' && addLink()} /><button className="btn small ghost" onClick={addLink}>Add</button></span>
      </Field>
      {d.links.length > 0 && <ul className="small">{d.links.map((l) => <li key={l}>{l} <button className="linkish" onClick={() => set({ links: d.links.filter((x) => x !== l) })}>remove</button></li>)}</ul>}
      {err && <p className="error-text" role="alert">{err}</p>}
      <div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={seal}>{item ? 'Seal it again' : 'Seal the capsule'}</button></div>
    </Modal>
  );
}
