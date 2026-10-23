import { ART } from '../art';
import { tok } from '../art/palette';

// Little illustrated scenes for the polaroid cards, composed from the shared artwork library.
type Piece = [art: string, x: number, y: number, w: number, h: number];
const SCENES: Record<string, Piece[]> = {
  inbox: [['letter', 30, 40, 110, 90], ['letter', 70, 20, 100, 80], ['bow', 120, 10, 50, 40], ['rosebush', 140, 95, 60, 45]],
  reading: [['books', 20, 50, 100, 100], ['teacup', 60, 8, 70, 60], ['bunny', 130, 90, 60, 60]],
  diary: [['diary', 20, 30, 160, 110], ['flowerpot', 150, 80, 50, 60]],
  bookmarks: [['stamp', 20, 30, 70, 90], ['letter', 80, 50, 100, 80], ['heart', 150, 15, 40, 40]],
  favorites: [['mirror', 20, 10, 100, 120], ['candle', 120, 50, 50, 90], ['rosebush', 140, 100, 60, 45]],
  closet: [['dresses', 10, 10, 180, 130]],
  picks: [['books', 10, 60, 90, 90], ['star', 110, 20, 40, 40], ['teacup', 100, 70, 70, 60], ['bunny', 150, 100, 50, 50]],
  rabbit: [['telescope', 20, 20, 110, 110], ['moon', 140, 10, 45, 45], ['star', 150, 70, 26, 26]],
  discoveries: [['stamp', 110, 20, 70, 90], ['letter', 20, 60, 100, 80], ['heart', 40, 10, 40, 40]],
  collections: [['letter', 20, 40, 120, 90], ['pearls', 90, 10, 100, 60], ['bow', 130, 90, 50, 40]],
};

function Diary() {
  return (
    <g>
      <path d="M10 20 Q50 5 100 18 Q150 5 190 20 V120 Q150 105 100 118 Q50 105 10 120 Z" fill={tok('cream')} stroke={tok('ink')} strokeOpacity={0.35} strokeWidth={3} />
      <path d="M100 18 V118" stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={2} />
      {[40, 55, 70, 85].map((y) => <path key={y} d={`M24 ${y} Q55 ${y - 6} 88 ${y}`} stroke={tok('inkSoft')} strokeOpacity={0.5} strokeWidth={2} fill="none" />)}
      {[40, 55, 70].map((y) => <path key={y} d={`M112 ${y} Q145 ${y - 6} 176 ${y}`} stroke={tok('inkSoft')} strokeOpacity={0.5} strokeWidth={2} fill="none" />)}
      <path d="M130 110 L185 40" stroke={tok('gold')} strokeWidth={4} strokeLinecap="round" />
      <path d="M185 40 q10 -20 4 -34 q-12 14 -10 30 z" fill={tok('trim')} stroke={tok('ink')} strokeOpacity={0.3} />
    </g>
  );
}
function Dresses() {
  return (
    <g>
      <path d="M10 14 H190" stroke={tok('gold')} strokeWidth={4} strokeLinecap="round" />
      {[30, 75, 120, 165].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 14 v8`} stroke={tok('inkSoft')} strokeWidth={2} />
          <path d={`M${x - 10} 24 L${x} 30 L${x + 10} 24 L${x + 6} 50 L${x + 24} 120 H${x - 24} L${x - 6} 50 Z`} fill={[tok('pink'), tok('cream'), tok('blush'), tok('trim')][i]} stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={1.5} />
          <path d={`M${x - 22} 112 q11 6 22 0 q11 6 22 0`} stroke={tok('rose')} strokeWidth={2} fill="none" />
          <circle cx={x} cy={40} r={3} fill={tok('rose')} />
        </g>
      ))}
    </g>
  );
}

export function Vignette({ kind }: { kind: string }) {
  const pieces = SCENES[kind] ?? SCENES.inbox;
  return (
    <svg viewBox="0 0 200 150" className="vignette" aria-hidden>
      <rect width={200} height={150} fill={tok('blush')} />
      <path d="M0 110 H200 V150 H0 Z" fill={tok('cream')} />
      {pieces.map(([art, x, y, w, h], i) => {
        if (art === 'diary') return <g key={i} transform={`translate(${x} ${y}) scale(${w / 200} ${h / 140})`}><Diary /></g>;
        if (art === 'dresses') return <g key={i} transform={`translate(${x} ${y}) scale(${w / 200} ${h / 130})`}><Dresses /></g>;
        const def = ART[art];
        return <svg key={i} x={x} y={y} width={w} height={h} viewBox={def.viewBox} overflow="visible">{def.render()}</svg>;
      })}
    </svg>
  );
}
