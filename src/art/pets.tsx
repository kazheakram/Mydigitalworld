import { line, thin, tok, type ArtColors } from './palette';
import { Bow } from './buildings';

// Companion animals, drawn in a 100×100 box (ground at y≈94) in the village's storybook style.
// Accessories are read from the colour map so they travel with the artwork everywhere:
//   colors.fur, colors.bow, colors.collar, colors.pearls ('1'), colors.crown ('1'), colors.bonnet ('1')

export type PetSpecies = 'bunny' | 'fawn' | 'kitten' | 'swan';
export const PET_SPECIES: { id: PetSpecies; name: string; about: string; defaultFur: string }[] = [
  { id: 'bunny', name: 'White bunny', about: 'Soft, curious, fond of clover.', defaultFur: '#ffffff' },
  { id: 'fawn', name: 'Baby fawn', about: 'Shy and gentle, with dappled spots.', defaultFur: '#d9a86c' },
  { id: 'kitten', name: 'Kitten', about: 'Sleepy, sunny-windowsill sort of creature.', defaultFur: '#f3e1d2' },
  { id: 'swan', name: 'Little swan', about: 'Graceful and a little bit proud.', defaultFur: '#ffffff' },
];

const on = (c: ArtColors | undefined, k: string) => !!c?.[k] && c[k] !== '0';

function Accessories({ c, head, neck, s = 1 }: { c?: ArtColors; head: [number, number]; neck: [number, number]; s?: number }) {
  return (
    <g className="pet-accessories">
      {c?.collar && <path d={`M${neck[0] - 9 * s} ${neck[1]} q${9 * s} ${6 * s} ${18 * s} 0`} stroke={c.collar} strokeWidth={3.2 * s} fill="none" strokeLinecap="round" />}
      {on(c, 'pearls') && Array.from({ length: 5 }, (_, i) => <circle key={i} cx={neck[0] - 8 * s + i * 4 * s} cy={neck[1] + 2 * s + Math.sin((i / 4) * Math.PI) * 3 * s} r={1.8 * s} fill={tok('trim')} {...thin} />)}
      {on(c, 'crown') && (
        <g>
          <path d={`M${head[0] - 11 * s} ${head[1] + 1} q${11 * s} ${-6 * s} ${22 * s} 0`} stroke={tok('sageDeep')} strokeWidth={2} fill="none" />
          {[-9, -4, 1, 6, 10].map((dx, i) => <circle key={i} cx={head[0] + dx * s} cy={head[1] - 1.5 * s + (Math.abs(dx) > 7 ? 1.5 : 0)} r={2.6 * s} fill={i % 2 ? tok('trim') : tok('pink')} {...thin} />)}
          {[-6, 3].map((dx) => <circle key={dx} cx={head[0] + dx * s} cy={head[1] - 2 * s} r={1} fill={tok('gold')} />)}
        </g>
      )}
      {on(c, 'bonnet') && (
        <g>
          <path d={`M${head[0] - 12 * s} ${head[1] + 6 * s} q${12 * s} ${-20 * s} ${24 * s} 0 z`} fill={tok('trim')} {...thin} />
          <path d={`M${head[0] - 12 * s} ${head[1] + 6 * s} q${12 * s} ${-20 * s} ${24 * s} 0`} fill="none" stroke={tok('pink')} strokeWidth={1.4} strokeDasharray="1.5 2" />
          <path d={`M${head[0] - 11 * s} ${head[1] + 6 * s} l-3 7 M${head[0] + 11 * s} ${head[1] + 6 * s} l3 7`} stroke={tok('rose')} strokeWidth={1.5} />
        </g>
      )}
      {c?.bow && <Bow x={head[0] + 7 * s} y={head[1] + 1 * s} s={0.55 * s} fill={c.bow} />}
    </g>
  );
}

export function PetBunny({ c }: { c?: ArtColors }) {
  const fur = c?.fur ?? tok('trim');
  return (
    <g className="pet pet-bunny">
      <ellipse cx={50} cy={94} rx={28} ry={4} fill="var(--c-ink)" opacity={0.14} />
      <ellipse cx={54} cy={74} rx={26} ry={20} fill={fur} {...line} />
      <circle cx={78} cy={76} r={7} fill={fur} {...thin} />
      <ellipse cx={40} cy={88} rx={10} ry={5} fill={fur} {...thin} />
      <g className="pet-ear">
        <path d="M30 40 C20 12 28 2 34 6 C40 10 38 28 37 40" fill={fur} {...line} />
        <path d="M31 36 C25 18 29 10 32 12" stroke={tok('pink')} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
      <g className="pet-ear pet-ear-2">
        <path d="M40 40 C42 14 52 6 56 12 C60 18 50 32 46 42" fill={fur} {...line} />
      </g>
      <circle cx={38} cy={54} r={16} fill={fur} {...line} />
      <g className="pet-blink"><circle cx={32} cy={52} r={2.4} fill={tok('ink')} opacity={0.85} /><circle cx={44} cy={52} r={2.4} fill={tok('ink')} opacity={0.85} /></g>
      <path d="M36 58 l2 2 l2 -2" stroke={tok('roseDeep')} strokeWidth={1.4} fill="none" />
      <circle cx={28} cy={58} r={2.4} fill={tok('pink')} opacity={0.8} /><circle cx={48} cy={58} r={2.4} fill={tok('pink')} opacity={0.8} />
      <Accessories c={c} head={[38, 40]} neck={[38, 68]} />
    </g>
  );
}

