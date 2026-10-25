// Shared data shapes for Ribbonmere. Both the server and the client import these,
// so the world, theme and content formats stay in one place.

export type Visibility = 'private' | 'public' | 'unlisted';

/** Every piece of content lives as an Item with a kind and a free-form `data` object. */
export interface Item<D = Record<string, any>> {
  id: string;
  kind: ItemKind;
  roomId: string | null;
  visibility: Visibility;
  data: D;
  createdAt: string;
  updatedAt: string;
}

export const ITEM_KINDS = [
  'book', 'entry', 'artwork', 'music', 'note', 'bookmark', 'inbox', 'expedition',
  'link', 'drink', 'star', 'secret', 'todo', 'guestbook', 'media', 'freeform',
  // Ribbonmere 2.0
  'pet', 'excerpt', 'film', 'memory', 'scrapbook', 'letter', 'capsule', 'edition', 'challenge', 'progress',
  // Book Tracker sync (connection settings, sync history and open questions)
  'sheetsync',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** Kinds that only ever belong to the owner and are never served to visitors. */
export const ALWAYS_PRIVATE_KINDS: ItemKind[] = ['inbox', 'expedition', 'todo', 'bookmark', 'capsule', 'edition', 'challenge', 'progress', 'sheetsync'];

/** A thing placed on a scene (the world map, or a freeform room). Coordinates are in scene units. */
export interface SceneObject {
  id: string;
  type: 'building' | 'decor' | 'image' | 'text' | 'link';
  /** Built-in artwork key (see src/art) for buildings and decor. */
  art?: string;
  /** Uploaded image URL; replaces `art` when set. */
  src?: string;
  label?: string;
  text?: string;
  href?: string;
  /** Room this building opens. */
  roomId?: string;
  x: number; y: number; w: number; h: number;
  z: number;
  rotation?: number;
  opacity?: number;
  flip?: boolean;
  hidden?: boolean;
  /** Optional per-object colour overrides, e.g. { roof: '#c97b8a', wall: '#fff3ec' }. */
  colors?: Record<string, string>;
  regionId?: string;
  /** Owner-only objects (e.g. the private wing door) are removed from the public world. */
  ownerOnly?: boolean;
  /** Tiny animation preset: 'sway' | 'bob' | 'wander' | 'twinkle' | 'none'. */
  animation?: string;
  /** Easter egg: clicking reveals a secret or stamp. */
  secret?: { message?: string; stamp?: string; roomId?: string };
  /** Belongs to an optional feature; hidden everywhere while that feature is switched off. */
  feature?: string;
  /** Picture frame drawn around an image (Ribbonmere 2.0). */
  frame?: 'gold' | 'lace' | 'polaroid' | 'oval';
}

export interface Region {
  id: string;
  name: string;
  revealed: boolean;
  mystery: string;
  x: number; y: number; w: number; h: number;
}

export type RoomTemplate =
  | 'welcome' | 'library' | 'journal' | 'gallery' | 'music' | 'postoffice' | 'cafe'
  | 'garden' | 'observatory' | 'secret' | 'collection' | 'freeform'
  // Ribbonmere 2.0
  | 'cinema' | 'recordstore' | 'bookstore' | 'museum' | 'commonplace' | 'region' | 'games';

export interface Room {
  id: string;
  name: string;
  template: RoomTemplate;
  visibility: Visibility;
  subtitle?: string;
  intro?: string;
  /** Room-level theme overrides (token -> value). */
  theme?: Record<string, string>;
  /** Template-specific settings (e.g. postoffice contact links, welcome guide). */
  settings?: Record<string, any>;
  /** Freeform rooms keep their arranged objects here. */
  scene?: SceneObject[];
  sceneBackground?: string;
}

export interface WorldConfig {
  version: number;
  name: string;
  tagline: string;
  scene: { width: number; height: number; ground: string };
  objects: SceneObject[];
  regions: Region[];
  rooms: Room[];
  /** Objects removed in the editor, kept so they can be restored. */
  trash?: SceneObject[];
  introEnabled: boolean;
  introText: string;
  gardenStages: { id: string; label: string; emoji?: string }[];
  dashboard: DashboardWidget[];
  inbox: { cooldownHours: number };
  /** Names and little captions for the three modes; all editable. */
  modes: Record<'visitor' | 'private' | 'stargirl', ModeCopy>;
  /** Ribbonmere 2.0: on / hidden / off for every optional feature, plus its own settings. */
  features?: Record<string, FeatureState>;
  /** The appearance visitors see first (each viewer can switch for themselves). */
  appearanceDefault?: Appearance;
}

export type FeatureMode = 'on' | 'hidden' | 'off';
export interface FeatureState { mode: FeatureMode; settings?: Record<string, any> }
export type Appearance = 'coquette' | 'quiet' | 'pixie' | 'midnight';

export interface ModeCopy {
  title: string;
  subtitle: string;
  notes: string[];
  theme?: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  hidden?: boolean;
  options?: Record<string, any>;
}

export interface ThemeTokens {
  id: string;
  name: string;
  colors: Record<string, string>;
  fonts: { display: string; body: string; pixel: string; script: string };
  sizes: { base: number; scale: number };
  radius: number;
  frame: 'lace' | 'pixel' | 'ribbon' | 'plain';
  button: 'pill' | 'pixel' | 'ribbon';
  texture: 'none' | 'gingham' | 'dots' | 'florals' | 'lace' | 'stars';
  shadow: number;
  animation: number; // 0 = still, 1 = normal, 2 = lively
  cursor: 'default' | 'heart' | 'wand';
  hover: 'lift' | 'glow' | 'none';
  season: 'none' | 'petals' | 'snow' | 'leaves' | 'fireflies' | 'hearts';
  /** Per-location colour overrides keyed by room id. */
  locations?: Record<string, Record<string, string>>;
}

export interface ThemeState {
  active: ThemeTokens;
  custom: ThemeTokens[];
}

export interface Feed {
  id: string;
  url: string;
  title: string;
  siteUrl?: string;
  category: string;
  lastFetched?: string;
  lastError?: string | null;
}

export interface FeedEntry {
  id: string;
  feedId: string;
  title: string;
  link: string;
  published: string | null;
  summary: string;
  image?: string | null;
  read: boolean;
  saved: boolean;
}
