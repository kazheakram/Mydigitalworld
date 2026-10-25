import type { SceneObject } from '../../shared/types';
import { tok } from '../art/palette';

// The paths beyond the village: seven landscapes, each drawn as the background of a "region" room
// (1200×750) with a starting arrangement of artwork on top that you can rearrange in the Atelier.

export const LW = 1200; export const LH = 750;
export interface LandscapeDef { id: string; name: string; subtitle: string; mystery: string; scene: () => SceneObject[] }

let n = 0;
const o = (art: string, x: number, y: number, w: number, h: number, z = 10, extra: Partial<SceneObject> = {}): SceneObject => ({ id: `ls-${art}-${++n}`, type: 'decor', art, x, y, w, h, z, ...extra });
const b = (art: string, x: number, y: number, s = 190, z = 10, label?: string): SceneObject => ({ id: `ls-${art}-${++n}`, type: 'building', art, x, y, w: s, h: s, z, label });

export const LANDSCAPES: LandscapeDef[] = [
  { id: 'woodland', name: 'The Whispering Wood', subtitle: 'ferns, toadstools & dappled light', mystery: 'Something rustles between the birches.',
    scene: () => [o('tree-round', 60, 250, 220, 260, 5), o('tree-cypress', 300, 200, 120, 300, 4), o('tree-round', 900, 230, 240, 280, 5), o('tree-blossom', 700, 260, 200, 240, 6), o('mushrooms', 520, 560, 90, 80, 12), o('deer', 820, 470, 150, 150, 14, { animation: 'bob' }), o('bunny', 360, 590, 80, 80, 14, { animation: 'bob' }), o('butterfly', 600, 300, 50, 50, 20, { animation: 'flutter' }), o('bench', 140, 560, 140, 90, 12)] },
  { id: 'seaside', name: 'The Seaside Promenade', subtitle: 'gulls, striped huts & salt air', mystery: 'You can hear the sea from here.',
    scene: () => [o('lamppost', 220, 300, 50, 160, 12), o('lamppost', 820, 300, 50, 160, 12), o('bench', 420, 370, 150, 90, 12), o('swan', 760, 560, 110, 90, 14, { animation: 'bob' }), o('teacup', 600, 390, 60, 50, 13), o('garland', 300, 200, 600, 80, 11)] },
  { id: 'street', name: 'The Vintage Shopping Street', subtitle: 'bunting, bells & bow-fronted windows', mystery: 'A shop bell rings somewhere ahead.',
    scene: () => [b('shopfront', 40, 230, 220, 8, 'Haberdashery'), b('shopfront', 290, 230, 220, 8, 'The Teashop'), b('cafe', 540, 240, 210, 8, 'Patisserie'), b('shopfront', 790, 230, 220, 8, 'Antiques'), o('garland', 60, 170, 1080, 90, 9), o('lamppost', 1040, 400, 50, 160, 12), o('flowerpot', 260, 470, 60, 70, 12)] },
  { id: 'maze', name: 'The Rose Maze', subtitle: 'clipped hedges & hidden benches', mystery: 'Roses as far as you can see.',
    scene: () => [o('hedge-arch', 520, 230, 160, 170, 8), o('rosebush', 160, 520, 120, 90, 12), o('rosebush', 900, 520, 120, 90, 12), o('bench', 520, 560, 150, 90, 12), o('fountain', 980, 250, 150, 130, 9), o('butterfly', 300, 260, 50, 50, 20, { animation: 'flutter' })] },
  { id: 'winter', name: 'The Winter Village', subtitle: 'snowy roofs & sugarplum windows', mystery: 'A cold, sweet wind. Is that snow?',
    scene: () => [b('cottage', 120, 230, 200, 8), b('townhouse', 380, 200, 200, 8), b('cottage', 820, 240, 200, 8), o('tree-cypress', 650, 260, 100, 230, 9), o('lamppost', 640, 440, 50, 160, 12), o('bunny', 520, 600, 80, 80, 14)] },
  { id: 'meadow', name: 'The Wildflower Meadow', subtitle: 'clover, kites & long grass', mystery: 'Bees, and the smell of warm grass.',
    scene: () => [o('tree-blossom', 900, 240, 220, 250, 6), o('bunny', 300, 560, 90, 90, 14, { animation: 'bob' }), o('butterfly', 500, 330, 50, 50, 20, { animation: 'flutter' }), o('butterfly', 700, 380, 40, 40, 20, { animation: 'flutter' }), o('chest', 140, 540, 120, 100, 12), o('heart', 620, 520, 50, 50, 13)] },
  { id: 'lakeside', name: 'The Swan Lake', subtitle: 'reeds, a little jetty & swans', mystery: 'Water lapping at a wooden jetty.',
    scene: () => [o('swan', 420, 520, 140, 110, 14, { animation: 'bob' }), o('swan', 620, 560, 110, 90, 14, { animation: 'bob' }), o('tree-round', 960, 220, 220, 260, 6), o('bench', 120, 400, 150, 90, 12), o('home-pond', 820, 600, 150, 90, 12)] },
];
export const LANDSCAPE_BY_ID = new Map(LANDSCAPES.map((l) => [l.id, l]));
export const landscapeScene = (id: string) => { n = 0; return LANDSCAPE_BY_ID.get(id)?.scene() ?? []; };

