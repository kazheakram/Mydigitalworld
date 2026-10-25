import { ACHIEVEMENT_BY_ID } from '../../shared/achievements';
import { items as itemsApi } from './api';

// Optional, playful progress: achievements, pretend pearls, unlocked charms and game results.
// The owner's progress is saved privately with the rest of the world; a visitor's lives only on
// their own device. Nothing here ever expires, decays or depends on visiting every day.

export interface Progress {
  achievements: Record<string, string>;
  pearls: number;
  unlocked: string[];
  games: Record<string, { plays: number; best?: number; last?: string; keepsakes?: any[] }>;
  visited: string[];
}
const EMPTY: Progress = { achievements: {}, pearls: 0, unlocked: [], games: {}, visited: [] };

interface Ctx { owner: boolean; achievementsOn: boolean; pearlsOn: boolean; celebrate: (msg: string) => void }
let ctx: Ctx = { owner: false, achievementsOn: true, pearlsOn: true, celebrate: () => {} };
export const setProgressContext = (c: Ctx) => { ctx = c; cache = null; };

let cache: Progress | null = null;
let ownerItemId: string | null = null;
let chain: Promise<unknown> = Promise.resolve();

const readLocal = (): Progress => {
  const get = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
  const a = get('rm-achievements', {}); const p = get('rm-pearls', {}); const g = get('rm-games', {});
  return { ...EMPTY, achievements: a, pearls: p.pearls ?? 0, unlocked: p.unlocked ?? [], games: g, visited: get('rm-visited', []) };
};
const writeLocal = (pr: Progress) => {
  try {
    localStorage.setItem('rm-achievements', JSON.stringify(pr.achievements));
    localStorage.setItem('rm-pearls', JSON.stringify({ pearls: pr.pearls, unlocked: pr.unlocked }));
    localStorage.setItem('rm-games', JSON.stringify(pr.games));
    localStorage.setItem('rm-visited', JSON.stringify(pr.visited));
  } catch { /* private window: progress just isn't remembered */ }
};

export async function getProgress(): Promise<Progress> {
  if (cache) return cache;
  if (!ctx.owner) { cache = readLocal(); return cache; }
  try {
    const list = await itemsApi.list<Progress>('progress');
    const it = list[0];
    ownerItemId = it?.id ?? null;
    cache = { ...EMPTY, ...(it?.data ?? {}) };
  } catch { cache = readLocal(); }
  return cache;
}

function save(pr: Progress) {
  cache = pr;
  window.dispatchEvent(new CustomEvent('rm-progress'));
  if (!ctx.owner) { writeLocal(pr); return Promise.resolve(); }
  // Serialise owner writes so quick successive awards don't race.
  chain = chain.then(async () => {
    if (ownerItemId) await itemsApi.update(ownerItemId, { data: pr, replace: true });
    else ownerItemId = (await itemsApi.create('progress', pr)).id;
  }).catch(() => {});
  return chain;
}

/** Celebrate an achievement once. Returns true if it was new. */
export async function award(id: string): Promise<boolean> {
  if (!ctx.achievementsOn) return false;
  const def = ACHIEVEMENT_BY_ID.get(id);
  if (!def) return false;
  const pr = await getProgress();
  if (pr.achievements[id]) return false;
  const next = { ...pr, achievements: { ...pr.achievements, [id]: new Date().toISOString() }, pearls: pr.pearls + (ctx.pearlsOn ? def.pearls : 0) };
  await save(next);
  ctx.celebrate(`${def.glyph} ${def.name}${ctx.pearlsOn && def.pearls ? ` · +${def.pearls} pearls` : ''}`);
  return true;
}

export async function addPearls(n: number) {
  if (!ctx.pearlsOn || n <= 0) return;
  const pr = await getProgress();
  await save({ ...pr, pearls: pr.pearls + n });
}

export async function unlockCharm(id: string, price: number): Promise<string | null> {
  const pr = await getProgress();
  if (pr.unlocked.includes(id)) return 'You already have this charm.';
  if (pr.pearls < price) return `This charm needs ${price} pearls — you have ${pr.pearls}. Pearls come from playing and exploring, whenever you like.`;
  await save({ ...pr, pearls: pr.pearls - price, unlocked: [...pr.unlocked, id] });
  await award('charm');
  return null;
}

export async function recordGame(game: string, patch: { best?: number; keepsake?: any } = {}) {
  const pr = await getProgress();
  const cur = pr.games[game] ?? { plays: 0 };
  const best = patch.best === undefined ? cur.best : cur.best === undefined ? patch.best : Math.min(cur.best, patch.best);
  const keepsakes = patch.keepsake ? [patch.keepsake, ...(cur.keepsakes ?? [])].slice(0, 24) : cur.keepsakes;
  await save({ ...pr, games: { ...pr.games, [game]: { plays: cur.plays + 1, best, last: new Date().toISOString(), keepsakes } } });
}

/** Remember a visited place (for the Wanderer achievement); never shown as a chore. */
export async function noteVisit(placeId: string) {
  const pr = await getProgress();
  if (pr.visited.includes(placeId)) return pr.visited.length;
  await save({ ...pr, visited: [...pr.visited, placeId] });
  return pr.visited.length + 1;
}

export async function resetProgress(fields: string[]) {
  const pr = await getProgress();
  const next: Progress = { ...pr };
  for (const f of fields) (next as any)[f] = (EMPTY as any)[f];
  await save(next);
  if (!ctx.owner) writeLocal(next);
}
