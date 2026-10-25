import { memo, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { Region, SceneObject } from '../../shared/types';
import { ART } from '../art';
import { tok } from '../art/palette';

// Renders any scene (the village map, or a freeform room) from its list of objects.
// The same component powers the visitor view and the Atelier editor, so what you arrange is what visitors see.

export interface SceneProps {
  width: number;
  height: number;
  objects: SceneObject[];
  regions?: Region[];
  background?: ReactNode;
  overlay?: ReactNode;
  editing?: boolean;
  selectedId?: string | null;
  labelFor?: (o: SceneObject) => string | undefined;
  onActivate?: (o: SceneObject) => void;
  onRegion?: (r: Region) => void;
  onObjectPointerDown?: (e: RPointerEvent, o: SceneObject) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  ariaLabel: string;
  showLabels?: 'hover' | 'always';
  /** Decorations that respond to a tap (fountain splashes, petals, lamps…). */
  isPlayful?: (o: SceneObject) => boolean;
  /** Extra classes per object (e.g. a lamp switched off). */
  classFor?: (o: SceneObject) => string | undefined;
}

export const ObjectArt = memo(function ObjectArt({ o }: { o: SceneObject }) {
  if (o.type === 'image' && o.src) {
    if (o.frame) return <FramedImage o={o} />;
    return <image href={o.src} width={o.w} height={o.h} preserveAspectRatio="xMidYMid meet" />;
  }
  if (o.type === 'text') {
    return (
      <foreignObject width={o.w} height={o.h}>
        <div className="scene-text" style={{ color: o.colors?.text }}>{o.text}</div>
      </foreignObject>
    );
  }
  if (o.type === 'link') {
    return (
      <g>
        <path d={`M4 6 H${o.w - 14} L${o.w - 2} ${o.h / 2} L${o.w - 14} ${o.h - 6} H4 Z`} fill={o.colors?.paper ?? tok('cream')} stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={1.5} />
        <foreignObject x={8} y={4} width={o.w - 24} height={o.h - 8}>
          <div className="scene-link-text">{o.text || o.label || o.href}</div>
        </foreignObject>
      </g>
    );
  }
  const def = o.src ? null : ART[o.art ?? ''];
  if (o.src) return <image href={o.src} width={o.w} height={o.h} preserveAspectRatio="xMidYMax meet" />;
  if (!def) return <rect width={o.w} height={o.h} rx={8} fill={tok('blush')} stroke={tok('rose')} strokeDasharray="4 4" />;
  return (
    <svg width={o.w} height={o.h} viewBox={def.viewBox} preserveAspectRatio="xMidYMax meet" overflow="visible" aria-hidden>
      {def.render(o.colors)}
    </svg>
  );
});

/** A photo hung in a frame: gilded, lace, polaroid or a little oval cameo. */
function FramedImage({ o }: { o: SceneObject }) {
  const { w, h } = o; const f = o.frame!;
  const pad = f === 'polaroid' ? Math.min(w, h) * 0.07 : Math.min(w, h) * 0.09;
  const bottom = f === 'polaroid' ? pad * 3 : pad;
  const clip = `fr-${o.id}`;
  const iw = w - pad * 2; const ih = h - pad - bottom;
  return (
    <g className={`framed frame-${f}`}>
      <defs><clipPath id={clip}>{f === 'oval' ? <ellipse cx={w / 2} cy={pad + ih / 2} rx={iw / 2} ry={ih / 2} /> : <rect x={pad} y={pad} width={iw} height={ih} />}</clipPath></defs>
      {f === 'oval'
        ? <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={tok('gold')} stroke={tok('ink')} strokeOpacity={0.35} strokeWidth={2} />
        : <rect width={w} height={h} rx={f === 'lace' ? 10 : 3} fill={f === 'gold' ? tok('gold') : f === 'lace' ? tok('trim') : '#fffdf8'} stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={1.5} />}
      {f === 'lace' && <rect x={pad / 3} y={pad / 3} width={w - (pad * 2) / 3} height={h - (pad * 2) / 3} rx={8} fill="none" stroke={tok('pink')} strokeWidth={2} strokeDasharray="2 4" />}
      {f === 'gold' && <rect x={pad / 2} y={pad / 2} width={w - pad} height={h - pad} fill="none" stroke={tok('cream')} strokeOpacity={0.6} strokeWidth={1.2} />}
      <image href={o.src} x={pad} y={pad} width={iw} height={ih} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
    </g>
  );
}

function Signboard({ o, text }: { o: SceneObject; text: string }) {
  const w = Math.max(90, text.length * 8.6 + 28);
  return (
    <g className="signboard" transform={`translate(${o.w / 2 - w / 2} ${o.h + 4})`} pointerEvents="none">
      <rect width={w} height={30} rx={8} fill={tok('paper')} stroke={tok('rose')} strokeWidth={1.5} />
      <rect x={3} y={3} width={w - 6} height={24} rx={6} fill="none" stroke={tok('gold')} strokeWidth={0.8} strokeDasharray="2 2" />
      <text x={w / 2} y={20} textAnchor="middle" className="signboard-text">{text}</text>
    </g>
  );
}

function CloudBank({ r, onClick, editing }: { r: Region; onClick?: () => void; editing?: boolean }) {
  const puffs: [number, number, number][] = [];
  const cols = Math.max(2, Math.round(r.w / 70)); const rows = Math.max(1, Math.round(r.h / 70));
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) puffs.push([r.x + (i / cols) * r.w, r.y + (j / rows) * r.h, 46 + ((i * 7 + j * 13) % 20)]);
  return (
    <g className={`cloud-bank ${editing ? 'editing' : ''}`} role="button" tabIndex={0} aria-label={`${r.name} — not yet revealed. ${r.mystery}`}
      onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={tok('trim')} opacity={0.75} rx={40} />
      {puffs.map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={s} fill={tok('trim')} opacity={0.9} className="puff" style={{ animationDelay: `${(i % 5) * -1.3}s` }} />)}
      <g transform={`translate(${r.x + r.w / 2} ${r.y + r.h / 2})`}>
        <text textAnchor="middle" className="cloud-label" y={-4}>{editing ? r.name : '✧ undiscovered ✧'}</text>
        <text textAnchor="middle" className="cloud-sub" y={16}>{editing ? '(hidden from visitors)' : 'tap to listen'}</text>
      </g>
    </g>
  );
}

