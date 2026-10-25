import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item, Region, Room, SceneObject } from '../../shared/types';
import { ART, ArtSvg } from '../art';
import { Scene } from '../world/Scene';
import { items as itemsApi } from '../lib/api';
import { clone, uid } from '../lib/util';
import { Field, ImagePicker, useAsync } from '../ui/kit';

// A small Canva-style editor: canvas in the middle, object library on the left, properties on the right.
// Works on any list of SceneObjects, so the same tool edits the village map and freeform rooms.

export interface EditorProps {
  width: number; height: number;
  objects: SceneObject[];
  onChange: (objs: SceneObject[]) => void;
  background: ReactNode;
  regions?: Region[];
  rooms?: Room[];
  onTrash?: (o: SceneObject) => void;
  toolbarExtra?: ReactNode;
  kind: 'world' | 'room';
}

const GRID = 10;
const ANIMS = ['none', 'sway', 'bob', 'wander', 'flutter', 'twinkle'];

export function useHistory<T>(initial: T) {
  const [stack, setStack] = useState<{ past: T[]; present: T; future: T[] }>({ past: [], present: initial, future: [] });
  const commit = useCallback((next: T) => setStack((s) => ({ past: [...s.past.slice(-80), s.present], present: next, future: [] })), []);
  const replace = useCallback((next: T) => setStack((s) => ({ ...s, present: next })), []);
  const undo = useCallback(() => setStack((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s)), []);
  const redo = useCallback(() => setStack((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)), []);
  const reset = useCallback((v: T) => setStack({ past: [], present: v, future: [] }), []);
  return { value: stack.present, commit, replace, undo, redo, reset, canUndo: stack.past.length > 0, canRedo: stack.future.length > 0 };
}

