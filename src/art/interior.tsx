import { line, thin, tok, pick, type ArtColors } from './palette';
import { Bow } from './buildings';

// Bedroom & dollhouse furniture, in the same 100×100 storybook style as the village decor.
type P = { c?: ArtColors };
const wood = (c?: ArtColors) => pick(c, 'wood', 'trim');
const cloth = (c?: ArtColors) => pick(c, 'fabric', 'pink');

export function CanopyBed({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={46} ry={3} fill="var(--c-ink)" opacity={0.12} />
      <path d="M10 8 H90" stroke={tok('gold')} strokeWidth={3} />
      <path d="M12 8 Q20 40 16 70 M88 8 Q80 40 84 70" stroke={tok('blush')} strokeWidth={8} fill="none" opacity={0.9} />
      <path d="M12 8 Q50 22 88 8" fill={tok('blush')} {...thin} />
      <Bow x={50} y={12} s={0.8} />
      <rect x={14} y={44} width={72} height={20} rx={8} fill={wood(c)} {...line} />
      <rect x={12} y={60} width={76} height={24} rx={6} fill={cloth(c)} {...line} />
      <path d="M12 72 H88" stroke={tok('trim')} strokeWidth={2} strokeDasharray="2 4" />
      <ellipse cx={34} cy={58} rx={12} ry={6} fill={tok('trim')} {...thin} />
      <ellipse cx={64} cy={58} rx={12} ry={6} fill={tok('trim')} {...thin} />
      <path d="M16 84 V95 M84 84 V95" stroke={tok('gold')} strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}
export function Wardrobe({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={36} ry={3} fill="var(--c-ink)" opacity={0.12} />
      <path d="M18 12 Q50 0 82 12 V90 H18 Z" fill={wood(c)} {...line} />
      <path d="M50 14 V88" {...thin} />
      <rect x={24} y={20} width={22} height={58} rx={4} fill="none" stroke={tok('gold')} strokeWidth={1.4} />
      <rect x={54} y={20} width={22} height={58} rx={4} fill="none" stroke={tok('gold')} strokeWidth={1.4} />
      <ellipse cx={35} cy={44} rx={6} ry={9} fill={tok('water')} opacity={0.4} />
      <circle cx={46} cy={52} r={1.8} fill={tok('gold')} /><circle cx={54} cy={52} r={1.8} fill={tok('gold')} />
      <path d="M22 90 v5 M78 90 v5" stroke={tok('gold')} strokeWidth={3} strokeLinecap="round" />
      <Bow x={50} y={8} s={0.6} />
    </g>
  );
}
export function Vanity({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={40} ry={3} fill="var(--c-ink)" opacity={0.12} />
      <ellipse cx={50} cy={28} rx={20} ry={24} fill={tok('gold')} {...line} />
      <ellipse cx={50} cy={28} rx={15} ry={19} fill={tok('water')} opacity={0.45} />
      <Bow x={50} y={4} s={0.6} />
      <rect x={12} y={52} width={76} height={10} rx={3} fill={wood(c)} {...line} />
      <path d="M14 62 Q50 78 86 62 V66 Q50 82 14 66 Z" fill={cloth(c)} {...thin} />
      <path d="M18 66 V95 M82 66 V95" stroke={tok('gold')} strokeWidth={3} strokeLinecap="round" />
      <rect x={22} y={44} width={6} height={8} rx={2} fill={tok('rose')} {...thin} />
      <circle cx={74} cy={48} r={4} fill={tok('pink')} {...thin} />
    </g>
  );
}
export function Nightstand({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={28} ry={3} fill="var(--c-ink)" opacity={0.12} />
      <rect x={24} y={46} width={52} height={40} rx={4} fill={wood(c)} {...line} />
      <path d="M24 64 H76" {...thin} />
      <circle cx={50} cy={56} r={2} fill={tok('gold')} /><circle cx={50} cy={74} r={2} fill={tok('gold')} />
      <path d="M28 86 v9 M72 86 v9" stroke={tok('gold')} strokeWidth={3} strokeLinecap="round" />
      <path d="M40 46 V34 h20 V46" fill={tok('cream')} {...thin} />
      <path className="flame" d="M50 32 C46 28 49 22 50 20 C51 22 54 28 50 32 Z" fill={tok('window')} />
    </g>
  );
}
export function FloorLamp({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={20} ry={3} fill="var(--c-ink)" opacity={0.14} />
      <path d="M50 30 V94 M38 94 H62" stroke={tok('gold')} strokeWidth={3} strokeLinecap="round" />
      <path d="M30 30 L38 6 H62 L70 30 Z" fill={pick(c, 'shade', 'pink')} {...line} className="glow-window" />
      <path d="M30 30 Q50 38 70 30" stroke={tok('trim')} strokeWidth={2} strokeDasharray="2 3" fill="none" />
      <Bow x={50} y={32} s={0.5} />
    </g>
  );
}
export function BedroomWindow(_: P) {
  return (
    <g>
      <path d="M18 92 V30 Q50 0 82 30 V92 Z" fill={tok('skyTop')} {...line} />
      <path d="M22 90 V32 Q50 6 78 32 V90" fill={tok('sky')} />
      <circle cx={64} cy={34} r={7} fill={tok('window')} opacity={0.8} />
      <path d="M22 76 Q40 64 56 72 Q68 64 78 70 V90 H22 Z" fill={tok('sageDeep')} opacity={0.6} />
      <path d="M50 8 V92 M18 56 H82" stroke={tok('trim')} strokeWidth={3} />
      <path d="M10 10 Q24 50 14 94 L22 94 Q30 50 22 10 Z" fill={tok('blush')} {...thin} />
      <path d="M90 10 Q76 50 86 94 L78 94 Q70 50 78 10 Z" fill={tok('blush')} {...thin} />
      <path d="M10 8 H90" stroke={tok('gold')} strokeWidth={3} />
      <Bow x={16} y={50} s={0.55} /><Bow x={84} y={50} s={0.55} />
    </g>
  );
}
export function WallShelf({ c }: P) {
  return (
    <g>
      <rect x={6} y={54} width={88} height={6} rx={2} fill={wood(c)} {...line} />
      <path d="M16 60 l6 12 M84 60 l-6 12" stroke={tok('gold')} strokeWidth={2.5} />
      {[['rose', 20, 26], ['accent', 27, 30], ['gold', 34, 24]].map(([col, x, h]) => <rect key={String(x)} x={Number(x)} y={54 - Number(h)} width={6} height={Number(h)} fill={tok(String(col))} {...thin} />)}
      <path d="M56 54 q-2 -16 8 -20 q10 4 8 20 z" fill={tok('cream')} {...thin} />
      <circle cx={64} cy={30} r={5} fill={tok('pink')} {...thin} />
      <rect x={78} y={40} width={10} height={14} rx={2} fill={tok('trim')} {...thin} />
    </g>
  );
}
export function Dresser({ c }: P) {
  return (
    <g>
      <ellipse cx={50} cy={96} rx={42} ry={3} fill="var(--c-ink)" opacity={0.12} />
      <path d="M10 40 Q50 30 90 40 V88 H10 Z" fill={wood(c)} {...line} />
      {[52, 70].map((y) => <g key={y}><path d={`M14 ${y} H86`} {...thin} /><circle cx={34} cy={y + 8} r={2} fill={tok('gold')} /><circle cx={66} cy={y + 8} r={2} fill={tok('gold')} /></g>)}
      <path d="M16 88 v7 M84 88 v7" stroke={tok('gold')} strokeWidth={3} strokeLinecap="round" />
      <path d="M30 40 V26 h12 v14" fill={tok('water')} opacity={0.5} {...thin} />
      <path d="M36 26 q-8 -10 0 -16 q8 6 0 16" fill={tok('pink')} {...thin} />
    </g>
  );
}
export function Cushion({ c }: P) {
  return (
    <g>
      <path d="M12 60 Q10 36 30 34 Q50 30 70 34 Q90 36 88 60 Q90 84 70 86 Q50 90 30 86 Q10 84 12 60 Z" fill={cloth(c)} {...line} />
      <path d="M30 40 Q50 60 70 40 M30 80 Q50 60 70 80" stroke={tok('trim')} strokeWidth={1.4} fill="none" />
      <circle cx={50} cy={60} r={4} fill={tok('roseDeep')} {...thin} />
    </g>
  );
}
export function SwanLamp(_: P) {
  return (
    <g>
      <path d="M30 24 L36 6 H64 L70 24 Z" fill={tok('window')} {...line} className="glow-window" />
      <path d="M50 24 V40" stroke={tok('gold')} strokeWidth={2} />
      <path d="M26 92 Q30 62 62 66 Q80 70 76 92 Z" fill={tok('trim')} {...line} />
      <path d="M36 80 Q24 56 36 44 Q44 38 48 46 Q40 50 40 62 Q40 72 46 78" fill="none" stroke={tok('trim')} strokeWidth={6} strokeLinecap="round" />
      <path d="M48 46 l7 2 l-7 2 z" fill={tok('gold')} />
      <ellipse cx={50} cy={94} rx={30} ry={4} fill={tok('gold')} {...thin} />
    </g>
  );
}
export function MusicBox(_: P) {
  return (
    <g>
      <rect x={18} y={60} width={64} height={32} rx={4} fill={tok('rose')} {...line} />
      <path d="M18 60 L26 48 H74 L82 60 Z" fill={tok('pink')} {...line} />
      <path d="M50 48 V30" stroke={tok('gold')} strokeWidth={2} />
      <circle cx={50} cy={22} r={5} fill={tok('cream')} {...thin} />
      <path d="M38 34 Q50 26 62 34 Q50 40 38 34 Z" fill={tok('trim')} {...thin} />
      <path d="M50 28 l-6 8 M50 28 l6 8" stroke={tok('cream')} strokeWidth={2} />
      {[30, 50, 70].map((x) => <circle key={x} cx={x} cy={76} r={3} fill={tok('gold')} />)}
    </g>
  );
}
export function PictureFrame(_: P) {
  return (
    <g>
      <rect x={14} y={10} width={72} height={80} rx={4} fill={tok('gold')} {...line} />
      <rect x={22} y={18} width={56} height={64} fill={tok('blush')} {...thin} />
      <circle cx={50} cy={42} r={10} fill={tok('rose')} opacity={0.7} />
      <path d="M22 82 L40 62 L52 72 L64 58 L78 74 V82 Z" fill={tok('sageDeep')} opacity={0.6} />
      <Bow x={50} y={10} s={0.6} />
    </g>
  );
}
