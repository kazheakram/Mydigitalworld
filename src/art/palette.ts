// Artwork colours resolve to theme tokens (CSS variables) unless an object overrides them.
export type ArtColors = Record<string, string>;
export const tok = (name: string) => `var(--c-${name})`;
export function pick(colors: ArtColors | undefined, key: string, fallbackToken: string) {
  return colors?.[key] || tok(fallbackToken);
}
/** Shared outline style so every illustration reads as one hand. */
export const line = { stroke: 'var(--c-ink)', strokeOpacity: 0.38, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
export const thin = { ...line, strokeWidth: 1.4 };