export function SceneEditor(p: EditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [lockRatio, setLockRatio] = useState(true);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; orig: SceneObject; moved: boolean } | null>(null);
  const liveRef = useRef(p.objects);
  const [live, setLive] = useState<SceneObject[] | null>(null);
  const objs = live ?? p.objects;
  liveRef.current = objs;
  const selected = objs.find((o) => o.id === sel) ?? null;
  const media = useAsync<Item[]>(() => itemsApi.list('media'), []);

  const toSvg = (cx: number, cy: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };
  const snapV = (v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));

  const update = (id: string, patch: Partial<SceneObject>) => p.onChange(objs.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const onObjectPointerDown = (e: React.PointerEvent, o: SceneObject) => {
    e.stopPropagation();
    setSel(o.id);
    const pt = toSvg(e.clientX, e.clientY);
    const isHandle = (e.target as Element).classList.contains('resize-handle');
    drag.current = { id: o.id, mode: isHandle ? 'resize' : 'move', sx: pt.x, sy: pt.y, orig: { ...o }, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d || !svgRef.current) return;
      const pt = toSvg(e.clientX, e.clientY);
      const dx = pt.x - d.sx, dy = pt.y - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 2) return;
      d.moved = true;
      const o = d.orig;
      let next: Partial<SceneObject>;
      const g: { x?: number; y?: number } = {};
      if (d.mode === 'move') {
        let x = snapV(o.x + dx), y = snapV(o.y + dy);
        // Alignment assistance: snap centres to other objects' centres.
        for (const other of p.objects) {
          if (other.id === o.id) continue;
          const ocx = other.x + other.w / 2, ocy = other.y + other.h / 2;
          if (Math.abs(x + o.w / 2 - ocx) < 6) { x = ocx - o.w / 2; g.x = ocx; }
          if (Math.abs(y + o.h - (other.y + other.h)) < 6) { y = other.y + other.h - o.h; g.y = other.y + other.h; }
          else if (Math.abs(y + o.h / 2 - ocy) < 6) { y = ocy - o.h / 2; g.y = ocy; }
        }
        next = { x: Math.max(-o.w / 2, Math.min(p.width - o.w / 2, x)), y: Math.max(-o.h / 2, Math.min(p.height - o.h / 2, y)) };
      } else {
        let w = Math.max(12, snapV(o.w + dx)); let h = Math.max(12, snapV(o.h + dy));
        if (lockRatio) h = Math.max(12, Math.round(w * (o.h / o.w)));
        next = { w, h };
      }
      setGuides(g);
      setLive(liveRef.current.map((x) => (x.id === d.id ? { ...x, ...next } : x)));
    };
    const up = () => {
      const d = drag.current; drag.current = null; setGuides({});
      if (d?.moved) p.onChange(liveRef.current);
      setLive(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  });

  const add = (o: Partial<SceneObject>, at?: { x: number; y: number }) => {
    const w = o.w ?? 100, h = o.h ?? 100;
    const obj: SceneObject = { id: uid(p.kind === 'world' ? 'o-' : 'r-'), type: 'decor', x: snapV((at?.x ?? p.width / 2) - w / 2), y: snapV((at?.y ?? p.height / 2) - h / 2), w, h, z: Math.max(0, ...objs.map((x) => x.z)) + 1, opacity: 1, ...o } as SceneObject;
    p.onChange([...objs, obj]);
    setSel(obj.id);
  };
  const addArt = (key: string, at?: { x: number; y: number }) => {
    const def = ART[key];
    const isB = def.category === 'Buildings';
    add({ type: isB ? 'building' : 'decor', art: key, w: isB ? 200 : 90, h: isB ? 200 : 90, label: isB ? def.label : undefined }, at);
  };
  const remove = (o: SceneObject) => { p.onTrash?.(o); p.onChange(objs.filter((x) => x.id !== o.id)); setSel(null); };
  const duplicate = (o: SceneObject) => { const c = { ...clone(o), id: uid('o-'), x: o.x + 30, y: o.y + 30, z: o.z + 1 }; p.onChange([...objs, c]); setSel(c.id); };
  const layer = (o: SceneObject, dir: 'up' | 'down' | 'front' | 'back') => {
    const zs = objs.map((x) => x.z);
    const z = dir === 'front' ? Math.max(...zs) + 1 : dir === 'back' ? Math.min(...zs) - 1 : o.z + (dir === 'up' ? 1 : -1);
    update(o.id, { z });
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || !selected) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selected); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        update(selected.id, { x: selected.x + dx, y: selected.y + dy });
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicate(selected); }
      else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const at = toSvg(e.clientX, e.clientY);
    const art = e.dataTransfer.getData('text/x-art');
    const src = e.dataTransfer.getData('text/x-src');
    if (art) addArt(art, at);
    else if (src) add({ type: 'image', src, w: 140, h: 140 }, at);
  };

  const categories = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [k, d] of Object.entries(ART)) m.set(d.category, [...(m.get(d.category) ?? []), k]);
    return [...m.entries()];
  }, []);
  const decorations = (media.data ?? []).filter((m) => m.data.decoration || m.data.category !== 'Uploads');

  return (
    <div className="editor">
      <aside className="editor-library" aria-label="Objects you can add">
        <p className="smallcaps">drag onto the canvas, or click to add</p>
        <div className="row wrap">
          <button className="btn small" onClick={() => add({ type: 'text', text: 'A little note', w: 220, h: 70, colors: {} })}>+ Text</button>
          <button className="btn small" onClick={() => add({ type: 'link', text: 'A signpost', href: '/', w: 200, h: 50 })}>+ Link sign</button>
        </div>
        {decorations.length > 0 && (
          <details open>
            <summary className="smallcaps">my uploads & decorations</summary>
            <div className="lib-grid">
              {(media.data ?? []).map((m) => (
                <button key={m.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/x-src', m.data.url)} onClick={() => add({ type: 'image', src: m.data.url, w: 140, h: 140, label: m.data.name })} title={m.data.name}>
                  <img src={m.data.url} alt={m.data.name} loading="lazy" />
                </button>
              ))}
            </div>
          </details>
        )}
        {categories.map(([cat, keys]) => (
          <details key={cat} open={cat !== 'Buildings'}>
            <summary className="smallcaps">{cat}</summary>
            <div className="lib-grid">
              {keys.map((k) => (
                <button key={k} draggable onDragStart={(e) => e.dataTransfer.setData('text/x-art', k)} onClick={() => addArt(k)} title={ART[k].label} aria-label={`Add ${ART[k].label}`}>
                  <ArtSvg art={k} />
                </button>
              ))}
            </div>
          </details>
        ))}
      </aside>

      <div className="editor-canvas-wrap">
        <div className="editor-toolbar" role="toolbar" aria-label="Canvas tools">
          {p.toolbarExtra}
          <span className="tool-group">
            <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out">－</button>
            <span className="zoom-val">{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">＋</button>
          </span>
          <label className="check"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> snap to grid</label>
        </div>
        <div className="editor-canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <div style={{ width: `${zoom * 100}%`, minWidth: 600 }} onPointerDown={(e) => { if ((e.target as Element).closest('.obj') === null && (e.target as Element).closest('.cloud-bank') === null) setSel(null); }}>
            <Scene
              svgRef={svgRef} editing width={p.width} height={p.height} objects={objs} regions={p.regions}
              background={<>{p.background}{snap && <GridLines w={p.width} h={p.height} />}</>}
              selectedId={sel} ariaLabel="Editing canvas"
              labelFor={(o) => o.label || (o.roomId ? p.rooms?.find((r) => r.id === o.roomId)?.name : undefined)}
              onObjectPointerDown={onObjectPointerDown}
              overlay={<>
                {selected && <SelectionBox o={selected} />}
                {guides.x !== undefined && <line x1={guides.x} x2={guides.x} y1={0} y2={p.height} className="guide" />}
                {guides.y !== undefined && <line y1={guides.y} y2={guides.y} x1={0} x2={p.width} className="guide" />}
              </>}
            />
          </div>
        </div>
        <p className="muted editor-help">Drag to move · drag the pink corner to resize · arrow keys nudge (shift = 10) · Delete removes · Ctrl/⌘+D duplicates · Ctrl/⌘+Z undoes.</p>
      </div>

      <aside className="editor-props" aria-label="Properties of the selected object">
        {!selected ? <p className="muted hand">Select something on the canvas to change it.</p> : (
          <Properties o={selected} rooms={p.rooms} regions={p.regions} kind={p.kind} lockRatio={lockRatio} setLockRatio={setLockRatio}
            update={(patch) => update(selected.id, patch)} onDelete={() => remove(selected)} onDuplicate={() => duplicate(selected)} onLayer={(d) => layer(selected, d)}
            onCenter={(axis) => update(selected.id, axis === 'x' ? { x: Math.round(p.width / 2 - selected.w / 2) } : { y: Math.round(p.height / 2 - selected.h / 2) })} />
        )}
      </aside>
    </div>
  );
}

function GridLines({ w, h }: { w: number; h: number }) {
  return (
    <g className="grid-lines" pointerEvents="none">
      <defs><pattern id="ed-grid" width={50} height={50} patternUnits="userSpaceOnUse"><path d="M50 0 H0 V50" fill="none" stroke="var(--c-ink)" strokeOpacity={0.08} /></pattern></defs>
      <rect width={w} height={h} fill="url(#ed-grid)" />
    </g>
  );
}

function SelectionBox({ o }: { o: SceneObject }) {
  return (
    <g transform={`translate(${o.x} ${o.y})`} pointerEvents="none">
      <rect width={o.w} height={o.h} className="sel-box" />
    </g>
  );
}

function Properties({ o, rooms, regions, kind, update, onDelete, onDuplicate, onLayer, onCenter, lockRatio, setLockRatio }: {
  o: SceneObject; rooms?: Room[]; regions?: Region[]; kind: 'world' | 'room'; lockRatio: boolean; setLockRatio: (v: boolean) => void;
  update: (p: Partial<SceneObject>) => void; onDelete: () => void; onDuplicate: () => void; onLayer: (d: 'up' | 'down' | 'front' | 'back') => void; onCenter: (a: 'x' | 'y') => void;
}) {
  const def = o.art ? ART[o.art] : null;
  const num = (k: keyof SceneObject, label: string) => (
    <label className="num"><span>{label}</span><input type="number" className="input" value={Math.round((o[k] as number) ?? 0)} onChange={(e) => update({ [k]: Number(e.target.value) } as any)} /></label>
  );
  return (
    <div className="props">
      <h3 className="smallcaps">{o.type === 'building' ? 'building' : o.type} {def ? `· ${def.label}` : ''}</h3>
      <div className="row wrap">
        <button className="btn small ghost" onClick={onDuplicate}>Duplicate</button>
        <button className="btn small danger" onClick={onDelete}>Delete</button>
      </div>
      {(o.type === 'building' || o.type === 'decor' || o.type === 'image' || o.type === 'link') && (
        <Field label="Label" hint={o.type === 'building' ? 'Shown on the sign under the building.' : 'Optional; read aloud to screen readers.'}><input className="input" value={o.label ?? ''} onChange={(e) => update({ label: e.target.value })} /></Field>
      )}
      {(o.type === 'text' || o.type === 'link') && <Field label="Text"><textarea className="input" rows={3} value={o.text ?? ''} onChange={(e) => update({ text: e.target.value })} /></Field>}
      {(o.type === 'building' || o.type === 'decor') && (
        <Field label="Artwork">
          <select className="input" value={o.art ?? ''} onChange={(e) => update({ art: e.target.value })}>
            {Object.entries(ART).map(([k, d]) => <option key={k} value={k}>{d.category} — {d.label}</option>)}
          </select>
        </Field>
      )}
      {o.type !== 'text' && o.type !== 'link' && <ImagePicker label={o.type === 'image' ? 'Image' : 'Replace artwork with my own image'} value={o.src} onChange={(src) => update({ src: src || undefined })} />}
      {o.type === 'image' && o.src && (
        <Field label="Frame">
          <select className="input" value={o.frame ?? ''} onChange={(e) => update({ frame: (e.target.value || undefined) as SceneObject['frame'] })}>
            <option value="">no frame</option><option value="gold">gilded frame</option><option value="lace">lace frame</option><option value="polaroid">polaroid</option><option value="oval">oval cameo</option>
          </select>
        </Field>
      )}
      {def?.slots && def.slots.length > 0 && !o.src && (
        <Field group label="Colours">
          <span className="row wrap">
            {def.slots.map((s) => (
              <label key={s} className="mini-color"><input type="color" value={o.colors?.[s] ?? '#ffffff'} onChange={(e) => update({ colors: { ...(o.colors ?? {}), [s]: e.target.value } })} /> {s}</label>
            ))}
            {o.colors && Object.keys(o.colors).length > 0 && <button className="btn small ghost" onClick={() => update({ colors: undefined })}>Use theme colours</button>}
          </span>
        </Field>
      )}
      {o.type === 'text' && <Field label="Text colour"><input type="color" value={o.colors?.text ?? '#4a2e35'} onChange={(e) => update({ colors: { ...(o.colors ?? {}), text: e.target.value } })} /></Field>}
      {(o.type === 'building' || o.type === 'link' || o.type === 'decor' || o.type === 'image') && (
        <Field group label="Opens…" hint="A room in your village, or any link.">
          <select className="input" aria-label="Opens" value={o.roomId ? `room:${o.roomId}` : o.href ? 'href' : ''} onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('room:')) update({ roomId: v.slice(5), href: undefined });
            else if (v === 'href') update({ roomId: undefined, href: o.href || 'https://' });
            else update({ roomId: undefined, href: undefined });
          }}>
            <option value="">nothing (decoration)</option>
            {rooms?.map((r) => <option key={r.id} value={`room:${r.id}`}>{r.name}{r.visibility !== 'public' ? ` (${r.visibility})` : ''}</option>)}
            <option value="href">a link…</option>
          </select>
          {!o.roomId && o.href !== undefined && <input className="input" value={o.href} onChange={(e) => update({ href: e.target.value })} placeholder="https://… or /dollhouse" />}
        </Field>
      )}
      <div className="num-grid">{num('x', 'x')}{num('y', 'y')}{num('w', 'width')}{num('h', 'height')}{num('rotation', 'rotate°')}{num('z', 'layer')}</div>
      <label className="check"><input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} /> keep proportions when resizing</label>
      <div className="row wrap">
        <button className="btn small ghost" onClick={() => onLayer('front')}>Bring to front</button>
        <button className="btn small ghost" onClick={() => onLayer('up')}>Forward</button>
        <button className="btn small ghost" onClick={() => onLayer('down')}>Backward</button>
        <button className="btn small ghost" onClick={() => onLayer('back')}>Send to back</button>
        <button className="btn small ghost" onClick={() => onCenter('x')}>Centre ↔</button>
        <button className="btn small ghost" onClick={() => onCenter('y')}>Centre ↕</button>
      </div>
      <Field label={`Opacity · ${Math.round((o.opacity ?? 1) * 100)}%`}><input type="range" min={0.1} max={1} step={0.05} value={o.opacity ?? 1} onChange={(e) => update({ opacity: Number(e.target.value) })} /></Field>
      <Field label="Little animation">
        <select className="input" value={o.animation ?? 'none'} onChange={(e) => update({ animation: e.target.value })}>{ANIMS.map((a) => <option key={a}>{a}</option>)}</select>
      </Field>
      <label className="check"><input type="checkbox" checked={!!o.flip} onChange={(e) => update({ flip: e.target.checked })} /> mirror</label>
      <label className="check"><input type="checkbox" checked={!!o.hidden} onChange={(e) => update({ hidden: e.target.checked })} /> hidden from visitors</label>
      {kind === 'world' && <label className="check"><input type="checkbox" checked={!!o.ownerOnly} onChange={(e) => update({ ownerOnly: e.target.checked })} /> only I can see this (private)</label>}
      {kind === 'world' && regions && regions.length > 0 && (
        <Field label="Belongs to region" hint="Objects in an unrevealed region stay hidden under the clouds until you reveal it.">
          <select className="input" value={o.regionId ?? ''} onChange={(e) => update({ regionId: e.target.value || undefined })}>
            <option value="">— the open village —</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}{r.revealed ? '' : ' (under clouds)'}</option>)}
          </select>
        </Field>
      )}
      <details>
        <summary className="smallcaps">easter egg</summary>
        <Field label="Secret message when clicked"><textarea className="input" rows={2} value={o.secret?.message ?? ''} onChange={(e) => update({ secret: { ...(o.secret ?? {}), message: e.target.value || undefined } })} /></Field>
        <Field label="Stamp it gives (a short word)"><input className="input" value={o.secret?.stamp ?? ''} onChange={(e) => update({ secret: { ...(o.secret ?? {}), stamp: e.target.value || undefined } })} /></Field>
        <Field label="Or: secretly opens room">
          <select className="input" value={o.secret?.roomId ?? ''} onChange={(e) => update({ secret: { ...(o.secret ?? {}), roomId: e.target.value || undefined } })}>
            <option value="">—</option>{rooms?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        {o.secret && <button className="btn small ghost" onClick={() => update({ secret: undefined })}>Remove easter egg</button>}
      </details>
    </div>
  );
}
