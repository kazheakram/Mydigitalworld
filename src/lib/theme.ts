import type { ThemeTokens } from '../../shared/types';

// Turns theme tokens into CSS custom properties. Every component styles itself from these
// variables, so the whole village recolours when a theme changes.

export function themeVars(t: ThemeTokens, overrides?: Record<string, string>): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, val] of Object.entries({ ...t.colors, ...(overrides ?? {}) })) v[`--c-${k}`] = val;
  const fam = (f: string, fallback: string) => `'${f}', ${fallback}`;
  v['--font-display'] = fam(t.fonts.display, 'Georgia, serif');
  v['--font-body'] = fam(t.fonts.body, 'Georgia, serif');
  v['--font-pixel'] = fam(t.fonts.pixel, 'monospace');
  v['--font-script'] = fam(t.fonts.script, 'cursive');
  v['--fs-base'] = `${t.sizes.base}px`;
  v['--fs-scale'] = String(t.sizes.scale);
  v['--radius'] = `${t.radius}px`;
  v['--shadow-a'] = String(t.shadow);
  v['--anim'] = String(t.animation);
  return v;
}

export function applyTheme(t: ThemeTokens, motionOff: boolean) {
  const root = document.documentElement;
  for (const [k, val] of Object.entries(themeVars(t))) root.style.setProperty(k, val);
  root.dataset.frame = t.frame;
  root.dataset.button = t.button;
  root.dataset.texture = t.texture;
  root.dataset.cursor = t.cursor;
  root.dataset.hover = t.hover;
  root.dataset.season = t.season;
  root.dataset.motion = motionOff || t.animation === 0 ? 'off' : t.animation >= 2 ? 'lively' : 'on';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.colors.pink);
}

/** Relative luminance contrast, used by the theme editor to warn about hard-to-read text. */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  try {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  } catch { return 21; }
}
