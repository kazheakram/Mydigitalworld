// Collectible stamps found by clicking curious things around the village.
// Stored only in the visitor's own browser — they're a game, not data.
const KEY = 'rm-stamps';
export const STAMP_NAMES: Record<string, string> = {
  bunny: 'The Curious Bunny', violet: 'Pressed Violet', deer: 'Dusk Deer', bow: 'Double Knot', pearl: 'Kept Pearl',
  rose: 'Garden Rose', star: 'Wishing Star', key: 'Little Key',
};
export function getStamps(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
export function addStamp(s: string): boolean {
  const all = getStamps();
  if (all.includes(s)) return false;
  try { localStorage.setItem(KEY, JSON.stringify([...all, s])); } catch { /* private window */ }
  return true;
}
