import { line, thin, pick, tok, type ArtColors } from './palette';
import { Bow, Shadow } from './buildings';

// Decorations, creatures and little objects. Each draws into a 100×100 box (ground at y≈96).

type P = { c?: ArtColors };
const fill = (c: ArtColors | undefined, k: string, t: string) => pick(c, k, t);

export function TreeRound({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={30} ry={4} fill="var(--c-ink)" opacity={0.12} />
      <path d="M46 96 V60 h8 V96 Z" fill={tok('inkSoft')} opacity={0.75} />
      <circle cx={50} cy={42} r={30} fill={fill(c, 'leaf', 'sageDeep')} {...line} />
      <circle cx={34} cy={52} r={16} fill={fill(c, 'leaf', 'sageDeep')} />
      <circle cx={66} cy={52} r={16} fill={fill(c, 'leaf', 'sageDeep')} />
      <circle cx={42} cy={32} r={14} fill={tok('sage')} opacity={0.7} />
      {[[30, 46], [62, 38], [52, 60], [40, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill={tok('pink')} />)}
    </g>
  );
}
export function TreeBlossom({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={30} ry={4} fill="var(--c-ink)" opacity={0.12} />
      <path d="M48 96 C46 80 40 70 32 62 M50 96 C52 78 60 66 70 58 M49 80 V50" stroke={tok('inkSoft')} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
      {[[30, 44, 18], [52, 30, 22], [72, 44, 17], [42, 56, 14], [62, 58, 14]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? fill(c, 'blossom', 'pink') : tok('blush')} {...thin} />
      ))}
      {[[26, 40], [56, 24], [74, 48], [46, 52], [38, 30], [64, 36]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill={tok('roseDeep')} opacity={0.6} />)}
    </g>
  );
}
export function TreeCypress({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={22} ry={3} fill="var(--c-ink)" opacity={0.12} />
      <path d="M50 4 C76 30 76 70 54 94 H46 C24 70 24 30 50 4 Z" fill={fill(c, 'leaf', 'sageDeep')} {...line} />
      <path d="M50 14 C62 34 62 62 50 84" stroke={tok('sage')} strokeWidth={3} fill="none" opacity={0.6} />
    </g>
  );
}
export function RoseBush({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={94} rx={44} ry={5} fill="var(--c-ink)" opacity={0.12} />
      <path d="M8 92 C6 60 30 44 50 48 C72 44 96 60 92 92 Z" fill={tok('sageDeep')} {...line} />
      {[[24, 66], [44, 56], [64, 60], [80, 74], [36, 80], [58, 80], [16, 82]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r={7} fill={i % 3 === 0 ? tok('trim') : fill(c, 'rose', i % 2 ? 'pink' : 'rose')} {...thin} />
          <path d="M-3 0 a3 3 0 1 1 3 3" stroke={tok('roseDeep')} strokeWidth={1.2} fill="none" opacity={0.7} />
        </g>
      ))}
    </g>
  );
}
export function HedgeArch(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={48} ry={4} fill="var(--c-ink)" opacity={0.12} />
      <path d="M2 96 V40 Q50 -6 98 40 V96 H72 V58 Q50 34 28 58 V96 Z" fill={tok('sageDeep')} {...line} />
      <path d="M28 96 V58 Q50 34 72 58 V96 Z" fill={tok('ink')} opacity={0.35} />
      {[[10, 40], [22, 24], [40, 14], [62, 14], [80, 26], [90, 46], [8, 70], [92, 72]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={i % 2 ? tok('pink') : tok('trim')} />)}
      <Bow x={50} y={30} s={0.7} />
    </g>
  );
}
export function Lamppost(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={20} ry={3} fill="var(--c-ink)" opacity={0.15} />
      <path d="M46 96 h8 l-1 -70 h-6 z" fill={tok('ink')} opacity={0.7} />
      <path d="M36 28 h28 l-4 -18 h-20 z" fill={tok('window')} {...thin} className="glow-window lamp" />
      <path d="M34 10 h32 l-16 -8 z" fill={tok('ink')} opacity={0.7} />
      <Bow x={50} y={34} s={0.6} />
    </g>
  );
}
export function Bench(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={46} ry={4} fill="var(--c-ink)" opacity={0.12} />
      <path d="M10 56 Q50 30 90 56 V62 H10 Z" fill={tok('trim')} {...line} />
      <rect x={8} y={66} width={84} height={8} rx={3} fill={tok('trim')} {...line} />
      <path d="M16 74 V94 M84 74 V94 M16 62 V66 M84 62 V66" stroke={tok('inkSoft')} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={34} cy={64} rx={12} ry={5} fill={tok('pink')} {...thin} />
    </g>
  );
}
export function Gate(_: P) {
  return (
    <g>
      <rect x={4} y={30} width={12} height={66} fill={tok('cream')} {...line} />
      <rect x={84} y={30} width={12} height={66} fill={tok('cream')} {...line} />
      <circle cx={10} cy={26} r={6} fill={tok('cream')} {...line} />
      <circle cx={90} cy={26} r={6} fill={tok('cream')} {...line} />
      <path d="M16 40 Q50 6 84 40" stroke={tok('ink')} strokeOpacity={0.55} strokeWidth={3} fill="none" />
      {[22, 32, 42, 58, 68, 78].map((x) => <path key={x} d={`M${x} ${x < 50 ? 36 - (x - 16) / 2 : 36 - (84 - x) / 2} V94`} stroke={tok('ink')} strokeOpacity={0.5} strokeWidth={2} />)}
      <path d="M16 70 H84" stroke={tok('ink')} strokeOpacity={0.5} strokeWidth={2} />
      <path d="M50 22 c-4 -6 -12 -1 -7 4 l7 6 l7 -6 c5 -5 -3 -10 -7 -4 z" fill={tok('rose')} {...thin} />
      {/* climbing roses */}
      {[[8, 50], [12, 64], [6, 80], [92, 48], [88, 66], [94, 82]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={i % 2 ? tok('pink') : tok('rose')} {...thin} />)}
    </g>
  );
}
export function Fence(_: P) {
  return (
    <g>
      <path d="M0 34 H200 M0 48 H200" stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={7} />
      <path d="M0 34 H200 M0 48 H200" stroke={tok('trim')} strokeWidth={5} />
      {[4, 28, 52, 76, 100, 124, 148, 172].map((x) => <path key={x} d={`M${x} 58 V14 l9 -9 l9 9 V58 Z`} fill={tok('trim')} {...thin} />)}
      {[40, 112, 184].map((x) => <circle key={x} cx={x - 6} cy={30} r={4} fill={tok('pink')} {...thin} />)}
    </g>
  );
}
export function Mushrooms(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={95} rx={40} ry={4} fill="var(--c-ink)" opacity={0.12} />
      <path d="M30 94 V64 h12 V94 Z M62 94 V74 h9 V94 Z" fill={tok('cream')} {...thin} />
      <path d="M14 66 Q36 22 58 66 Z" fill={tok('rose')} {...line} />
      <path d="M52 76 Q66 50 82 76 Z" fill={tok('pink')} {...line} />
      {[[28, 52], [40, 46], [46, 58], [64, 66], [72, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.6} fill={tok('trim')} />)}
    </g>
  );
}
export function Signpost(_: P) {
  return (
    <g>
      <rect x={46} y={20} width={8} height={76} fill={tok('inkSoft')} opacity={0.8} />
      <path d="M14 24 H78 L88 32 L78 40 H14 Z" fill={tok('cream')} {...line} />
      <path d="M86 48 H22 L12 56 L22 64 H86 Z" fill={tok('blush')} {...line} />
      <path d="M24 32 H70 M28 56 H76" stroke={tok('roseDeep')} strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />
      <Bow x={50} y={20} s={0.6} />
    </g>
  );
}
export function Bunny({ c }: P) {
  const fur = fill(c, 'fur', 'trim');
  return (
    <g>
      <ellipse cx={50} cy={95} rx={30} ry={4} fill="var(--c-ink)" opacity={0.15} />
      <ellipse cx={50} cy={74} rx={28} ry={22} fill={fur} {...line} />
      <circle cx={30} cy={56} r={16} fill={fur} {...line} />
      <path d="M22 44 C12 18 20 6 26 10 C32 14 30 32 30 42" fill={fur} {...line} />
      <path d="M32 42 C34 16 44 8 48 14 C52 20 42 34 38 44" fill={fur} {...line} />
      <path d="M24 38 C18 22 22 14 25 16" stroke={tok('pink')} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={24} cy={56} r={2.4} fill={tok('ink')} opacity={0.8} />
      <circle cx={16} cy={61} r={2} fill={tok('pink')} />
      <circle cx={78} cy={74} r={7} fill={fur} {...thin} />
      <Bow x={40} y={44} s={0.55} />
    </g>
  );
}
export function Deer(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={34} ry={4} fill="var(--c-ink)" opacity={0.14} />
      <path d="M30 60 Q50 46 74 58 Q84 64 80 72 Q60 80 34 74 Z" fill={tok('gold')} {...line} />
      {[34, 42, 66, 74].map((x) => <path key={x} d={`M${x} 72 V96`} stroke={tok('gold')} strokeWidth={4.5} strokeLinecap="round" />)}
      {[34, 42, 66, 74].map((x) => <path key={'s' + x} d={`M${x} 94 V96`} stroke={tok('ink')} strokeOpacity={0.5} strokeWidth={4.5} strokeLinecap="round" />)}
      <path d="M30 62 Q24 44 26 30 L36 32 Q38 48 40 60 Z" fill={tok('gold')} {...line} />
      <ellipse cx={26} cy={26} rx={10} ry={8} fill={tok('gold')} {...line} />
      <path d="M18 18 q-8 -6 -10 -2 q4 6 10 6 M30 18 q8 -6 10 -2 q-4 6 -10 6" fill={tok('gold')} {...thin} />
      <circle cx={22} cy={25} r={1.8} fill={tok('ink')} />
      <circle cx={17} cy={29} r={1.6} fill={tok('ink')} opacity={0.6} />
      {[[50, 58], [58, 56], [66, 60], [54, 64]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.8} fill={tok('trim')} />)}
      <Bow x={34} y={38} s={0.55} />
    </g>
  );
}
export function Swan(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={88} rx={40} ry={6} fill={tok('water')} opacity={0.7} />
      <path d="M20 80 Q30 54 70 62 Q86 66 84 80 Z" fill={tok('trim')} {...line} />
      <path d="M30 70 Q16 40 30 22 Q40 14 44 24 Q36 28 34 44 Q34 58 40 68" fill="none" stroke={tok('trim')} strokeWidth={7} strokeLinecap="round" />
      <path d="M30 70 Q16 40 30 22 Q40 14 44 24" fill="none" stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={1.5} />
      <path d="M44 24 l8 3 l-8 2 z" fill={tok('gold')} />
      <circle cx={38} cy={22} r={1.4} fill={tok('ink')} />
    </g>
  );
}
export function Butterfly(_: P) {
  return (
    <g>
      <path d="M50 50 C30 20 10 30 20 50 C10 70 34 76 50 54 Z" fill={tok('pink')} {...line} />
      <path d="M50 50 C70 20 90 30 80 50 C90 70 66 76 50 54 Z" fill={tok('blush')} {...line} />
      <path d="M50 36 V70" stroke={tok('ink')} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      <path d="M50 36 q-6 -12 -12 -14 M50 36 q6 -12 12 -14" stroke={tok('ink')} strokeWidth={1.4} fill="none" opacity={0.5} />
    </g>
  );
}
export function BowDecor({ c }: P) {
  return <g><Bow x={50} y={42} s={2.6} fill={fill(c, 'ribbon', 'rose')} /></g>;
}
export function Chest(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={95} rx={42} ry={4} fill="var(--c-ink)" opacity={0.14} />
      <path d="M10 50 Q50 14 90 50 Z" fill={tok('roseDeep')} {...line} />
      <rect x={10} y={50} width={80} height={44} rx={4} fill={tok('rose')} {...line} />
      <path d="M10 50 H90 M30 50 V94 M70 50 V94" stroke={tok('gold')} strokeWidth={4} />
      <rect x={43} y={52} width={14} height={16} rx={3} fill={tok('gold')} {...thin} />
      {[18, 26, 74, 82].map((x) => <circle key={x} cx={x} cy={46} r={2.5} fill={tok('trim')} />)}
    </g>
  );
}
export function Pearls(_: P) {
  return <g>{Array.from({ length: 13 }, (_, i) => { const t = i / 12; return <circle key={i} cx={6 + t * 88} cy={30 + Math.sin(t * Math.PI) * 40} r={4.5} fill={tok('trim')} {...thin} />; })}</g>;
}
export function Teacup(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={86} rx={40} ry={8} fill={tok('trim')} {...line} />
      <path d="M22 44 H78 Q76 84 50 84 Q24 84 22 44 Z" fill={tok('trim')} {...line} />
      <path d="M78 52 q16 0 12 14 q-4 10 -16 8" stroke={tok('ink')} strokeOpacity={0.4} strokeWidth={5} fill="none" />
      <ellipse cx={50} cy={44} rx={28} ry={6} fill={tok('rose')} opacity={0.6} />
      {[34, 50, 66].map((x) => <circle key={x} cx={x} cy={64} r={4} fill={tok('pink')} />)}
      <path className="steam" d="M42 36 q-6 -10 0 -18 M56 36 q-6 -10 0 -18" stroke={tok('inkSoft')} strokeWidth={2} fill="none" opacity={0.4} />
    </g>
  );
}
export function BookStack(_: P) {
  const cols = ['rose', 'blush', 'accent', 'pink'];
  return (
    <g>
      {cols.map((col, i) => <rect key={col} x={10 + (i % 2) * 6} y={74 - i * 18} width={78 - (i % 2) * 6} height={17} rx={2} fill={tok(col)} {...line} />)}
      {cols.map((_, i) => <path key={i} d={`M${22 + (i % 2) * 6} ${82 - i * 18} H${70}`} stroke={tok('gold')} strokeWidth={1.5} />)}
    </g>
  );
}
export function Candle(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={92} rx={26} ry={5} fill={tok('gold')} {...thin} />
      <rect x={38} y={40} width={24} height={52} rx={3} fill={tok('cream')} {...line} />
      <path d="M50 40 V32" stroke={tok('ink')} strokeWidth={1.5} />
      <path className="flame" d="M50 30 C42 22 48 12 50 6 C52 12 58 22 50 30 Z" fill={tok('window')} {...thin} />
    </g>
  );
}
export function Mirror(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={46} rx={34} ry={42} fill={tok('gold')} {...line} />
      <ellipse cx={50} cy={46} rx={27} ry={35} fill={tok('water')} opacity={0.5} />
      <path d="M36 26 q10 -8 20 -4" stroke={tok('trim')} strokeWidth={3} fill="none" opacity={0.8} />
      <Bow x={50} y={8} s={0.8} />
    </g>
  );
}
export function Letter(_: P) {
  return (
    <g>
      <rect x={8} y={26} width={84} height={56} rx={3} fill={tok('cream')} {...line} />
      <path d="M8 28 L50 60 L92 28" fill="none" {...line} />
      <circle cx={50} cy={60} r={8} fill={tok('roseDeep')} {...thin} />
      <path d="M46 60 h8 M50 56 v8" stroke={tok('pink')} strokeWidth={1.4} />
    </g>
  );
}
export function Star(_: P) {
  return <path className="twinkle" d="M50 6 L60 38 L94 40 L66 60 L76 94 L50 74 L24 94 L34 60 L6 40 L40 38 Z" fill={tok('gold')} {...line} />;
}
export function Moon(_: P) {
  return <path d="M62 8 A42 42 0 1 0 92 70 A34 34 0 1 1 62 8 Z" fill={tok('window')} {...line} />;
}
export function Cloud(_: P) {
  return <path d="M18 72 a16 16 0 0 1 4 -31 a22 22 0 0 1 40 -10 a18 18 0 0 1 26 18 a12 12 0 0 1 -4 23 Z" fill={tok('trim')} opacity={0.92} {...thin} />;
}
export function Heart(_: P) {
  return <path d="M50 86 C10 58 6 30 26 20 C38 14 48 22 50 32 C52 22 62 14 74 20 C94 30 90 58 50 86 Z" fill={tok('pink')} {...line} />;
}
export function Flowerpot(_: P) {
  return (
    <g>
      <path d="M28 60 H72 L66 94 H34 Z" fill={tok('rose')} {...line} />
      <rect x={24} y={54} width={52} height={10} rx={3} fill={tok('roseDeep')} {...thin} />
      <path d="M50 54 V24 M50 40 q-14 -6 -18 -16 M50 36 q14 -4 18 -14" stroke={tok('sageDeep')} strokeWidth={3} fill="none" />
      {[[50, 20], [32, 22], [68, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} fill={i ? tok('pink') : tok('trim')} {...thin} />)}
    </g>
  );
}
export function Armchair(_: P) {
  return (
    <g>
      <path d="M20 50 Q20 10 50 10 Q80 10 80 50 V70 H20 Z" fill={tok('pink')} {...line} />
      <rect x={10} y={52} width={80} height={26} rx={10} fill={tok('rose')} {...line} />
      <path d="M18 78 L14 96 M82 78 L86 96" stroke={tok('gold')} strokeWidth={4} strokeLinecap="round" />
      <Bow x={50} y={30} s={1} fill={tok('trim')} />
    </g>
  );
}
export function Bookshelf(_: P) {
  const spines = ['rose', 'pink', 'accent', 'gold', 'blush', 'sageDeep', 'roseDeep'];
  return (
    <g>
      <rect x={8} y={4} width={84} height={92} rx={3} fill={tok('trim')} {...line} />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x={14} y={10 + row * 29} width={72} height={25} fill={tok('cream')} />
          {spines.map((s, i) => <rect key={i} x={16 + i * 10} y={13 + row * 29 + ((i + row) % 3)} width={8} height={22 - ((i + row) % 3)} fill={tok(spines[(i + row * 2) % spines.length])} />)}
          <rect x={10} y={35 + row * 29} width={80} height={4} fill={tok('gold')} opacity={0.7} />
        </g>
      ))}
    </g>
  );
}
export function Rug(_: P) {
  return (
    <g>
      <ellipse cx={50} cy={60} rx={48} ry={22} fill={tok('blush')} {...line} />
      <ellipse cx={50} cy={60} rx={38} ry={15} fill="none" stroke={tok('rose')} strokeWidth={2} strokeDasharray="3 4" />
      <ellipse cx={50} cy={60} rx={14} ry={6} fill={tok('pink')} />
    </g>
  );
}
export function Garland(_: P) {
  return (
    <g>
      <path d="M2 20 Q50 70 98 20" stroke={tok('rose')} strokeWidth={2} fill="none" />
      {Array.from({ length: 7 }, (_, i) => { const t = (i + 0.5) / 7; const x = 2 + t * 96; const y = 20 + Math.sin(t * Math.PI) * 25; return <path key={i} d={`M${x - 6} ${y} h12 l-6 14 z`} fill={i % 2 ? tok('pink') : tok('trim')} {...thin} />; })}
    </g>
  );
}
export function Stamp(_: P) {
  return (
    <g>
      <rect x={14} y={8} width={72} height={84} fill={tok('cream')} stroke={tok('trim')} strokeWidth={6} strokeDasharray="4 3" />
      <rect x={22} y={16} width={56} height={56} fill={tok('blush')} {...thin} />
      <circle cx={50} cy={42} r={12} fill={tok('rose')} />
      <path d="M50 54 V68" stroke={tok('sageDeep')} strokeWidth={3} />
      <text x={78} y={86} textAnchor="end" fontSize={10} fill={tok('roseDeep')} fontFamily="var(--font-display)">10¢</text>
    </g>
  );
}
export function Telescope(_: P) {
  return (
    <g>
      <path d="M50 54 L28 96 M50 54 L72 96 M50 54 V96" stroke={tok('inkSoft')} strokeWidth={3} />
      <path d="M14 66 L82 22" stroke={tok('gold')} strokeWidth={12} strokeLinecap="round" />
      <path d="M14 66 L82 22" stroke={tok('ink')} strokeOpacity={0.2} strokeWidth={2} />
      <Bow x={50} y={48} s={0.7} />
    </g>
  );
}
