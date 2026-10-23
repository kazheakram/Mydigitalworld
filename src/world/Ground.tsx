import { memo } from 'react';
import { tok } from '../art/palette';

// The village ground: a golden-hour sky with distant hills, meadow, cobblestone lanes and a pond.
// It is drawn in the same 1600×1000 coordinate system as every object on the map.

function rand(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

const LANES = [
  'M800 990 C800 900 790 820 800 760 C810 690 760 560 715 520',
  'M715 520 C640 520 520 560 420 650',
  'M715 520 C820 520 980 560 1240 680',
  'M715 520 C700 460 640 400 470 420 C380 430 340 470 355 520',
  'M715 520 C780 450 900 440 1000 420 C1120 400 1220 420 1300 480',
  'M715 470 C700 400 640 380 615 370',
  'M760 470 C860 360 1000 380 1040 360',
  'M470 420 C350 330 200 300 155 270',
  'M1300 480 C1400 420 1440 330 1460 270',
  'M1240 680 C1340 700 1440 740 1495 780',
];

export const Ground = memo(function Ground({ width, height }: { width: number; height: number }) {
  const r = rand(7);
  const flowers = Array.from({ length: 170 }, () => ({ x: r() * width, y: 90 + r() * (height - 100), c: r(), s: 2 + r() * 2.5 }));
  const grass = Array.from({ length: 120 }, () => ({ x: r() * width, y: 90 + r() * (height - 100) }));
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tok('skyTop')} />
          <stop offset="1" stopColor={tok('sky')} />
        </linearGradient>
        <linearGradient id="g-meadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tok('sage')} stopOpacity={0.75} />
          <stop offset="1" stopColor={tok('sage')} />
        </linearGradient>
        <radialGradient id="g-glow" cx="0.5" cy="0.05" r="0.9">
          <stop offset="0" stopColor={tok('window')} stopOpacity={0.45} />
          <stop offset="0.6" stopColor={tok('window')} stopOpacity={0} />
        </radialGradient>
        <pattern id="p-cobble" width="22" height="16" patternUnits="userSpaceOnUse">
          <rect width="22" height="16" fill={tok('path')} />
          <path d="M1 1h9v6h-9z M12 1h9v6h-9z M6 9h10v6h-10z M-5 9h9v6h-9z M18 9h9v6h-9z" fill={tok('cream')} stroke={tok('ink')} strokeOpacity={0.12} strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#g-meadow)" />
      {/* sky band with distant hills and a far-away castle */}
      <rect width={width} height={110} fill="url(#g-sky)" />
      <circle cx={1180} cy={70} r={34} fill={tok('window')} opacity={0.7} className="sun" />
      <path d={`M0 90 C160 40 300 70 420 60 C560 46 640 90 780 74 C900 60 1000 30 1120 56 C1260 84 1400 40 ${width} 70 V120 H0 Z`} fill={tok('accent')} opacity={0.45} />
      <g opacity={0.5} fill={tok('accent')}>
        <path d="M880 66 v-26 l6 -10 l6 10 v12 h8 v-20 l7 -12 l7 12 v20 h8 v-12 l6 -10 l6 10 v26 z" />
      </g>
      <path d={`M0 104 C200 74 360 110 520 96 C700 80 860 118 1040 98 C1220 80 1380 112 ${width} 92 V140 H0 Z`} fill={tok('sageDeep')} opacity={0.45} />
      <path d={`M0 120 C240 100 420 132 640 120 C860 108 1080 140 1300 120 C1420 110 1520 124 ${width} 118 V160 H0 Z`} fill={tok('sage')} />
      {/* pond */}
      <path d="M1180 1000 C1170 920 1230 860 1330 850 C1430 840 1520 860 1600 840 V1000 Z" fill={tok('water')} />
      <path d="M1200 1000 C1196 940 1240 884 1330 872" stroke={tok('trim')} strokeOpacity={0.5} strokeWidth={3} fill="none" />
      {[[1390, 920], [1460, 960], [1520, 900]].map(([x, y], i) => (
        <g key={i}><ellipse cx={x} cy={y} rx={16} ry={7} fill={tok('sageDeep')} /><circle cx={x + 4} cy={y - 3} r={4} fill={tok('pink')} /></g>
      ))}
      {/* cobblestone lanes */}
      {LANES.map((d, i) => <path key={'e' + i} d={d} stroke={tok('ink')} strokeOpacity={0.12} strokeWidth={i === 0 ? 50 : 38} fill="none" strokeLinecap="round" />)}
      {LANES.map((d, i) => <path key={i} d={d} stroke="url(#p-cobble)" strokeWidth={i === 0 ? 44 : 32} fill="none" strokeLinecap="round" />)}
      <ellipse cx={715} cy={500} rx={150} ry={62} fill="url(#p-cobble)" stroke={tok('ink')} strokeOpacity={0.12} strokeWidth={3} />
      {grass.map((g, i) => <path key={'g' + i} d={`M${g.x} ${g.y} l-3 -8 M${g.x} ${g.y} l0 -10 M${g.x} ${g.y} l3 -8`} stroke={tok('sageDeep')} strokeWidth={1.5} opacity={0.5} />)}
      {flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.s} fill={f.c < 0.4 ? tok('pink') : f.c < 0.7 ? tok('trim') : f.c < 0.85 ? tok('rose') : tok('window')} opacity={0.85} />)}
      <rect width={width} height={height} fill="url(#g-glow)" pointerEvents="none" />
    </g>
  );
});

/** Clouds drifting across the top of the village. */
export function SkyClouds({ width }: { width: number }) {
  const clouds = [{ y: 20, s: 1, d: 0 }, { y: 54, s: 0.7, d: -30 }, { y: 30, s: 0.85, d: -60 }, { y: 70, s: 0.6, d: -90 }];
  return (
    <g aria-hidden pointerEvents="none">
      {clouds.map((c, i) => (
        <g key={i} className="drift" style={{ animationDelay: `${c.d}s`, ['--w' as any]: `${width + 300}px` }}>
          <path transform={`translate(-260 ${c.y}) scale(${c.s * 2.2})`} d="M18 52 a16 16 0 0 1 4 -31 a22 22 0 0 1 40 -10 a18 18 0 0 1 26 18 a12 12 0 0 1 -4 23 Z" fill={tok('trim')} opacity={0.85} />
        </g>
      ))}
    </g>
  );
}