function Sky({ top = 'skyTop', bottom = 'sky' }: { top?: string; bottom?: string }) {
  return (
    <>
      <defs><linearGradient id={`ls-sky-${top}-${bottom}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tok(top)} /><stop offset="1" stopColor={tok(bottom)} /></linearGradient></defs>
      <rect width={LW} height={LH} fill={`url(#ls-sky-${top}-${bottom})`} />
      {[[140, 90, 1], [520, 60, 0.8], [960, 110, 1.1]].map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity={0.85}><ellipse cx={0} cy={0} rx={70} ry={24} fill="#fffaf6" /><ellipse cx={-30} cy={-12} rx={34} ry={22} fill="#fffaf6" /><ellipse cx={26} cy={-16} rx={40} ry={26} fill="#fffaf6" /></g>)}
    </>
  );
}

export function LandscapeBackground({ kind }: { kind: string }) {
  switch (kind) {
    case 'woodland': return (
      <g aria-hidden>
        <Sky top="sageDeep" bottom="sky" />
        {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${i * 90 - 20} 520 q30 -260 60 -380 q30 120 60 380 z`} fill={tok('sageDeep')} opacity={0.35 + (i % 3) * 0.1} />)}
        <path d={`M0 470 Q300 430 600 470 T1200 460 V${LH} H0 Z`} fill={tok('sage')} />
        <path d={`M520 ${LH} Q560 600 600 470 Q640 600 700 ${LH} Z`} fill={tok('cream')} opacity={0.8} />
        {Array.from({ length: 22 }, (_, i) => <path key={i} d={`M${(i * 61) % LW} ${520 + (i * 37) % 200} q-10 -24 0 -34 q10 10 0 34`} fill={tok('sageDeep')} opacity={0.7} />)}
        {Array.from({ length: 9 }, (_, i) => <ellipse key={i} cx={(i * 157) % LW} cy={200 + (i * 53) % 220} rx={60} ry={14} fill="#fff6d8" opacity={0.18} />)}
      </g>
    );
    case 'seaside': return (
      <g aria-hidden>
        <Sky />
        <rect y={250} width={LW} height={200} fill={tok('water')} />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 110} ${290 + (i % 3) * 40} q20 -10 40 0 q20 10 40 0`} stroke="#fffaf6" strokeWidth={3} fill="none" opacity={0.7} />)}
        <path d="M0 440 Q600 410 1200 440 V520 H0 Z" fill="#f3e2c4" />
        {[60, 980].map((x, i) => <g key={x}>{Array.from({ length: 3 }, (_, j) => <g key={j} transform={`translate(${x + j * 60} 360)`}><rect width={46} height={70} fill={j % 2 ? tok('pink') : '#fffaf6'} /><path d="M-4 0 L23 -26 L50 0 Z" fill={i % 2 ? tok('roseDeep') : tok('rose')} />{[8, 22, 36].map((sx) => <rect key={sx} x={sx} y={0} width={6} height={70} fill={j % 2 ? '#fffaf6' : tok('pink')} opacity={0.6} />)}</g>)}</g>)}
        <rect y={500} width={LW} height={LH - 500} fill={tok('cream')} />
        {Array.from({ length: 30 }, (_, i) => <rect key={i} x={i * 40} y={500} width={6} height={60} fill={tok('trim')} />)}
        <path d="M0 500 H1200" stroke={tok('trim')} strokeWidth={8} /><path d="M0 530 H1200" stroke={tok('trim')} strokeWidth={4} />
        <path d={`M0 600 H${LW}`} stroke={tok('gold')} strokeOpacity={0.3} strokeDasharray="20 14" strokeWidth={2} />
        {[[300, 140], [700, 180]].map(([x, y]) => <path key={x} d={`M${x} ${y} q12 -10 24 0 q12 -10 24 0`} stroke={tok('ink')} strokeOpacity={0.5} strokeWidth={2.4} fill="none" />)}
      </g>
    );
    case 'street': return (
      <g aria-hidden>
        <Sky />
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={i * 160 - 20} y={120 + (i % 3) * 20} width={150} height={340} fill={[tok('blush'), tok('cream'), tok('pink')][i % 3]} opacity={0.55} />)}
        <rect y={440} width={LW} height={LH - 440} fill="#e7d6c6" />
        {Array.from({ length: 60 }, (_, i) => <ellipse key={i} cx={(i * 47) % LW + 20} cy={470 + Math.floor(i / 25) * 90 + (i % 2) * 40} rx={22} ry={10} fill="#d6c0aa" stroke="rgba(74,46,53,.15)" />)}
        <path d={`M0 470 H${LW}`} stroke={tok('trim')} strokeWidth={10} />
      </g>
    );
    case 'maze': return (
      <g aria-hidden>
        <Sky />
        <rect y={300} width={LW} height={LH - 300} fill={tok('sage')} />
        {[[0, 330, 1200, 40], [60, 420, 400, 36], [700, 420, 440, 36], [60, 420, 36, 260], [1104, 420, 36, 260], [200, 520, 300, 34], [700, 520, 300, 34], [60, 650, 1080, 36], [460, 330, 36, 120], [704, 330, 36, 120]].map(([x, y, w, h], i) => (
          <g key={i}><rect x={x} y={y} width={w} height={h} rx={12} fill={tok('sageDeep')} />{Array.from({ length: Math.max(1, Math.floor((w + h) / 70)) }, (_, k) => <circle key={k} cx={x + (w > h ? 20 + k * 70 : h > w ? w / 2 : 0)} cy={y + (h > w ? 20 + k * 70 : 6)} r={6} fill={k % 2 ? tok('rose') : tok('pink')} />)}</g>
        ))}
        <path d="M600 750 V380" stroke={tok('cream')} strokeWidth={60} opacity={0.6} />
      </g>
    );
    case 'winter': return (
      <g aria-hidden>
        <Sky top="skyTop" bottom="blush" />
        <path d="M0 330 L180 180 L360 330 L520 200 L700 330 L900 160 L1200 330 V460 H0 Z" fill="#eef2f8" />
        <path d="M150 205 L180 180 L210 205 Z M490 225 L520 200 L550 225 Z M870 185 L900 160 L930 185 Z" fill="#ffffff" />
        <path d={`M0 450 Q300 420 600 450 T1200 440 V${LH} H0 Z`} fill="#fbfcff" />
        <path d={`M560 ${LH} Q590 600 600 450 Q610 600 650 ${LH} Z`} fill="#e6ebf4" />
        {Array.from({ length: 50 }, (_, i) => <circle key={i} className="snow-flake" cx={(i * 97) % LW} cy={(i * 53) % 500} r={2 + (i % 3)} fill="#ffffff" opacity={0.85} />)}
      </g>
    );
    case 'meadow': return (
      <g aria-hidden>
        <Sky />
        <path d="M0 360 Q300 280 600 340 T1200 320 V500 H0 Z" fill={tok('sage')} opacity={0.7} />
        <path d={`M0 430 Q400 360 800 420 T1200 400 V${LH} H0 Z`} fill={tok('sage')} />
        {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={(i * 83) % LW} cy={450 + (i * 41) % 290} r={3 + (i % 3)} fill={[tok('pink'), '#fffaf6', tok('gold'), tok('rose')][i % 4]} />)}
        <path d="M980 120 l40 50 l-40 50 l-40 -50 z" fill={tok('rose')} /><path d="M980 220 q-20 60 10 120 q20 40 -10 80" stroke={tok('ink')} strokeOpacity={0.4} fill="none" />
      </g>
    );
    case 'lakeside': return (
      <g aria-hidden>
        <Sky />
        <path d="M0 340 Q300 290 600 330 T1200 320 V420 H0 Z" fill={tok('sageDeep')} opacity={0.5} />
        <ellipse cx={600} cy={560} rx={620} ry={190} fill={tok('water')} />
        {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${150 + i * 95} ${480 + (i % 3) * 50} q20 -8 40 0`} stroke="#fffaf6" strokeWidth={3} fill="none" opacity={0.7} />)}
        <path d="M0 420 Q120 400 200 440 L200 750 H0 Z" fill={tok('sage')} />
        <path d="M1000 430 Q1100 410 1200 420 V750 H1000 Z" fill={tok('sage')} />
        <rect x={150} y={480} width={240} height={18} fill={tok('trim')} stroke="rgba(74,46,53,.3)" />
        {[170, 240, 310, 370].map((x) => <rect key={x} x={x} y={498} width={10} height={50} fill={tok('trim')} />)}
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${40 + i * 10} 470 q-4 -40 4 -70`} stroke={tok('sageDeep')} strokeWidth={3} fill="none" />)}
        {Array.from({ length: 16 }, (_, i) => <path key={`r${i}`} d={`M${1030 + i * 10} 470 q-4 -40 4 -70`} stroke={tok('sageDeep')} strokeWidth={3} fill="none" />)}
      </g>
    );
    default: return <rect width={LW} height={LH} fill={tok('cream')} />;
  }
}
