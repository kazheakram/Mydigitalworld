import type { WorldConfig, SceneObject, Room } from './types';

// The village as it looks the first time it opens. Everything here is editable in the
// Atelier and is stored in the database after the first save — this file is only the seed.

const b = (o: Partial<SceneObject> & Pick<SceneObject, 'id' | 'x' | 'y' | 'w' | 'h'>): SceneObject => ({
  type: 'building', z: 10, opacity: 1, animation: 'none', ...o,
});
const d = (o: Partial<SceneObject> & Pick<SceneObject, 'id' | 'art' | 'x' | 'y' | 'w' | 'h'>): SceneObject => ({
  type: 'decor', z: 5, opacity: 1, ...o,
});

export const DEFAULT_ROOMS: Room[] = [
  {
    id: 'welcome', name: 'Bowknot Cottage', template: 'welcome', visibility: 'public',
    subtitle: 'come in, the kettle is warm',
    intro: 'Hello, and welcome to Ribbonmere — my little village at the quiet end of the internet. Wipe your shoes on the rose mat, take a cup of something sweet, and wander wherever the cobblestones lead you.',
    settings: {
      guide: [
        'Every building is a room. Click (or tap) one to step inside.',
        'The little signpost at the bottom of the map lists every place, if you prefer a plain path.',
        'Some things hide. Bunnies are rarely just bunnies.',
        'Parts of the village are still sleeping under the clouds. They will wake in time.',
      ],
      signature: 'with love, from the cottage',
    },
  },
  { id: 'library', name: 'The Pressed-Flower Library', template: 'library', visibility: 'public', subtitle: 'books, quotes & reading goals', intro: 'Every book I have loved, lost myself in, or meant to read someday.', settings: { goal: 24, shelves: ['Currently Reading', 'Favourites', 'Want to Read', 'Read'] } },
  { id: 'journal', name: 'Inkwell House', template: 'journal', visibility: 'public', subtitle: 'essays, letters to no one, small reflections', intro: 'Pages from my diary that I decided to leave out on the desk.' },
  { id: 'gallery', name: 'The Easel Loft', template: 'gallery', visibility: 'public', subtitle: 'art & creative projects', intro: 'Paint-smudged things, sketches and finished pieces.' },
  { id: 'music', name: 'The Gramophone Pavilion', template: 'music', visibility: 'public', subtitle: 'records, playlists & songs for sad sunsets', intro: 'Put the needle down. These are the songs that live in my head.' },
  {
    id: 'postoffice', name: 'Pearl Post Office', template: 'postoffice', visibility: 'public', subtitle: 'letters, guestbook & ways to reach me',
    intro: 'Leave a note in the guestbook, or find me elsewhere on the internet.',
    settings: { guestbookOpen: true, stationery: 'rose', contacts: [{ label: 'Email', url: 'mailto:hello@example.com' }] },
  },
  { id: 'cafe', name: 'Café Meringue', template: 'cafe', visibility: 'public', subtitle: 'pick a drink, get a recommendation', intro: 'Sit by the window. Choose something from the menu and I will tell you what to read, watch or listen to with it.' },
  { id: 'garden', name: 'The Seedling Greenhouse', template: 'garden', visibility: 'public', subtitle: 'a digital garden of unfinished thoughts', intro: 'Notes that are still growing. Nothing here is finished, and that is the point.' },
  { id: 'observatory', name: 'Starlace Observatory', template: 'observatory', visibility: 'public', subtitle: 'dreams, curiosities & future plans', intro: 'Each star is something I am curious about or hoping for.' },
  { id: 'webring', name: 'The Webring Well', template: 'collection', visibility: 'public', subtitle: 'little corners of the independent web', intro: 'Toss in a coin and visit somewhere handmade. These are personal sites, digital gardens and webrings I love.', settings: { style: 'tickets' } },
  { id: 'secret-garden', name: 'The Secret Garden', template: 'secret', visibility: 'unlisted', subtitle: 'you found it', intro: 'Hush. Only the curious find their way here. Look around — there are a few more treasures.' },
];

