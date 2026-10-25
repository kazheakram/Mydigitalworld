import { tok } from '../art/palette';

// Dollhouse interiors: wallpaper and floor drawn behind a freeform room's furniture (e.g. My Bedroom).

export const WALLPAPERS = [
  { id: 'stripes', name: 'Candy stripes' }, { id: 'roses', name: 'Climbing roses' }, { id: 'gingham', name: 'Gingham' },
  { id: 'dots', name: 'Pearl dots' }, { id: 'stars', name: 'Starry night' }, { id: 'plain', name: 'Plain plaster' },
];
export const FLOORS = [{ id: 'planks', name: 'Honey planks' }, { id: 'checker', name: 'Checkered tiles' }, { id: 'carpet', name: 'Rose carpet' }];
export interface Interior { wallpaper: string; floor: string; wallColor?: string }
export const DEFAULT_INTERIOR: Interior = { wallpaper: 'stripes', floor: 'planks' };

/** Wallpaper above, floor below; drawn behind a room's objects. */
export function InteriorBackground({ interior, width = 1200, height = 750 }: { interior?: Interior; width?: number; height?: number }) {
  const it = interior ?? DEFAULT_INTERIOR;
  const floorY = height * 0.62;
  const wall = it.wallColor || (it.wallpaper === 'stars' ? tok('skyTop') : tok('blush'));
  return (
    <g className="interior-bg" aria-hidden>
      <defs>
        <pattern id="wp-stripes" width={48} height={48} patternUnits="userSpaceOnUse"><rect width={24} height={48} fill={tok('cream')} opacity={0.75} /><path d="M36 0 V48" stroke={tok('pink')} strokeWidth={1.5} strokeDasharray="3 5" /></pattern>
        <pattern id="wp-roses" width={90} height={90} patternUnits="userSpaceOnUse">
          <path d="M10 90 C30 60 0 40 20 10 M55 90 C75 60 45 40 65 10" stroke={tok('sageDeep')} strokeWidth={2} fill="none" opacity={0.5} />
          {[[20, 20], [65, 55], [14, 66]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={7} fill={tok('rose')} opacity={0.7} /><circle cx={x} cy={y} r={3} fill={tok('roseDeep')} opacity={0.6} /></g>)}
        </pattern>
        <pattern id="wp-gingham" width={40} height={40} patternUnits="userSpaceOnUse"><rect width={20} height={40} fill={tok('pink')} opacity={0.3} /><rect width={40} height={20} fill={tok('pink')} opacity={0.3} /></pattern>
        <pattern id="wp-dots" width={36} height={36} patternUnits="userSpaceOnUse"><circle cx={9} cy={9} r={3} fill={tok('trim')} /><circle cx={27} cy={27} r={3} fill={tok('trim')} /></pattern>
        <pattern id="wp-stars" width={80} height={80} patternUnits="userSpaceOnUse"><text x={12} y={24} fontSize={14} fill={tok('window')}>✦</text><text x={52} y={64} fontSize={10} fill={tok('window')} opacity={0.7}>✧</text><circle cx={60} cy={20} r={1.4} fill={tok('window')} /></pattern>
        <pattern id="fl-planks" width={160} height={40} patternUnits="userSpaceOnUse"><rect width={160} height={40} fill={tok('gold')} opacity={0.55} /><path d="M0 39 H160 M80 0 V40" stroke={tok('ink')} strokeOpacity={0.18} strokeWidth={2} /></pattern>
        <pattern id="fl-checker" width={60} height={60} patternUnits="userSpaceOnUse"><rect width={60} height={60} fill={tok('cream')} /><rect width={30} height={30} fill={tok('pink')} opacity={0.6} /><rect x={30} y={30} width={30} height={30} fill={tok('pink')} opacity={0.6} /></pattern>
        <pattern id="fl-carpet" width={40} height={40} patternUnits="userSpaceOnUse"><rect width={40} height={40} fill={tok('rose')} opacity={0.55} /><circle cx={20} cy={20} r={2} fill={tok('trim')} opacity={0.6} /></pattern>
      </defs>
      <rect width={width} height={floorY} fill={wall} />
      {it.wallpaper !== 'plain' && <rect width={width} height={floorY} fill={`url(#wp-${it.wallpaper})`} />}
      <rect y={floorY - 34} width={width} height={34} fill={tok('trim')} opacity={0.85} />
      <path d={`M0 ${floorY - 34} H${width}`} stroke={tok('gold')} strokeWidth={3} />
      <rect y={floorY} width={width} height={height - floorY} fill={`url(#fl-${it.floor})`} />
      <rect y={floorY} width={width} height={14} fill={tok('ink')} opacity={0.08} />
    </g>
  );
}