export function PetFawn({ c }: { c?: ArtColors }) {
  const fur = c?.fur ?? '#d9a86c';
  return (
    <g className="pet pet-fawn">
      <ellipse cx={52} cy={94} rx={34} ry={4} fill="var(--c-ink)" opacity={0.14} />
      <path d="M28 72 Q52 56 78 66 Q90 72 84 82 Q62 90 32 84 Z" fill={fur} {...line} />
      {[[36, 92], [46, 92], [70, 92], [80, 90]].map(([x, y], i) => <path key={i} d={`M${x} 82 V${y}`} stroke={fur} strokeWidth={5} strokeLinecap="round" />)}
      {[[50, 68], [60, 66], [68, 71], [56, 74], [44, 74]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill={tok('trim')} />)}
      <path d="M84 70 q8 -6 6 4" stroke={fur} strokeWidth={4} fill="none" strokeLinecap="round" className="pet-tail" />
      <path d="M30 72 Q24 54 26 40 L38 42 Q40 56 42 68 Z" fill={fur} {...line} />
      <ellipse cx={28} cy={36} rx={12} ry={10} fill={fur} {...line} />
      <g className="pet-ear"><path d="M18 28 q-10 -8 -12 -2 q4 7 12 7" fill={fur} {...thin} /></g>
      <g className="pet-ear pet-ear-2"><path d="M34 26 q9 -9 12 -3 q-4 7 -12 8" fill={fur} {...thin} /></g>
      <g className="pet-blink"><circle cx={24} cy={35} r={2.2} fill={tok('ink')} /><circle cx={33} cy={35} r={2.2} fill={tok('ink')} /></g>
      <ellipse cx={20} cy={41} rx={3} ry={2.2} fill={tok('ink')} opacity={0.65} />
      <circle cx={34} cy={41} r={2} fill={tok('pink')} opacity={0.7} />
      <Accessories c={c} head={[28, 26]} neck={[32, 56]} s={0.9} />
    </g>
  );
}

export function PetKitten({ c }: { c?: ArtColors }) {
  const fur = c?.fur ?? '#f3e1d2';
  return (
    <g className="pet pet-kitten">
      <ellipse cx={50} cy={94} rx={26} ry={4} fill="var(--c-ink)" opacity={0.14} />
      <path className="pet-tail" d="M70 88 q22 -4 18 -26 q-2 -8 -8 -6" stroke={fur} strokeWidth={7} fill="none" strokeLinecap="round" />
      <path className="pet-tail" d="M70 88 q22 -4 18 -26 q-2 -8 -8 -6" stroke={tok('ink')} strokeOpacity={0.25} strokeWidth={1.5} fill="none" />
      <path d="M30 92 Q26 62 50 58 Q74 62 70 92 Z" fill={fur} {...line} />
      <path d="M38 92 v-8 M62 92 v-8" stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={1.4} />
      <g className="pet-ear"><path d="M32 30 L30 12 L44 22 Z" fill={fur} {...line} /><path d="M33 26 L32 17 L39 22 Z" fill={tok('pink')} /></g>
      <g className="pet-ear pet-ear-2"><path d="M68 30 L70 12 L56 22 Z" fill={fur} {...line} /><path d="M67 26 L68 17 L61 22 Z" fill={tok('pink')} /></g>
      <ellipse cx={50} cy={38} rx={22} ry={18} fill={fur} {...line} />
      <g className="pet-blink"><path d="M40 38 q3 3 6 0" stroke={tok('ink')} strokeWidth={2} fill="none" strokeLinecap="round" /><path d="M54 38 q3 3 6 0" stroke={tok('ink')} strokeWidth={2} fill="none" strokeLinecap="round" /></g>
      <path d="M48 44 l2 2 l2 -2" fill={tok('pink')} stroke={tok('roseDeep')} strokeWidth={1} />
      <path d="M30 44 h-10 M30 47 l-9 3 M70 44 h10 M70 47 l9 3" stroke={tok('ink')} strokeOpacity={0.35} strokeWidth={1} />
      <circle cx={38} cy={46} r={2.6} fill={tok('pink')} opacity={0.7} /><circle cx={62} cy={46} r={2.6} fill={tok('pink')} opacity={0.7} />
      <Accessories c={c} head={[50, 22]} neck={[50, 58]} />
    </g>
  );
}

