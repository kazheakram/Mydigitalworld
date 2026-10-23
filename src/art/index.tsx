import type { ReactNode } from 'react';
import * as B from './buildings';
import * as D from './decor';
import type { ArtColors } from './palette';

// The artwork registry. A building or decoration on any scene refers to one of these keys,
// so swapping artwork (or adding new pieces) never requires changing the scenes themselves.

export interface ArtDef {
  label: string;
  category: 'Buildings' | 'Trees & Plants' | 'Creatures' | 'Garden & Outdoor' | 'Bows & Trinkets' | 'Furniture' | 'Stationery' | 'Sky';
  viewBox: string;
  render: (c?: ArtColors) => ReactNode;
  /** Colour slots the Atelier offers for this piece. */
  slots?: string[];
}

const bld = (label: string, C: (p: { c?: ArtColors }) => any): ArtDef => ({ label, category: 'Buildings', viewBox: '0 0 200 200', render: (c) => <C c={c} />, slots: ['roof', 'wall', 'trim', 'accent', 'window'] });
const dec = (label: string, category: ArtDef['category'], C: (p: { c?: ArtColors }) => any, slots?: string[]): ArtDef => ({ label, category, viewBox: '0 0 100 100', render: (c) => <C c={c} />, slots });

export const ART: Record<string, ArtDef> = {
  cottage: bld('Ribbon cottage', B.Cottage),
  library: bld('Columned library', B.Library),
  townhouse: bld('Tall townhouse', B.Townhouse),
  loft: bld('Studio loft', B.Loft),
  pavilion: bld('Music pavilion', B.Pavilion),
  postoffice: bld('Post office', B.PostOffice),
  cafe: bld('Café', B.Cafe),
  greenhouse: bld('Glass greenhouse', B.Greenhouse),
  observatory: bld('Observatory', B.Observatory),
  well: bld('Wishing well', B.Well),
  'manor-door': bld('Ribbon-curtained door', B.ManorDoor),
  fountain: { ...bld('Rose fountain', B.Fountain), category: 'Garden & Outdoor', slots: [] },
  'tree-round': dec('Round tree', 'Trees & Plants', D.TreeRound, ['leaf']),
  'tree-blossom': dec('Blossom tree', 'Trees & Plants', D.TreeBlossom, ['blossom']),
  'tree-cypress': dec('Cypress', 'Trees & Plants', D.TreeCypress, ['leaf']),
  rosebush: dec('Rose bush', 'Trees & Plants', D.RoseBush, ['rose']),
  'hedge-arch': dec('Hedge arch', 'Trees & Plants', D.HedgeArch),
  flowerpot: dec('Flower pot', 'Trees & Plants', D.Flowerpot),
  mushrooms: dec('Toadstools', 'Garden & Outdoor', D.Mushrooms),
  lamppost: dec('Lamp post', 'Garden & Outdoor', D.Lamppost),
  bench: dec('Garden bench', 'Garden & Outdoor', D.Bench),
  gate: dec('Iron gate', 'Garden & Outdoor', D.Gate),
  fence: { ...dec('Picket fence', 'Garden & Outdoor', D.Fence), viewBox: '0 0 200 60' },
  signpost: dec('Signpost', 'Garden & Outdoor', D.Signpost),
  chest: dec('Treasure chest', 'Garden & Outdoor', D.Chest),
  bunny: dec('Bunny', 'Creatures', D.Bunny, ['fur']),
  deer: dec('Little deer', 'Creatures', D.Deer),
  swan: dec('Swan', 'Creatures', D.Swan),
  butterfly: dec('Butterfly', 'Creatures', D.Butterfly),
  bow: dec('Satin bow', 'Bows & Trinkets', D.BowDecor, ['ribbon']),
  pearls: dec('Pearl strand', 'Bows & Trinkets', D.Pearls),
  heart: dec('Heart', 'Bows & Trinkets', D.Heart),
  garland: dec('Bunting garland', 'Bows & Trinkets', D.Garland),
  mirror: dec('Gilded mirror', 'Bows & Trinkets', D.Mirror),
  candle: dec('Candle', 'Bows & Trinkets', D.Candle),
  teacup: dec('Teacup', 'Furniture', D.Teacup),
  books: dec('Stack of books', 'Furniture', D.BookStack),
  bookshelf: dec('Bookshelf', 'Furniture', D.Bookshelf),
  armchair: dec('Bow armchair', 'Furniture', D.Armchair),
  rug: dec('Oval rug', 'Furniture', D.Rug),
  telescope: dec('Telescope', 'Furniture', D.Telescope),
  letter: dec('Sealed letter', 'Stationery', D.Letter),
  stamp: dec('Rose stamp', 'Stationery', D.Stamp),
  star: dec('Star', 'Sky', D.Star),
  moon: dec('Crescent moon', 'Sky', D.Moon),
  cloud: dec('Cloud', 'Sky', D.Cloud),
};

export function ArtSvg({ art, colors, className, title }: { art: string; colors?: ArtColors; className?: string; title?: string }) {
  const def = ART[art] ?? ART.heart;
  return (
    <svg viewBox={def.viewBox} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} overflow="visible">
      {def.render(colors)}
    </svg>
  );
}
