import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Item, ItemKind, Visibility } from '../../shared/types';
import { KINDS, type FieldDef } from './schema';
import { Field, ImagePicker, Stars, VisibilityPicker } from '../ui/kit';
import { items as itemsApi, api } from '../lib/api';
import { useStore } from '../lib/store';
import { isUrl } from '../lib/util';
import { liveFeatureOn } from '../lib/liveWorld';

// The universal content editor. Used for books, journal pages, artworks, notes, drinks…

export function ItemForm({ kind, item, roomId, ctx = {}, onSaved, onCancel, onDeleted, initial }: {
  kind: ItemKind; item?: Item; roomId?: string | null; ctx?: any; initial?: Record<string, any>;
  onSaved: (it: Item) => void; onCancel: () => void; onDeleted?: () => void;
}) {
  const def = KINDS[kind]!;
  const { toast } = useStore();
  // New items keep an unsaved draft on this device until they're saved, so nothing typed is lost.
  const draftKey = item ? null : `rm-draft:${kind}:${roomId ?? ''}`;
  const savedDraft = (() => { try { return draftKey ? JSON.parse(localStorage.getItem(draftKey) ?? 'null') : null; } catch { return null; } })();
  const [data, setData] = useState<Record<string, any>>(() => ({ ...(initial ?? {}), ...(savedDraft?.data ?? {}), ...(item?.data ?? {}) }));
  const [vis, setVis] = useState<Visibility>(item?.visibility ?? savedDraft?.vis ?? def.defaultVisibility);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restored, setRestored] = useState(!!savedDraft);
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const touched = useRef(false);
  const set = (k: string, v: any) => { touched.current = true; setData((d) => ({ ...d, [k]: v })); };
  const setVisTouched = (v: Visibility) => { touched.current = true; setVis(v); };
  const requiredOk = def.fields.every((f) => !f.required || String(data[f.key] ?? '').trim());

  useEffect(() => {
    if (!touched.current) return;
    if (draftKey) {
      try { localStorage.setItem(draftKey, JSON.stringify({ data, vis })); } catch { /* storage full or blocked */ }
      return;
    }
    // Existing items autosave a moment after you stop typing.
    if (!item || !requiredOk) return;
    const t = window.setTimeout(async () => {
      setAutoState('saving');
      try { await itemsApi.update(item.id, { data, visibility: vis, replace: true }); setAutoState('saved'); }
      catch (e: any) { setAutoState('error'); setErr(`Autosave failed: ${e.message}`); }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [data, vis]); // eslint-disable-line react-hooks/exhaustive-deps
  const forgetDraft = () => { if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* ignore */ } };
  const alwaysPrivate = kind === 'bookmark';

  const fetchPreview = async () => {
    if (!isUrl(data.url ?? '') || !liveFeatureOn('linkPreviews')) return;
    try {
      const m = await api('POST', '/api/unfurl', { url: data.url });
      setData((d) => ({ ...d, title: d.title || m.title, description: d.description || m.description, image: d.image || m.image }));
      toast(m.title ? 'Found the title and preview ♡' : 'That page had no title to borrow — add one yourself.');
    } catch (e: any) { toast(`No preview: ${e.message} You can type the details yourself.`); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    for (const f of def.fields) if (f.required && !String(data[f.key] ?? '').trim()) { setErr(`Please fill in “${f.label}”.`); return; }
    setBusy(true); setErr(null);
    try {
      const saved = item
        ? await itemsApi.update(item.id, { data, visibility: vis, replace: true })
        : await itemsApi.create(kind, data, { roomId: roomId ?? null, visibility: vis });
      forgetDraft();
      onSaved(saved);
      toast(item ? 'Saved ♡' : `Your ${def.noun} is saved ♡`);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!item || !confirm(`Delete this ${def.noun}? This can't be undone (unless you have a backup).`)) return;
    await itemsApi.remove(item.id);
    toast('Deleted.');
    onDeleted?.();
  };

  return (
    <form className="item-form" onSubmit={submit}>
      {restored && (
        <p className="draft-note" role="status">
          ✎ We kept the {def.noun} you started earlier on this device.{' '}
          <button type="button" className="linkish" onClick={() => { forgetDraft(); setData({ ...(initial ?? {}) }); setVis(def.defaultVisibility); setRestored(false); touched.current = false; }}>Start fresh instead</button>
        </p>
      )}
      {def.fields.map((f) => <FieldInput key={f.key} f={f} value={data[f.key]} onChange={(v) => set(f.key, v)} ctx={ctx} onUrlBlur={f.type === 'url' && f.key === 'url' && liveFeatureOn('linkPreviews') ? fetchPreview : undefined} />)}
      {alwaysPrivate
        ? <p className="muted">🔒 Bookmarks are always private.</p>
        : <Field group label="Who can see this"><VisibilityPicker value={vis} onChange={setVisTouched} /></Field>}
      {err && <p className="error-note" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{item ? 'Close' : 'Cancel'}</button>
        {item && onDeleted && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
        {item && <span className="muted autosave" role="status">{autoState === 'saving' ? 'autosaving…' : autoState === 'saved' ? 'autosaved ✓' : autoState === 'error' ? '⚠ autosave failed' : 'changes save automatically'}</span>}
        {!item && touched.current && <span className="muted autosave">draft kept on this device until you save</span>}
      </div>
    </form>
  );
}

function FieldInput({ f, value, onChange, ctx, onUrlBlur }: { f: FieldDef; value: any; onChange: (v: any) => void; ctx: any; onUrlBlur?: () => void }) {
  const opts = typeof f.options === 'function' ? f.options(ctx) : f.options ?? [];
  switch (f.type) {
    case 'textarea': return <Field label={f.label} hint={f.hint}><textarea className="input" rows={f.key === 'body' ? 10 : 4} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} /></Field>;
    case 'number': return <Field label={f.label} hint={f.hint}><input className="input" type="number" min={0} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></Field>;
    case 'url': return (
      <Field group={!!onUrlBlur} label={f.label} hint={f.hint}>
        <span className="row">
          <input className="input" type="url" aria-label={f.label} inputMode="url" placeholder="https://" value={value ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={onUrlBlur} />
          {onUrlBlur && <button type="button" className="btn small ghost" onClick={onUrlBlur}>Fetch title</button>}
        </span>
      </Field>
    );
    case 'image': return <ImagePicker label={f.label} value={value} onChange={onChange} />;
    case 'select': return (
      <Field label={f.label} hint={f.hint}>
        <input className="input" list={`opts-${f.key}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Choose or type a new one" />
        <datalist id={`opts-${f.key}`}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
      </Field>
    );
    case 'tags': return <Field label={f.label} hint="Separate with commas"><input className="input" value={(value ?? []).join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></Field>;
    case 'lines': return <Field label={f.label} hint={f.hint}><textarea className="input" rows={4} value={(value ?? []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n').filter((s) => s.trim()))} /></Field>;
    case 'color': return <Field label={f.label}><input type="color" className="color-input" value={value ?? '#e8a6b4'} onChange={(e) => onChange(e.target.value)} /></Field>;
    case 'stars': return <Field group label={f.label}><Stars value={value ?? 0} onChange={onChange} /></Field>;
    case 'date': return <Field label={f.label}><input className="input" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></Field>;
    case 'check': return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>;
    default: return <Field label={f.label} hint={f.hint}><input className="input" value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} /></Field>;
  }
}