export function PetSwan({ c }: { c?: ArtColors }) {
  const fur = c?.fur ?? tok('trim');
  return (
    <g className="pet pet-swan">
      <ellipse cx={50} cy={90} rx={42} ry={6} fill={tok('water')} opacity={0.75} />
      <path d="M18 82 Q26 56 66 62 Q90 66 86 82 Z" fill={fur} {...line} />
      <path d="M50 68 q14 -10 30 2" stroke={tok('ink')} strokeOpacity={0.2} strokeWidth={1.5} fill="none" />
      <path d="M28 74 Q12 42 28 22 Q38 12 44 22 Q34 28 34 44 Q34 60 40 70" fill="none" stroke={fur} strokeWidth={8} strokeLinecap="round" />
      <path d="M28 74 Q12 42 28 22 Q38 12 44 22" fill="none" stroke={tok('ink')} strokeOpacity={0.3} strokeWidth={1.5} />
      <path d="M44 22 l9 3 l-9 3 z" fill={tok('gold')} />
      <g className="pet-blink"><circle cx={37} cy={21} r={1.7} fill={tok('ink')} /></g>
      <Accessories c={c} head={[36, 13]} neck={[30, 40]} s={0.8} />
    </g>
  );
}

export const PET_ART: Record<PetSpecies, (p: { c?: ArtColors }) => JSX.Element> = { bunny: PetBunny, fawn: PetFawn, kitten: PetKitten, swan: PetSwan };

export function PetSvg({ species, colors, className, title }: { species: PetSpecies; colors?: ArtColors; className?: string; title?: string }) {
  const C = PET_ART[species] ?? PetBunny;
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} overflow="visible">
      <C c={colors} />
    </svg>
  );
}

// ── Pet homes ──
export function PetHome({ kind }: { kind: string }) {
  switch (kind) {
    case 'hutch': return (
      <g>
        <ellipse cx={50} cy={95} rx={44} ry={4} fill="var(--c-ink)" opacity={0.12} />
        <path d="M10 44 L50 12 L90 44 Z" fill={tok('roof')} {...line} />
        <rect x={16} y={44} width={68} height={46} fill={tok('wall')} {...line} />
        <path d="M40 90 V64 a10 10 0 0 1 20 0 V90 Z" fill={tok('ink')} opacity={0.55} />
        <path d="M20 58 h12 v12 h-12 z" fill={tok('window')} {...thin} />
        <Bow x={50} y={40} s={0.8} />
        {[22, 34, 66, 78].map((x) => <circle key={x} cx={x} cy={92} r={3} fill={tok('pink')} />)}
      </g>
    );
    case 'basket': return (
      <g>
        <ellipse cx={50} cy={92} rx={44} ry={5} fill="var(--c-ink)" opacity={0.12} />
        <path d="M8 60 Q50 100 92 60 Z" fill={tok('gold')} {...line} />
        {[20, 32, 44, 56, 68, 80].map((x) => <path key={x} d={`M${x} 64 q2 12 0 20`} stroke={tok('ink')} strokeOpacity={0.25} />)}
        <ellipse cx={50} cy={60} rx={42} ry={10} fill={tok('pink')} {...line} />
        <path d="M14 58 Q50 20 86 58" stroke={tok('gold')} strokeWidth={4} fill="none" />
        <Bow x={50} y={40} s={0.7} />
      </g>
    );
    case 'pond': return (
      <g>
        <ellipse cx={50} cy={70} rx={46} ry={20} fill={tok('water')} {...line} />
        <ellipse cx={50} cy={70} rx={34} ry={12} fill="none" stroke={tok('trim')} strokeOpacity={0.6} strokeWidth={2} />
        {[[24, 64], [72, 74]].map(([x, y], i) => <g key={i}><ellipse cx={x} cy={y} rx={9} ry={4} fill={tok('sageDeep')} /><circle cx={x + 2} cy={y - 2} r={3} fill={tok('pink')} /></g>)}
        {[8, 90].map((x) => <path key={x} d={`M${x} 70 q-2 -20 4 -34`} stroke={tok('sageDeep')} strokeWidth={3} fill="none" />)}
      </g>
    );
    default: return (
      <g>
        <ellipse cx={50} cy={92} rx={44} ry={5} fill="var(--c-ink)" opacity={0.12} />
        <ellipse cx={50} cy={76} rx={44} ry={16} fill={tok('rose')} {...line} />
        <ellipse cx={50} cy={72} rx={34} ry={10} fill={tok('pink')} {...thin} />
        {[[14, 74], [86, 74], [50, 90]].map(([x, y], i) => <path key={i} d={`M${x - 3} ${y} l3 -3 l3 3 l-3 3 z`} fill={tok('gold')} />)}
      </g>
    );
  }
}
export const PET_HOMES = [{ id: 'cushion', name: 'Velvet cushion' }, { id: 'hutch', name: 'Little hutch' }, { id: 'basket', name: 'Wicker basket' }, { id: 'pond', name: 'Lily pond' }];
