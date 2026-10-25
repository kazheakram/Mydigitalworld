import { useEffect, useState } from 'react';
import type { WorldConfig } from '../../shared/types';
import { featureState } from '../../shared/features';

// Weather and daylight over the village map. Both are optional (Feature Manager → World &
// Atmosphere), purely decorative, and drawn in the map's own coordinates so they zoom with it.

export type Weather = 'clear' | 'sunny' | 'rain' | 'snow' | 'mist' | 'petals';
export type Daypart = 'morning' | 'day' | 'golden' | 'dusk' | 'night';
export const WEATHER_CHOICES: { id: 'auto' | Weather; name: string }[] = [
  { id: 'auto', name: 'Follow the season' }, { id: 'clear', name: 'Clear' }, { id: 'sunny', name: 'Sunshine' },
  { id: 'rain', name: 'Soft rain' }, { id: 'snow', name: 'Snowfall' }, { id: 'mist', name: 'Morning mist' }, { id: 'petals', name: 'Drifting petals' },
];
export const DAYLIGHT_CHOICES: { id: 'clock' | Daypart; name: string }[] = [
  { id: 'clock', name: 'Follow my clock' }, { id: 'day', name: 'Always daytime' }, { id: 'golden', name: 'Always golden hour' }, { id: 'night', name: 'Always night' },
];

const SEASON_WEATHER: Record<string, Weather[]> = {
  winter: ['snow', 'clear', 'snow', 'mist', 'clear'],
  spring: ['petals', 'sunny', 'rain', 'clear', 'petals'],
  summer: ['sunny', 'clear', 'sunny', 'petals', 'clear'],
  autumn: ['mist', 'clear', 'rain', 'clear', 'mist'],
};
export const seasonOf = (d: Date) => ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][d.getMonth()];

