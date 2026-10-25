import { useEffect, useMemo, useRef, useState } from 'react';
import { items as itemsApi } from '../lib/api';
import { award } from '../lib/progress';
import { hostOf } from '../lib/util';
import { useItems } from '../rooms/common';
import { Empty, Loading } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';

// The Rabbit-hole Map: every expedition is a star (its topic), and its discoveries orbit it.
// Drag things where they make sense to you, draw threads between ideas, zoom and pan, search.
// Positions and threads are saved on each expedition (data.map); the discoveries never change.

interface Discovery { id: string; url?: string; title?: string; note?: string }
// Threads are stored as {from, to}: Firestore (the cloud version) refuses arrays inside arrays.
// Older maps saved as [from, to] pairs are still read.
type Thread = { from: string; to: string };
interface MapData { pos?: Record<string, [number, number]>; links?: (Thread | [string, string])[] }
const pairOf = (l: Thread | [string, string]): [string, string] => (Array.isArray(l) ? l : [l.from, l.to]);
const sameThread = (l: Thread | [string, string], a: string, b: string) => { const [x, y] = pairOf(l); return (x === a && y === b) || (x === b && y === a); };
interface Expedition { title: string; goal?: string; discoveries: Discovery[]; map?: MapData }
interface Node { id: string; kind: 'topic' | 'find'; label: string; exp: string; d?: Discovery; x: number; y: number }

const W = 1600; const H = 1000;
/** Where a node sits when you haven't placed it yourself: topics on a ring, finds around them. */
export function defaultLayout(exps: { id: string; data: Expedition }[]) {
  const pos: Record<string, [number, number]> = {};
  const n = Math.max(1, exps.length);
  exps.forEach((e, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const cx = W / 2 + (n > 1 ? Math.cos(a) * 470 : 0); const cy = H / 2 + (n > 1 ? Math.sin(a) * 300 : 0);
    pos[`x:${e.id}`] = [cx, cy];
    const k = Math.max(1, e.data.discoveries.length);
    e.data.discoveries.forEach((d, j) => { const b = (j / k) * Math.PI * 2; pos[`d:${d.id}`] = [cx + Math.cos(b) * 150, cy + Math.sin(b) * 110]; });
  });
  return pos;
}

