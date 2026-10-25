import type { Appearance, ThemeTokens } from './types';

// Appearance modes change how Ribbonmere *looks*, never what it contains.
// They sit on top of whichever theme is active, so switching back restores it exactly.

export const APPEARANCES: { id: Appearance; name: string; about: string }[] = [
  { id: 'coquette', name: 'Coquette', about: 'The original: baby pink, lace, pearls and bows.' },
  { id: 'quiet', name: 'Quiet', about: 'Low-stimulation: still, simple, easier to read. Decorations and games step aside.' },
  { id: 'pixie', name: 'Pixie', about: 'A nostalgic pixel-art look, like an old internet game.' },
  { id: 'midnight', name: 'Midnight', about: 'Deep plum, dusty rose and candlelight.' },
];

export const MIDNIGHT_COLORS: Record<string, string> = {
  bg: '#2b1b28', paper: '#3a2635', ink: '#f6e6ed', inkSoft: '#d6bccb', pink: '#d9a3b6', blush: '#4d3246',
  rose: '#cf8fa4', roseDeep: '#f2c2d0', cream: '#45293e', gold: '#e9c47e', sage: '#4b5248', sageDeep: '#343b34',
  sky: '#4c2f49', skyTop: '#1f121c', water: '#5a5370', path: '#6b5163', roof: '#8f5675', wall: '#ead7df',
  trim: '#f7e8ef', window: '#ffd68f', accent: '#b897b4', focus: '#ffd68f',
};

export function applyAppearance(t: ThemeTokens, a: Appearance): ThemeTokens {
  switch (a) {
    case 'midnight':
      return { ...t, colors: { ...t.colors, ...MIDNIGHT_COLORS }, season: t.season === 'none' ? 'none' : 'fireflies' };
    case 'pixie':
      return {
        ...t, radius: 0, frame: 'pixel', button: 'pixel', texture: 'dots', cursor: 'default',
        fonts: { ...t.fonts, display: 'Pixelify Sans', script: 'Pixelify Sans', body: 'Pixelify Sans' },
        sizes: { ...t.sizes, base: Math.max(16, t.sizes.base - 1) },
      };
    case 'quiet':
      return {
        ...t, frame: 'plain', texture: 'none', season: 'none', animation: 0, cursor: 'default', hover: 'none', shadow: Math.min(t.shadow, 0.3),
        sizes: { ...t.sizes, base: Math.max(t.sizes.base, 19) },
        fonts: { ...t.fonts, body: t.fonts.body === 'Cormorant Garamond' ? 'EB Garamond' : t.fonts.body },
      };
    default:
      return t;
  }
}
