import type { FeatureMode, FeatureState, ItemKind, RoomTemplate, WorldConfig } from './types';

// Ribbonmere 2.0 — every optional feature is described here once. The Feature Manager, the menus,
// the map and the routes all read from this list, so switching something off is always consistent.
//
//   on      → in the menus and on the map
//   hidden  → still works and keeps its data, but tucked out of menus and off the map
//   off     → resting: its pages show a little "resting" note; nothing is deleted
//   reset   → (separate, confirmed) deletes only this feature's own data/settings

export type FeatureGroup = 'World & Atmosphere' | 'Pets & Companions' | 'Reading & Media' | 'Internet Discovery' | 'Creative Spaces' | 'Gamification' | 'Appearance' | 'Integrations';
export const FEATURE_GROUPS: FeatureGroup[] = ['World & Atmosphere', 'Pets & Companions', 'Reading & Media', 'Internet Discovery', 'Creative Spaces', 'Gamification', 'Appearance', 'Integrations'];

export interface FeatureReset {
  /** Items of these kinds are deleted by a reset… */
  kinds?: ItemKind[];
  /** …but only inside rooms of these templates (when given), so shared kinds stay safe. */
  inTemplates?: RoomTemplate[];
  /** Fields removed from items of other kinds (e.g. map positions on expeditions). */
  fields?: { kind: ItemKind; keys: string[] }[];
  /** Per-device keys cleared (visitors' stamps, game scores…). */
  local?: string[];
  /** Progress fields cleared in the owner's progress record. */
  progress?: string[];
  /** A short, honest description shown in the confirmation. */
  what: string;
}

export interface FeatureDef {
  id: string;
  name: string;
  group: FeatureGroup;
  about: string;
  defaultMode: FeatureMode;
  /** Room templates that belong to this feature (their buildings and pages follow its mode). */
  templates?: RoomTemplate[];
  /** Menu entries this feature adds. */
  nav?: { label: string; to: string; area: 'dollhouse' | 'stargirl' | 'village' | 'atelier' }[];
  /** Pages (paths) that belong to this feature. */
  routes?: string[];
  reset?: FeatureReset;
  /** Shown in Quiet Mode? (decorative and game features step aside there). */
  quietHides?: boolean;
}