export function RabbitMapPage() {
  const exps = useItems<Expedition>('expedition');
  const list = exps.data ?? [];
  const [local, setLocal] = useState<Record<string, MapData>>({});
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H });
  const [q, setQ] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [threading, setThreading] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id?: string; pan?: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const saveTimers = useRef<Record<string, number>>({});
  useEffect(() => { if (exps.data) setLocal(Object.fromEntries(exps.data.map((e) => [e.id, e.data.map ?? {}]))); }, [exps.data]);

  const base = useMemo(() => defaultLayout(list), [list]);
  const ownerOf = (nodeId: string) => (nodeId.startsWith('x:') ? nodeId.slice(2) : list.find((e) => e.data.discoveries.some((d) => `d:${d.id}` === nodeId))?.id);
  const nodes: Node[] = useMemo(() => list.filter((e) => !hidden.has(e.id)).flatMap((e) => {
    const p = (id: string) => local[e.id]?.pos?.[id] ?? base[id] ?? [W / 2, H / 2];
    return [
      { id: `x:${e.id}`, kind: 'topic' as const, label: e.data.title, exp: e.id, x: p(`x:${e.id}`)[0], y: p(`x:${e.id}`)[1] },
      ...e.data.discoveries.map((d) => ({ id: `d:${d.id}`, kind: 'find' as const, label: d.title || hostOf(d.url ?? '') || 'a find', exp: e.id, d, x: p(`d:${d.id}`)[0], y: p(`d:${d.id}`)[1] })),
    ];
  }), [list, local, base, hidden]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const threads = Object.values(local).flatMap((m) => (m.links ?? []).map(pairOf)).filter(([a, b]) => byId.has(a) && byId.has(b));
  const match = (n: Node) => !q || `${n.label} ${n.d?.note ?? ''} ${n.d?.url ?? ''}`.toLowerCase().includes(q.toLowerCase());

  const persist = (expId: string, m: MapData) => {
    window.clearTimeout(saveTimers.current[expId]);
    saveTimers.current[expId] = window.setTimeout(() => { itemsApi.update(expId, { data: { map: m } }).catch(() => {}); }, 500);
  };
  const setMap = (expId: string, fn: (m: MapData) => MapData) => setLocal((l) => { const m = fn(l[expId] ?? {}); persist(expId, m); return { ...l, [expId]: m }; });
  const toSvg = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect();
    return [view.x + ((cx - r.left) / r.width) * view.w, view.y + ((cy - r.top) / r.height) * view.h];
  };
  const down = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const n = id ? byId.get(id) : undefined;
    drag.current = { id, pan: !id, sx: e.clientX, sy: e.clientY, ox: n ? n.x : view.x, oy: n ? n.y : view.y, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const g = drag.current; if (!g) return;
    const r = svg.current!.getBoundingClientRect();
    const dx = ((e.clientX - g.sx) / r.width) * view.w; const dy = ((e.clientY - g.sy) / r.height) * view.h;
    if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
    if (g.pan) setView((v) => ({ ...v, x: g.ox - dx, y: g.oy - dy }));
    else if (g.id && g.moved) { const owner = ownerOf(g.id)!; setMap(owner, (m) => ({ ...m, pos: { ...(m.pos ?? {}), [g.id!]: [Math.round(g.ox + dx), Math.round(g.oy + dy)] } })); }
  };
  const up = () => {
    const g = drag.current; drag.current = null;
    if (!g?.id || g.moved) { if (g?.id) award('cartographer'); return; }
    // A click (not a drag): select, or finish a thread.
    if (threading && threading !== g.id) {
      const owner = ownerOf(threading)!; const pair: [string, string] = [threading, g.id];
      setMap(owner, (m) => {
        const links = (m.links ?? []).map((l) => { const [from, to] = pairOf(l); return { from, to }; });
        const exists = links.some((l) => sameThread(l, pair[0], pair[1]));
        return { ...m, links: exists ? links.filter((l) => !sameThread(l, pair[0], pair[1])) : [...links, { from: pair[0], to: pair[1] }] };
      });
      // A thread may have been stored on the other node's expedition.
      const other = ownerOf(g.id)!;
      if (other !== owner) setMap(other, (m) => ({ ...m, links: (m.links ?? []).filter((l) => !sameThread(l, pair[0], pair[1])).map((l) => { const [from, to] = pairOf(l); return { from, to }; }) }));
      setThreading(null); award('cartographer');
    } else setSel(g.id);
  };
  const zoom = (f: number, at?: [number, number]) => setView((v) => {
    const w = Math.min(W * 3, Math.max(300, v.w * f)); const h = (w / v.w) * v.h;
    const [cx, cy] = at ?? [v.x + v.w / 2, v.y + v.h / 2];
    return { x: cx - ((cx - v.x) * w) / v.w, y: cy - ((cy - v.y) * h) / v.h, w, h };
  });
  const selected = sel ? byId.get(sel) : undefined;

  return (
    <ModeShell mode="stargirl">
      <SectionTitle title="The Rabbit-hole Map" sub="discoveries · threads · where curiosity led" />
      {exps.loading && <Loading what="Unrolling the map" />}
      {!exps.loading && list.length === 0 && <Empty title="An empty sky" art="✦">Go on an expedition in Rabbit Holes; each one becomes a star here, with its discoveries around it.</Empty>}
      {list.length > 0 && (
        <>
          <div className="row wrap gap map-tools">
            <input className="input" type="search" placeholder="Search the map…" aria-label="Search the map" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="tool-group" role="group" aria-label="Zoom">
              <button className="icon-btn" aria-label="Zoom in" onClick={() => zoom(0.8)}>＋</button>
              <button className="icon-btn" aria-label="Zoom out" onClick={() => zoom(1.25)}>－</button>
              <button className="btn small ghost" onClick={() => setView({ x: 0, y: 0, w: W, h: H })}>Fit</button>
            </span>
            <button className={`btn small ${threading ? '' : 'ghost'}`} aria-pressed={!!threading} disabled={!sel && !threading} onClick={() => setThreading(threading ? null : sel)}>
              {threading ? 'Now click another node… (or here to cancel)' : '🧵 Draw a thread from the selected node'}
            </button>
          </div>
          <div className="row wrap gap map-topics" role="group" aria-label="Expeditions shown">
            {list.map((e) => <button key={e.id} className={`chip ${hidden.has(e.id) ? '' : 'on'}`} aria-pressed={!hidden.has(e.id)} onClick={() => setHidden((h) => { const n = new Set(h); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })}>{e.data.title}</button>)}
          </div>
          <div className="map-wrap">
            <svg ref={svg} className="rabbit-map" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="group" aria-label="Discovery map"
              onPointerDown={(e) => down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9, toSvg(e.clientX, e.clientY) as [number, number]); }}>
              <rect x={-W * 2} y={-H * 2} width={W * 5} height={H * 5} fill="transparent" />
              {nodes.filter((n) => n.kind === 'find').map((n) => { const t = byId.get(`x:${n.exp}`)!; return <line key={`o${n.id}`} x1={t.x} y1={t.y} x2={n.x} y2={n.y} className="map-orbit" />; })}
              {threads.map(([a, b]) => {
                const p = byId.get(a)!; const r = byId.get(b)!;
                const len = Math.hypot(r.x - p.x, r.y - p.y) || 1; const bend = Math.min(90, len * 0.2);
                const cx = (p.x + r.x) / 2 + ((r.y - p.y) / len) * bend; const cy = (p.y + r.y) / 2 - ((r.x - p.x) / len) * bend;
                return <path key={`${a}-${b}`} className="map-thread" d={`M${p.x} ${p.y} Q${cx} ${cy} ${r.x} ${r.y}`} />;
              })}
              {nodes.map((n) => (
                <g key={n.id} className={`map-node ${n.kind} ${sel === n.id ? 'selected' : ''} ${threading === n.id ? 'threading' : ''} ${match(n) ? '' : 'dim'}`} transform={`translate(${n.x} ${n.y})`}
                  onPointerDown={(e) => down(e, n.id)} role="button" tabIndex={0} aria-label={`${n.kind === 'topic' ? 'Expedition' : 'Discovery'}: ${n.label}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSel(n.id); }}>
                  {n.kind === 'topic' ? <><circle r={46} className="map-star-halo" /><path d="M0 -30 L8 -9 L30 -9 L12 4 L19 26 L0 13 L-19 26 L-12 4 L-30 -9 L-8 -9 Z" className="map-star" /></> : <circle r={18} className="map-find" />}
                  <text y={n.kind === 'topic' ? 66 : 38} textAnchor="middle" className="map-label">{n.label.length > 30 ? n.label.slice(0, 28) + '…' : n.label}</text>
                </g>
              ))}
            </svg>
            {selected && (
              <aside className="map-panel lace-card" aria-label="Selected">
                <button className="icon-btn close" aria-label="Close" onClick={() => setSel(null)}>✕</button>
                <p className="smallcaps">{selected.kind === 'topic' ? 'expedition' : 'discovery'}</p>
                <h3 className="script">{selected.label}</h3>
                {selected.d?.note && <p className="hand">{selected.d.note}</p>}
                {selected.d?.url && <p><a href={selected.d.url} target="_blank" rel="noopener noreferrer">{hostOf(selected.d.url)} ↗</a></p>}
                <p className="muted small">{threads.filter(([a, b]) => a === selected.id || b === selected.id).length} thread(s)</p>
              </aside>
            )}
          </div>
          <p className="muted small center">Drag to arrange · drag the background to pan · scroll or ＋/－ to zoom · select a node, then “Draw a thread” and click another to connect (do it again to undo).</p>
        </>
      )}
    </ModeShell>
  );
}