/** The same weather all day (no flicker between visits), chosen from the season. */
export function resolveWeather(world: WorldConfig, d = new Date()): Weather {
  const choice = featureState(world, 'weather').settings?.choice ?? 'auto';
  if (choice !== 'auto') return choice;
  const day = Math.floor(d.getTime() / 86_400_000);
  const list = SEASON_WEATHER[seasonOf(d)];
  return list[(day * 7 + 3) % list.length];
}
export function resolveDaypart(world: WorldConfig, d = new Date()): Daypart {
  const choice = featureState(world, 'daynight').settings?.choice ?? 'clock';
  if (choice !== 'clock') return choice;
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5.5 && h < 9) return 'morning';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'golden';
  if (h >= 19.5 && h < 21.5) return 'dusk';
  return 'night';
}
/** Re-checks the clock every few minutes so the light changes while the page is open. */
export function useDaypart(world: WorldConfig, enabled: boolean): Daypart {
  const [part, setPart] = useState(() => resolveDaypart(world));
  useEffect(() => {
    setPart(resolveDaypart(world));
    if (!enabled) return;
    const t = window.setInterval(() => setPart(resolveDaypart(world)), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [world, enabled]);
  return part;
}

const TINT: Record<Daypart, { fill: string; opacity: number } | null> = {
  morning: { fill: '#ffe2c4', opacity: 0.16 },
  day: null,
  golden: { fill: '#f6b26b', opacity: 0.2 },
  dusk: { fill: '#8a5a8f', opacity: 0.26 },
  night: { fill: '#3b2a62', opacity: 0.38 },
};

/** Glowing spots (lamps, building windows) stay bright when the light dims. */
export function DaylightOverlay({ part, width, height, glows = [] }: { part: Daypart; width: number; height: number; glows?: { x: number; y: number; r: number }[] }) {
  const t = TINT[part];
  if (!t) return null;
  const dark = part === 'night' || part === 'dusk';
  return (
    <g className={`daylight daylight-${part}`} pointerEvents="none" aria-hidden>
      <defs><radialGradient id="rm-glow"><stop offset="0" stopColor="#ffe3a3" stopOpacity={0.75} /><stop offset="1" stopColor="#ffe3a3" stopOpacity={0} /></radialGradient></defs>
      <rect width={width} height={height} fill={t.fill} opacity={t.opacity} style={{ mixBlendMode: 'multiply' }} />
      {dark && glows.map((g, i) => <circle key={`g${i}`} className="lamp-glow" cx={g.x} cy={g.y} r={g.r} fill="url(#rm-glow)" style={{ mixBlendMode: 'screen' }} />)}
      {(part === 'night' || part === 'dusk') && Array.from({ length: 26 }, (_, i) => (
        <circle key={i} className="night-star twinkle" cx={(i * 211) % width} cy={(i * 37) % (height * 0.22)} r={i % 3 ? 1.6 : 2.4} fill="#fff6d8" opacity={part === 'night' ? 0.9 : 0.5} style={{ animationDelay: `${-(i % 7) * 0.6}s` }} />
      ))}
    </g>
  );
}

export function WeatherOverlay({ weather, width, height }: { weather: Weather; width: number; height: number }) {
  if (weather === 'clear') return null;
  const n = weather === 'rain' ? 70 : weather === 'snow' ? 60 : weather === 'petals' ? 26 : 0;
  const drops = Array.from({ length: n }, (_, i) => ({ x: (i * 97) % width, y: (i * 53) % height, d: -((i * 0.37) % 4), s: 0.7 + ((i * 13) % 10) / 20 }));
  return (
    <g className={`weather weather-${weather}`} pointerEvents="none" aria-hidden>
      {weather === 'sunny' && (
        <g className="sun-rays">
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${width * 0.9} -40 L${width * (0.25 + i * 0.09)} ${height} L${width * (0.29 + i * 0.09)} ${height} Z`} fill="#fff4c9" opacity={0.08} />)}
        </g>
      )}
      {weather === 'mist' && (
        <>
          <defs><filter id="rm-mist" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="28" /></filter></defs>
          {[0.38, 0.6, 0.8].map((f, i) => <ellipse key={i} className="mist-band" cx={width / 2} cy={height * f} rx={width * 0.62} ry={46} fill="#fffaf6" opacity={0.42} filter="url(#rm-mist)" style={{ animationDelay: `${-i * 9}s` }} />)}
        </>
      )}
      {weather === 'rain' && (
        <>
          <rect width={width} height={height} fill="#7d8fa8" opacity={0.08} />
          {drops.map((p, i) => <line key={i} className="rain-drop" x1={p.x} y1={p.y} x2={p.x - 6} y2={p.y + 22} stroke="#e8eef8" strokeWidth={1.6} opacity={0.6} style={{ animationDelay: `${p.d / 3}s` }} />)}
        </>
      )}
      {weather === 'snow' && drops.map((p, i) => <circle key={i} className="snow-flake" cx={p.x} cy={p.y} r={2.6 * p.s} fill="#ffffff" opacity={0.85} style={{ animationDelay: `${p.d * 2}s`, animationDuration: `${8 + (i % 5)}s` }} />)}
      {weather === 'petals' && drops.map((p, i) => <ellipse key={i} className="petal-fall" cx={p.x} cy={p.y} rx={5 * p.s} ry={3 * p.s} fill="var(--c-pink)" opacity={0.75} style={{ animationDelay: `${p.d * 3}s`, animationDuration: `${12 + (i % 6)}s` }} />)}
    </g>
  );
}

// ── Little interactions: tap the fountain, trees, roses, lamps and creatures ──
export type Poke = 'splash' | 'petals' | 'lamp' | 'hop';
export function pokeFor(art?: string): Poke | null {
  if (!art) return null;
  if (art === 'fountain' || art === 'home-pond' || art === 'well') return 'splash';
  if (art.startsWith('tree-') || art === 'rosebush' || art === 'hedge-arch' || art === 'flowerpot') return 'petals';
  if (art === 'lamppost' || art === 'candle' || art === 'floorlamp') return 'lamp';
  if (['bunny', 'deer', 'swan', 'butterfly'].includes(art) || art.startsWith('pet-')) return 'hop';
  return null;
}
export interface Effect { key: number; kind: Poke; x: number; y: number }
export function EffectLayer({ effects }: { effects: Effect[] }) {
  return (
    <g pointerEvents="none" aria-hidden>
      {effects.map((e) => (
        <g key={e.key} transform={`translate(${e.x} ${e.y})`} className={`poke poke-${e.kind}`}>
          {e.kind === 'splash' && [0, 1, 2].map((i) => <ellipse key={i} className="poke-ring" rx={30 + i * 18} ry={8 + i * 5} fill="none" stroke="var(--c-water)" strokeWidth={2.5} style={{ animationDelay: `${i * 0.18}s` }} />)}
          {e.kind === 'splash' && [-1, 0, 1].map((i) => <circle key={`d${i}`} className="poke-drop" cx={i * 14} cy={-10} r={4} fill="var(--c-water)" style={{ ['--dx' as any]: `${i * 20}px` }} />)}
          {e.kind === 'petals' && Array.from({ length: 9 }, (_, i) => <ellipse key={i} className="poke-petal" cx={(i - 4) * 10} cy={0} rx={5} ry={3} fill={i % 2 ? 'var(--c-pink)' : 'var(--c-rose)'} style={{ animationDelay: `${i * 0.06}s`, ['--dx' as any]: `${(i - 4) * 6}px` }} />)}
          {e.kind === 'hop' && [0, 1, 2].map((i) => <text key={i} className="poke-heart" x={(i - 1) * 16} y={0} fontSize={22} fill="var(--c-rose)" textAnchor="middle" style={{ animationDelay: `${i * 0.12}s` }}>♥</text>)}
        </g>
      ))}
    </g>
  );
}
