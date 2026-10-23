import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Visibility } from '../../shared/types';
import { useStore } from '../lib/store';
import { items as itemsApi, uploadImage } from '../lib/api';
import type { Item } from '../../shared/types';

// Small reusable pieces in the village's visual language: lace windows, polaroids, ribbon tags.

export function Window({ title, subtitle, children, className = '', actions, onClose, tone }: {
  title?: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; onClose?: () => void; tone?: 'pink' | 'cream' | 'night';
}) {
  return (
    <section className={`window ${tone ? `tone-${tone}` : ''} ${className}`}>
      {(title || onClose || actions) && (
        <header className="window-bar">
          <span className="window-dots" aria-hidden><i /><i /><i /></span>
          <div className="window-title">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="smallcaps">{subtitle}</p>}
          </div>
          <div className="window-actions">
            {actions}
            {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>}
          </div>
        </header>
      )}
      <div className="window-body">{children}</div>
    </section>
  );
}

export const Ribbon = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`ribbon-banner ${className}`}><span>{children}</span></div>;

export function BowIcon({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 40 28" className={`bow-icon ${className}`} aria-hidden>
      <path d="M20 12 C12 2 2 4 4 12 C6 20 14 16 20 12 Z M20 12 C28 2 38 4 36 12 C34 20 26 16 20 12 Z" fill="var(--c-rose)" stroke="var(--c-roseDeep)" strokeOpacity={0.5} />
      <path d="M18 13 L12 27 M22 13 L28 27" stroke="var(--c-rose)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={20} cy={12} r={3.2} fill="var(--c-roseDeep)" />
    </svg>
  );
}

export function Polaroid({ title, caption, children, onClick, href, tilt = 0 }: { title: string; caption?: string; children: ReactNode; onClick?: () => void; href?: string; tilt?: number }) {
  const inner = (
    <>
      <BowIcon className="polaroid-bow" />
      <div className="polaroid-photo">{children}</div>
      <div className="polaroid-title script">{title}</div>
      {caption && <div className="polaroid-caption smallcaps">{caption}</div>}
    </>
  );
  const style = { ['--tilt' as any]: `${tilt}deg` };
  if (href) return <a className="polaroid" href={href} style={style}>{inner}</a>;
  return <button type="button" className="polaroid" onClick={onClick} style={style}>{inner}</button>;
}

export const Tag = ({ children, tilt = -3, className = '' }: { children: ReactNode; tilt?: number; className?: string }) => (
  <div className={`paper-tag ${className}`} style={{ ['--tilt' as any]: `${tilt}deg` }}><span className="hand">{children}</span></div>
);

export function Empty({ title, children, art = '♡' }: { title: string; children?: ReactNode; art?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden>{art}</div>
      <p className="script empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

/** A labelled form field. Use `group` when it holds buttons or several controls (it can't be a <label> then). */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: ReactNode; group?: boolean }) {
  if (group) {
    return (
      <div className="field" role="group" aria-label={label}>
        <span className="field-label smallcaps" aria-hidden>{label}</span>
        {children}
        {hint && <span className="field-hint">{hint}</span>}
      </div>
    );
  }
  return (
    <label className="field">
      <span className="field-label smallcaps">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function VisibilityPicker({ value, onChange, allowUnlisted = true }: { value: Visibility; onChange: (v: Visibility) => void; allowUnlisted?: boolean }) {
  const opts: { v: Visibility; label: string; hint: string }[] = [
    { v: 'private', label: '🔒 Private', hint: 'Only you, when signed in' },
    { v: 'public', label: '🌷 Public', hint: 'Anyone visiting your village' },
    ...(allowUnlisted ? [{ v: 'unlisted' as Visibility, label: '🎀 Unlisted', hint: 'Only people with the link' }] : []),
  ];
  return (
    <div className="vis-picker" role="radiogroup" aria-label="Who can see this">
      {opts.map((o) => (
        <button type="button" key={o.v} role="radio" aria-checked={value === o.v} className={`chip ${value === o.v ? 'on' : ''}`} onClick={() => onChange(o.v)} title={o.hint}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const VisBadge = ({ v }: { v: Visibility }) => (
  <span className={`vis-badge vis-${v}`} title={v === 'private' ? 'Only you can see this' : v === 'public' ? 'Visible to visitors' : 'Visible to anyone with the link'}>
    {v === 'private' ? '🔒 private' : v === 'public' ? '🌷 public' : '🎀 unlisted'}
  </span>
);

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={title}>
      {open && (
        <Window title={title} onClose={onClose}>
          {children}
        </Window>
      )}
    </dialog>
  );
}

export function Stars({ value, onChange, label = 'Rating' }: { value: number; onChange?: (n: number) => void; label?: string }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${label}: ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => onChange
        ? <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} hearts`} className={n <= value ? 'on' : ''} onClick={() => onChange(value === n ? 0 : n)}>♥</button>
        : <span key={n} className={n <= value ? 'on' : ''} aria-hidden>♥</span>)}
    </span>
  );
}

/** Pick an image: upload a new one, or choose from the media library. */
export function ImagePicker({ value, onChange, label = 'Image' }: { value?: string; onChange: (url: string) => void; label?: string }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState<Item[] | null>(null);
  const upload = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try { const it = await uploadImage(f); onChange(it.data.url); toast('Image uploaded ♡'); }
    catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="image-picker">
      <span className="field-label smallcaps">{label}</span>
      <div className="image-picker-row">
        {value ? <img src={value} alt="" className="thumb" /> : <div className="thumb empty-thumb" aria-hidden>♡</div>}
        <div className="stack-sm">
          <label className="btn small">
            {busy ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <button type="button" className="btn small ghost" onClick={async () => setLib(lib ? null : (await itemsApi.list('media')))}>From my media</button>
          {value && <button type="button" className="btn small ghost" onClick={() => onChange('')}>Remove</button>}
        </div>
      </div>
      <input className="input" placeholder="…or paste an image link (https://)" value={value?.startsWith('/uploads/') ? '' : value ?? ''} onChange={(e) => onChange(e.target.value)} />
      {lib && (
        <div className="media-grid mini">
          {lib.length === 0 && <p className="muted">No uploads yet.</p>}
          {lib.map((m) => <button type="button" key={m.id} onClick={() => { onChange(m.data.url); setLib(null); }}><img src={m.data.url} alt={m.data.name} loading="lazy" /></button>)}
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}
    </div>
  );
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    // Reloads keep showing the current data (no flicker); only a first load shows "loading".
    setState((s) => ({ ...s, loading: s.data === null }));
    fn().then((data) => alive && setState({ data, error: null, loading: false }), (e) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  const set = useCallback((data: T) => setState({ data, error: null, loading: false }), []);
  return { ...state, reload, set };
}

export const Loading = ({ what = 'Tying the ribbons' }: { what?: string }) => <div className="loading"><span className="spinner-bow" aria-hidden>🎀</span> {what}…</div>;
export const ErrorNote = ({ msg, retry }: { msg: string; retry?: () => void }) => (
  <div className="error-note" role="alert">
    <strong>Oh dear.</strong> {msg} {retry && <button className="btn small" onClick={retry}>Try again</button>}
  </div>
);
