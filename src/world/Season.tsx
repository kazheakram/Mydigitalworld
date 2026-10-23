import { useMemo } from 'react';
import { useStore } from '../lib/store';

// Optional drifting petals, snow, leaves, fireflies or hearts. Purely decorative; switched off
// with motion, reduced-motion preferences, or the theme's season setting.
export function SeasonLayer() {
  const { theme, motionOff } = useStore();
  const season = theme.active.season;
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53) % 100, delay: -((i * 3.7) % 18), dur: 14 + ((i * 7) % 10), size: 8 + ((i * 5) % 9),
  })), []);
  if (season === 'none' || motionOff) return null;
  const glyph = { petals: '❀', snow: '❄', leaves: '❦', fireflies: '•', hearts: '♡' }[season] ?? '❀';
  return (
    <div className={`season season-${season}`} aria-hidden>
      {bits.map((b, i) => (
        <span key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, fontSize: b.size }}>{glyph}</span>
      ))}
    </div>
  );
}