export function Scene(p: SceneProps) {
  const sorted = [...p.objects].filter((o) => p.editing || !o.hidden).sort((a, b) => a.z - b.z);
  const key = (o: SceneObject) => (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && p.onActivate) { e.preventDefault(); p.onActivate(o); }
  };
  return (
    <svg ref={p.svgRef} className={`scene ${p.editing ? 'is-editing' : ''} labels-${p.showLabels ?? 'hover'}`} viewBox={`0 0 ${p.width} ${p.height}`} role="group" aria-label={p.ariaLabel}>
      {p.background}
      {sorted.map((o) => {
        const playful = !p.editing && !o.roomId && !o.href && !o.secret && !!p.isPlayful?.(o);
        const interactive = !p.editing && (o.roomId || o.href || o.secret || playful);
        const label = p.labelFor?.(o) ?? o.label;
        const cx = o.w / 2; const cy = o.h / 2;
        return (
          <g key={o.id}
            className={`obj type-${o.type} ${interactive ? 'interactive' : ''} ${p.selectedId === o.id ? 'selected' : ''} ${o.hidden ? 'is-hidden' : ''} ${o.ownerOnly ? 'owner-only' : ''} ${playful ? 'playful' : ''} ${p.classFor?.(o) ?? ''}`}
            transform={`translate(${o.x} ${o.y})${o.rotation ? ` rotate(${o.rotation} ${cx} ${cy})` : ''}`}
            opacity={o.hidden ? 0.35 : o.opacity ?? 1}
            data-id={o.id}
            tabIndex={interactive ? 0 : p.editing ? -1 : undefined}
            role={interactive ? (o.roomId || o.href ? 'link' : 'button') : undefined}
            aria-label={interactive ? (playful ? `tap the ${(label || ART[o.art ?? '']?.label || 'decoration').toLowerCase()}` : label || (o.secret ? 'something curious' : undefined)) : undefined}
            onClick={interactive ? () => p.onActivate?.(o) : undefined}
            onKeyDown={interactive ? key(o) : undefined}
            onPointerDown={p.onObjectPointerDown ? (e) => p.onObjectPointerDown!(e, o) : undefined}
          >
            <g className={`anim anim-${o.animation ?? 'none'}`} style={{ transformOrigin: `${cx}px ${o.h}px` }}>
              <g transform={o.flip ? `translate(${o.w} 0) scale(-1 1)` : undefined}>
                <ObjectArt o={o} />
              </g>
            </g>
            {(o.type === 'building' || p.editing) && label && <Signboard o={o} text={label} />}
            {p.editing && <rect className="hitbox" width={o.w} height={o.h} />}
            {p.editing && p.selectedId === o.id && <rect className="resize-handle" x={o.w - 10} y={o.h - 10} width={20} height={20} rx={5} aria-label="Resize" />}
          </g>
        );
      })}
      {p.regions?.filter((r) => !r.revealed).map((r) => <CloudBank key={r.id} r={r} editing={p.editing} onClick={() => p.onRegion?.(r)} />)}
      {p.overlay}
    </svg>
  );
}
