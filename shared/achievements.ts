// Little celebrations for wandering, collecting and making things.
// Never for productivity, never for streaks or "every day" — nothing can be lost by taking a break.

export interface AchievementDef { id: string; name: string; about: string; pearls: number; glyph: string }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', name: 'Through the Gate', about: 'Untied the ribbon and stepped into the village.', pearls: 3, glyph: '🎀' },
  { id: 'secret-garden', name: 'The Secret Garden', about: 'Found the hidden garden.', pearls: 10, glyph: '❦' },
  { id: 'stamp-collector', name: 'Stamp Collector', about: 'Found five stamps around the village.', pearls: 10, glyph: '✉' },
  { id: 'curious', name: 'Curious Heart', about: 'Found your first easter egg.', pearls: 5, glyph: '✧' },
  { id: 'wanderer', name: 'Wanderer', about: 'Visited six different places in the village.', pearls: 8, glyph: '❀' },
  { id: 'beyond', name: 'Beyond the Village', about: 'Walked one of the paths beyond the village.', pearls: 8, glyph: '🌿' },
  { id: 'all-paths', name: 'Every Path', about: 'Wandered every revealed path.', pearls: 15, glyph: '🗺' },
  { id: 'pet-friend', name: 'A New Friend', about: 'Adopted a companion.', pearls: 10, glyph: '🐇' },
  { id: 'dressed-up', name: 'Dressed Up', about: 'Gave a companion a new accessory.', pearls: 4, glyph: '🎀' },
  { id: 'decorator', name: 'Little Decorator', about: 'Placed five things in your bedroom.', pearls: 8, glyph: '🛋' },
  { id: 'scrapbooker', name: 'Scrapbooker', about: 'Made a scrapbook page.', pearls: 6, glyph: '✂' },
  { id: 'collector', name: 'Collector', about: 'Started a new collection (a shelf, crate, exhibition or display).', pearls: 6, glyph: '🗝' },
  { id: 'commonplace', name: 'Pressed Between Pages', about: 'Kept your first passage in the commonplace book.', pearls: 4, glyph: '❧' },
  { id: 'letter-writer', name: 'Dear Friend', about: 'Wrote a letter at the writing desk.', pearls: 5, glyph: '✒' },
  { id: 'capsule', name: 'Message in a Bottle', about: 'Sealed a time capsule.', pearls: 5, glyph: '⏳' },
  { id: 'capsule-opened', name: 'Hello Again', about: 'Opened a time capsule.', pearls: 5, glyph: '💌' },
  { id: 'discoverer', name: 'Discoverer', about: 'Pocketed an interesting website on an expedition.', pearls: 5, glyph: '🔭' },
  { id: 'cartographer', name: 'Cartographer', about: 'Connected two discoveries on the rabbit-hole map.', pearls: 5, glyph: '✦' },
  { id: 'games-memory', name: 'Good Memory', about: 'Matched every pair in the memory game.', pearls: 6, glyph: '🃏' },
  { id: 'games-hidden', name: 'Sharp Eyes', about: 'Found everything hidden in the garden.', pearls: 6, glyph: '🔍' },
  { id: 'games-letters', name: 'Postmistress', about: 'Sorted the post.', pearls: 6, glyph: '📮' },
  { id: 'games-flowers', name: 'Florist', about: 'Arranged a bouquet.', pearls: 6, glyph: '💐' },
  { id: 'games-puzzle', name: 'Puzzler', about: 'Put the picture back together.', pearls: 6, glyph: '🧩' },
  { id: 'charm', name: 'Charmed', about: 'Chose your first charm from the Charm Shop.', pearls: 0, glyph: '💎' },
];
export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Cosmetic charms. Purely decorative and always also available in the Atelier. */
export interface CharmDef { id: string; name: string; kind: 'pet-accessory' | 'wallpaper' | 'frame' | 'decor' | 'theme'; price: number; about: string }
export const CHARMS: CharmDef[] = [
  { id: 'acc-pearls', name: 'Pearl collar', kind: 'pet-accessory', price: 10, about: 'A tiny string of pearls for a companion.' },
  { id: 'acc-crown', name: 'Flower crown', kind: 'pet-accessory', price: 12, about: 'Daisies and rosebuds.' },
  { id: 'acc-bonnet', name: 'Lace bonnet', kind: 'pet-accessory', price: 15, about: 'Very old-fashioned.' },
  { id: 'wp-roses', name: 'Rose wallpaper', kind: 'wallpaper', price: 12, about: 'Climbing roses for the bedroom.' },
  { id: 'wp-stars', name: 'Starry wallpaper', kind: 'wallpaper', price: 12, about: 'For a midnight bedroom.' },
  { id: 'frame-gilt', name: 'Gilded frame', kind: 'frame', price: 8, about: 'An ornate frame for photographs.' },
  { id: 'decor-swan-lamp', name: 'Swan lamp', kind: 'decor', price: 14, about: 'A porcelain swan with a glowing shade.' },
  { id: 'decor-music-box', name: 'Music box', kind: 'decor', price: 14, about: 'A ballerina music box.' },
  { id: 'theme-valentine', name: 'Vintage Valentine theme', kind: 'theme', price: 20, about: 'A keepsake of the theme preset.' },
];