export const FEATURES: FeatureDef[] = [
  // ── World & Atmosphere ──
  { id: 'intro', name: 'Ribbon welcome', group: 'World & Atmosphere', about: 'The curtain-and-bow welcome visitors see when they arrive.', defaultMode: 'on', quietHides: true },
  { id: 'seasons', name: 'Seasonal effects', group: 'World & Atmosphere', about: 'Drifting petals, snow, leaves, fireflies or hearts (chosen in the Theme Closet).', defaultMode: 'on', quietHides: true },
  { id: 'weather', name: 'Weather', group: 'World & Atmosphere', about: 'Gentle rain, mist, snow or sunshine over the village — follows the season or your choice.', defaultMode: 'on', quietHides: true, reset: { what: 'Weather goes back to following the season.' } },
  { id: 'daynight', name: 'Day & night', group: 'World & Atmosphere', about: 'The village light follows your clock: golden mornings, dusky evenings, glowing windows at night.', defaultMode: 'on', quietHides: true },
  { id: 'interactions', name: 'Little interactions', group: 'World & Atmosphere', about: 'Tap the fountain, trees and lamps for small surprises.', defaultMode: 'on', quietHides: true },
  { id: 'stamps', name: 'Easter eggs & stamps', group: 'World & Atmosphere', about: 'Curious things that hide secrets and stamps around the village.', defaultMode: 'on', quietHides: true, reset: { local: ['rm-stamps'], what: 'Forgets the stamps found on this device.' } },
  { id: 'regions', name: 'Paths beyond the village', group: 'World & Atmosphere', about: 'Woodland, seaside, shopping street, rose maze, winter village, meadow and lakeside — each one a place to wander, no quests.', defaultMode: 'on', templates: ['region'], routes: ['/paths'], nav: [{ label: 'Paths', to: '/paths', area: 'village' }] },

  // ── Pets ──
  { id: 'pets', name: 'Pet companions', group: 'Pets & Companions', about: 'Adopt a bunny, fawn, kitten or swan. They never get hungry, sad or lost — they simply wait for you.', defaultMode: 'on', routes: ['/dollhouse/pets'], nav: [{ label: 'Pets', to: '/dollhouse/pets', area: 'dollhouse' }], reset: { kinds: ['pet'], what: 'Says goodbye to all adopted pets and their accessories.' } },

  // ── Reading & Media ──
  { id: 'newspaper', name: 'The Morning Paper', group: 'Reading & Media', about: 'A vintage newspaper made from your own RSS subscriptions, with daily editions and an archive.', defaultMode: 'on', routes: ['/dollhouse/newspaper'], nav: [{ label: 'Newspaper', to: '/dollhouse/newspaper', area: 'dollhouse' }], reset: { kinds: ['edition'], what: 'Deletes the archive of past editions (your subscriptions and saved posts stay).' } },
  { id: 'parlour', name: 'The Video Parlour', group: 'Reading & Media', about: 'A vintage television for the YouTube channels you follow and the videos you save.', defaultMode: 'on', routes: ['/dollhouse/parlour'], nav: [{ label: 'Video Parlour', to: '/dollhouse/parlour', area: 'dollhouse' }], reset: { what: 'Resets the parlour’s settings (your bookmarks and subscriptions stay).' } },
  { id: 'readingJournal', name: 'Reading Journal', group: 'Reading & Media', about: 'Reading history, gentle statistics, yearly wrap-ups and optional, pressure-free challenges.', defaultMode: 'on', routes: ['/dollhouse/reading-journal'], nav: [{ label: 'Reading Journal', to: '/dollhouse/reading-journal', area: 'dollhouse' }], reset: { kinds: ['challenge'], what: 'Deletes your reading challenges (your books stay).' } },
  { id: 'commonplace', name: 'The Commonplace Book', group: 'Reading & Media', about: 'Quotations, excerpts, reflections and ideas — linked to your books, pages and notes.', defaultMode: 'on', templates: ['commonplace'], reset: { kinds: ['excerpt'], what: 'Deletes every commonplace entry.' } },
  { id: 'cinema', name: 'The Picture House', group: 'Reading & Media', about: 'Favourite films, reviews, posters and a watchlist.', defaultMode: 'on', templates: ['cinema'], reset: { kinds: ['film'], what: 'Deletes every film in your cinema.' } },
  { id: 'recordstore', name: 'The Record Shop', group: 'Reading & Media', about: 'Albums and artists in crates and on shelves, with your reviews.', defaultMode: 'on', templates: ['recordstore'], reset: { kinds: ['music'], inTemplates: ['recordstore'], what: 'Deletes the records in the Record Shop (the Gramophone Pavilion is untouched).' } },
  { id: 'bookstore', name: 'The Bookshop', group: 'Reading & Media', about: 'Themed displays of recommendations and your wishlist, separate from your own library.', defaultMode: 'on', templates: ['bookstore'], reset: { kinds: ['book'], inTemplates: ['bookstore'], what: 'Deletes the books in the Bookshop (your library is untouched).' } },

  // ── Internet Discovery ──
  { id: 'reader', name: 'Favorites (RSS reader)', group: 'Internet Discovery', about: 'Follow blogs, newsletters, podcasts and YouTube channels.', defaultMode: 'on', routes: ['/dollhouse/favorites'], nav: [{ label: 'Favorites', to: '/dollhouse/favorites', area: 'dollhouse' }] },
  { id: 'letterbox', name: 'The Letterbox', group: 'Internet Discovery', about: 'Save anything for later, with an optional cooldown.', defaultMode: 'on', routes: ['/dollhouse/inbox'], nav: [{ label: 'Inbox', to: '/dollhouse/inbox', area: 'dollhouse' }] },
  { id: 'cabinet', name: 'Cabinet of Curiosities', group: 'Internet Discovery', about: 'Your bookmarks and collections.', defaultMode: 'on', routes: ['/dollhouse/bookmarks'], nav: [{ label: 'Bookmarks', to: '/dollhouse/bookmarks', area: 'dollhouse' }] },
  { id: 'stargirl', name: 'Stargirl Mode', group: 'Internet Discovery', about: 'Expeditions, curated picks and saved discoveries.', defaultMode: 'on', routes: ['/stargirl', '/stargirl/picks', '/stargirl/rabbit-holes', '/stargirl/discoveries'] },
  { id: 'rabbitmap', name: 'Rabbit-hole map', group: 'Internet Discovery', about: 'Your discoveries as a map of connected nodes you can arrange.', defaultMode: 'on', routes: ['/stargirl/map'], nav: [{ label: 'Discovery Map', to: '/stargirl/map', area: 'stargirl' }], reset: { fields: [{ kind: 'expedition', keys: ['map'] }], what: 'Forgets node positions, labels and connections (discoveries stay).' } },

  // ── Creative Spaces ──
  { id: 'bedroom', name: 'My bedroom', group: 'Creative Spaces', about: 'A private dollhouse room to decorate with furniture, wallpaper and your photographs.', defaultMode: 'on', routes: ['/dollhouse/bedroom'], nav: [{ label: 'Bedroom', to: '/dollhouse/bedroom', area: 'dollhouse' }], reset: { what: 'Empties the bedroom back to its starting furniture (your images stay in the media library).' } },
  { id: 'museum', name: 'The Memory Museum', group: 'Creative Spaces', about: 'Exhibitions and timelines of photographs and milestones — private unless you choose.', defaultMode: 'on', templates: ['museum'], reset: { kinds: ['memory'], what: 'Deletes every memory in your museums (the photos stay in the media library).' } },
  { id: 'scrapbook', name: 'Scrapbook studio', group: 'Creative Spaces', about: 'Arrange photos, papers, stickers, ribbons and words into pages.', defaultMode: 'on', routes: ['/dollhouse/scrapbook'], nav: [{ label: 'Scrapbook', to: '/dollhouse/scrapbook', area: 'dollhouse' }], reset: { kinds: ['scrapbook'], what: 'Deletes every scrapbook page.' } },
  { id: 'letters', name: 'Letter-writing desk', group: 'Creative Spaces', about: 'Write letters on pretty stationery with stamps and wax seals; keep them private or share a link.', defaultMode: 'on', routes: ['/dollhouse/letters'], nav: [{ label: 'Letters', to: '/dollhouse/letters', area: 'dollhouse' }], reset: { kinds: ['letter'], what: 'Deletes every letter you have written (guestbook letters are untouched).' } },
  { id: 'capsules', name: 'Time capsules', group: 'Creative Spaces', about: 'Seal letters, photos and links for a future day. You can always open them early.', defaultMode: 'on', routes: ['/dollhouse/capsules'], nav: [{ label: 'Time Capsules', to: '/dollhouse/capsules', area: 'dollhouse' }], reset: { kinds: ['capsule'], what: 'Deletes every time capsule.' } },

  // ── Gamification ──
  { id: 'achievements', name: 'Achievements', group: 'Gamification', about: 'Little celebrations for exploring and making things. Never for productivity, never streaks.', defaultMode: 'on', quietHides: true, routes: ['/dollhouse/charms'], reset: { progress: ['achievements'], local: ['rm-achievements'], what: 'Forgets earned achievements.' } },
  { id: 'pearls', name: 'Pearls & the Charm Shop', group: 'Gamification', about: 'Pretend pearls earned by playing and exploring, spent on cosmetic charms. No real money, ever — and everything stays available in the Atelier anyway.', defaultMode: 'on', quietHides: true, nav: [{ label: 'Charms', to: '/dollhouse/charms', area: 'dollhouse' }], reset: { progress: ['pearls', 'unlocked'], local: ['rm-pearls'], what: 'Sets pearls back to zero and forgets unlocked charms.' } },
  { id: 'minigames', name: 'Little games', group: 'Gamification', about: 'Memory cards, hidden objects, letter sorting, flower arranging and a picture puzzle. Relaxing, untimed, optional.', defaultMode: 'on', quietHides: true, templates: ['games'], reset: { progress: ['games'], local: ['rm-games'], what: 'Forgets game results and saved bouquets.' } },

  // ── Appearance ──
  { id: 'appearanceSwitch', name: 'Appearance switcher', group: 'Appearance', about: 'Lets everyone pick Coquette, Quiet, Pixie or Midnight from the ☾ menu.', defaultMode: 'on' },

  // ── Integrations ──
  { id: 'linkPreviews', name: 'Link previews', group: 'Integrations', about: 'Fetch titles and pictures when you save a link.', defaultMode: 'on' },
  { id: 'youtubeFeeds', name: 'YouTube channel feeds', group: 'Integrations', about: 'Show videos from YouTube channels you follow in the reader and the parlour (public feeds only).', defaultMode: 'on' },
  { id: 'shareTarget', name: 'Share to Ribbonmere', group: 'Integrations', about: 'Save links from your phone’s Share menu or the bookmarklet.', defaultMode: 'on', routes: ['/share'] },
];

export const FEATURE_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));

export function featureState(world: Pick<WorldConfig, 'features'> | null | undefined, id: string): FeatureState {
  const def = FEATURE_BY_ID.get(id);
  return world?.features?.[id] ?? { mode: def?.defaultMode ?? 'on' };
}
export const featureMode = (world: Pick<WorldConfig, 'features'> | null | undefined, id: string): FeatureMode => featureState(world, id).mode;

/** Which feature owns a room template (if any). */
export function featureForTemplate(t: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.templates?.includes(t as RoomTemplate));
}
/** Which feature owns a page path (longest match). */
export function featureForPath(path: string): FeatureDef | undefined {
  let best: FeatureDef | undefined; let len = 0;
  for (const f of FEATURES) for (const r of f.routes ?? []) {
    if ((path === r || path.startsWith(r + '/')) && r.length > len) { best = f; len = r.length; }
  }
  return best;
}

/** For visitors: only modes travel, never a feature's private settings. */
export function publicFeatures(features: WorldConfig['features']): WorldConfig['features'] {
  if (!features) return undefined;
  return Object.fromEntries(Object.entries(features).map(([k, v]) => [k, { mode: v.mode }]));
}