export const DEFAULT_OBJECTS: SceneObject[] = [
  // landmarks
  b({ id: 'b-welcome', art: 'cottage', label: 'Bowknot Cottage', roomId: 'welcome', x: 690, y: 600, w: 220, h: 210, z: 30 }),
  b({ id: 'b-library', art: 'library', label: 'The Pressed-Flower Library', roomId: 'library', x: 230, y: 280, w: 250, h: 240, z: 20 }),
  b({ id: 'b-journal', art: 'townhouse', label: 'Inkwell House', roomId: 'journal', x: 520, y: 150, w: 190, h: 220, z: 12 }),
  b({ id: 'b-gallery', art: 'loft', label: 'The Easel Loft', roomId: 'gallery', x: 940, y: 140, w: 200, h: 220, z: 12 }),
  b({ id: 'b-music', art: 'pavilion', label: 'The Gramophone Pavilion', roomId: 'music', x: 1200, y: 300, w: 210, h: 200, z: 20 }),
  b({ id: 'b-post', art: 'postoffice', label: 'Pearl Post Office', roomId: 'postoffice', x: 1130, y: 580, w: 220, h: 210, z: 30 }),
  b({ id: 'b-cafe', art: 'cafe', label: 'Café Meringue', roomId: 'cafe', x: 300, y: 590, w: 220, h: 200, z: 30 }),
  b({ id: 'b-garden', art: 'greenhouse', label: 'The Seedling Greenhouse', roomId: 'garden', x: 1360, y: 90, w: 200, h: 180, z: 10 }),
  b({ id: 'b-observatory', art: 'observatory', label: 'Starlace Observatory', roomId: 'observatory', x: 60, y: 40, w: 190, h: 230, z: 8 }),
  b({ id: 'b-well', art: 'well', label: 'The Webring Well', roomId: 'webring', x: 820, y: 360, w: 120, h: 130, z: 18 }),
  b({ id: 'b-boudoir', art: 'manor-door', label: 'The Private Wing', href: '/boudoir', x: 1420, y: 640, w: 150, h: 190, z: 26, ownerOnly: true }),
  b({ id: 'b-fountain', type: 'decor', art: 'fountain', label: 'Rose Fountain', x: 640, y: 400, w: 150, h: 130, z: 16, animation: 'none' }),

  // gardens & trees
  d({ id: 'd-tree-1', art: 'tree-round', x: 20, y: 300, w: 150, h: 180, z: 9, animation: 'sway' }),
  d({ id: 'd-tree-2', art: 'tree-blossom', x: 470, y: 380, w: 130, h: 160, z: 14, animation: 'sway' }),
  d({ id: 'd-tree-3', art: 'tree-round', x: 1080, y: 380, w: 120, h: 150, z: 14, animation: 'sway' }),
  d({ id: 'd-tree-4', art: 'tree-blossom', x: 1480, y: 300, w: 120, h: 160, z: 12, animation: 'sway' }),
  d({ id: 'd-tree-5', art: 'tree-cypress', x: 740, y: 120, w: 60, h: 170, z: 9, animation: 'sway' }),
  d({ id: 'd-tree-6', art: 'tree-cypress', x: 1160, y: 110, w: 60, h: 170, z: 9, animation: 'sway' }),
  d({ id: 'd-hedge', art: 'hedge-arch', label: 'an overgrown hedge', x: 40, y: 560, w: 200, h: 150, z: 22 }),
  d({ id: 'd-roses-1', art: 'rosebush', x: 600, y: 700, w: 90, h: 70, z: 34, animation: 'sway' }),
  d({ id: 'd-roses-2', art: 'rosebush', x: 920, y: 720, w: 90, h: 70, z: 34, animation: 'sway' }),
  d({ id: 'd-roses-3', art: 'rosebush', x: 250, y: 500, w: 80, h: 60, z: 24, animation: 'sway' }),
  d({ id: 'd-roses-4', art: 'rosebush', x: 1330, y: 500, w: 80, h: 60, z: 24, animation: 'sway' }),
  d({ id: 'd-lamp-1', art: 'lamppost', x: 610, y: 520, w: 34, h: 110, z: 28 }),
  d({ id: 'd-lamp-2', art: 'lamppost', x: 960, y: 520, w: 34, h: 110, z: 28 }),
  d({ id: 'd-bench', art: 'bench', x: 990, y: 470, w: 90, h: 55, z: 20 }),
  d({ id: 'd-gate', art: 'gate', label: 'the village gate', x: 735, y: 860, w: 130, h: 120, z: 40 }),
  d({ id: 'd-fence-1', art: 'fence', x: 560, y: 900, w: 180, h: 50, z: 39 }),
  d({ id: 'd-fence-2', art: 'fence', x: 860, y: 900, w: 180, h: 50, z: 39 }),
  d({ id: 'd-mush', art: 'mushrooms', x: 180, y: 480, w: 50, h: 40, z: 23 }),
  d({ id: 'd-mush-2', art: 'mushrooms', x: 1270, y: 800, w: 50, h: 40, z: 33 }),
  d({ id: 'd-sign', art: 'signpost', label: 'Signpost', x: 900, y: 790, w: 70, h: 90, z: 36 }),

  // creatures
  d({ id: 'd-bunny-1', art: 'bunny', label: 'a curious bunny', x: 175, y: 640, w: 46, h: 46, z: 25, animation: 'bob', secret: { roomId: 'secret-garden', stamp: 'bunny' } }),
  d({ id: 'd-bunny-2', art: 'bunny', x: 1010, y: 770, w: 40, h: 40, z: 36, animation: 'wander', flip: true, secret: { message: 'The bunny twitches its nose and leaves you a pressed violet.', stamp: 'violet' } }),
  d({ id: 'd-deer', art: 'deer', label: 'a shy deer', x: 1480, y: 450, w: 90, h: 100, z: 18, animation: 'bob', secret: { message: '"Some things only show themselves at dusk," the deer seems to say.', stamp: 'deer' } }),
  d({ id: 'd-swan', art: 'swan', x: 1300, y: 860, w: 60, h: 45, z: 38, animation: 'wander' }),
  d({ id: 'd-butterfly', art: 'butterfly', x: 560, y: 330, w: 30, h: 26, z: 50, animation: 'flutter' }),
  d({ id: 'd-bow', art: 'bow', x: 776, y: 862, w: 50, h: 34, z: 41, secret: { message: 'Tied in a double knot, for luck.', stamp: 'bow' } }),
  d({ id: 'd-chest', art: 'chest', x: 1540, y: 900, w: 50, h: 44, z: 40, secret: { message: '"I wanted to be the kind of person who keeps letters." — a quote I keep.', stamp: 'pearl' } }),
];

