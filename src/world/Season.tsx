import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { featureMode } from '../../shared/features';

// Optional drifting petals, snow, leaves, fireflies or hearts. Purely decorative; switched off
// with motion, reduced-motion preferences, or the theme's season setting.
export function SeasonLayer() {
  const { theme, motionOff, world, appearance } = useStore();
  const season = theme.active.season;
  const on = featureMode(world, 'seasons') === 'on' && appearance !== 'quiet';
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53) % 100, delay: -((i * 3.7) % 18), dur: 14 + ((i * 7) % 10), size: 8 + ((i * 5) % 9),
  })), []);
  if (season === 'none' || motionOff || !on) return null;
  const glyph = { petals: '❀', snow: '❄', leaves: '❦', fireflies: '•', hearts: '♡' }[season] ?? '❀';
  return (
    <div className={`season season-${season}`} aria-hidden>
      {bits.map((b, i) => (
        <span key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, fontSize: b.size }}>{glyph}</span>
      ))}
    </div>
  );
}