export const DEFAULT_WORLD: WorldConfig = {
  version: 1,
  name: 'Ribbonmere',
  tagline: 'a little village at the quiet end of the internet',
  scene: { width: 1600, height: 1000, ground: 'meadow' },
  objects: DEFAULT_OBJECTS,
  regions: [
    { id: 'orchard', name: 'The Misty Orchard', revealed: false, mystery: 'Something sweet is ripening under these clouds…', x: 0, y: 830, w: 250, h: 170 },
    { id: 'pier', name: 'The Moonlit Pier', revealed: false, mystery: 'You hear water lapping against old wood, somewhere past the mist.', x: 1260, y: 0, w: 340, h: 70 },
  ],
  rooms: DEFAULT_ROOMS,
  trash: [],
  introEnabled: true,
  introText: 'Untie the ribbon to enter',
  gardenStages: [
    { id: 'seedling', label: 'Seedling', emoji: '🌱' },
    { id: 'growing', label: 'Growing', emoji: '🌿' },
    { id: 'blooming', label: 'Blooming', emoji: '🌸' },
  ],
  dashboard: [
    { id: 'w-reads', type: 'current-reads', title: 'On my nightstand', size: 'medium' },
    { id: 'w-inbox', type: 'inbox', title: 'Unopened letters', size: 'medium' },
    { id: 'w-feeds', type: 'feeds', title: 'Fresh from my creators', size: 'large' },
    { id: 'w-later', type: 'watch-later', title: 'Watch later', size: 'medium', options: { collection: 'Watch Later' } },
    { id: 'w-journal', type: 'journal', title: 'Latest pages', size: 'small' },
    { id: 'w-favs', type: 'favorites', title: 'Cabinet favourites', size: 'small' },
    { id: 'w-todo', type: 'todo', title: 'Little to-dos', size: 'small' },
    { id: 'w-projects', type: 'projects', title: 'Growing projects', size: 'small' },
    { id: 'w-disc', type: 'discoveries', title: 'Recent discoveries', size: 'medium' },
    { id: 'w-exp', type: 'expeditions', title: 'Expeditions', size: 'small' },
  ],
  inbox: { cooldownHours: 24 },
  modes: {
    visitor: { title: 'Rosegarden Mode', subtitle: 'a softer internet · for brighter days', notes: ['A quieter place for curious hearts', 'Same soft people make a brighter world.', 'A softer internet for brighter days'] },
    private: { title: 'Dollhouse Mode', subtitle: 'a private corner online', notes: ['A softer space for my thoughts', 'Still here… just a softer me.', 'Pretty thoughts for later', 'A quieter day is a kinder day'] },
    stargirl: { title: 'Stargirl Mode', subtitle: 'a more curious internet', notes: ['Wander · explore · daydream · discover', 'Different skies, same girl', 'More beautiful places ahead'], theme: 'stargirl' },
  },
};
