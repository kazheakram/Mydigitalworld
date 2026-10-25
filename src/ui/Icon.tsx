// A consistent set of fine-line icons, drawn for Ribbonmere (no icon font, no emoji).
const P: Record<string, string> = {
  home: 'M4 11 L12 4 L20 11 M6 10 V20 H18 V10 M10 20 V14 H14 V20',
  map: 'M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z M9 4 V18 M15 6 V20',
  book: 'M4 5 C7 4 10 4 12 6 C14 4 17 4 20 5 V19 C17 18 14 18 12 20 C10 18 7 18 4 19 Z M12 6 V20',
  quill: 'M20 4 C12 5 7 10 5 19 M20 4 C19 10 15 14 8 15 M5 19 L4 21',
  note: 'M6 3 H15 L19 7 V21 H6 Z M15 3 V7 H19 M9 11 H16 M9 15 H16',
  palette: 'M12 3 C6 3 3 7 3 11 C3 16 7 18 9 17 C11 16 10 14 12 14 C14 14 21 15 21 10 C21 6 17 3 12 3 Z M8 9 h.01 M12 7 h.01 M16 9 h.01',
  envelope: 'M3 6 H21 V18 H3 Z M3 6 L12 13 L21 6',
  cup: 'M5 9 H17 V13 C17 17 14 19 11 19 C8 19 5 17 5 13 Z M17 10 H19 C21 10 21 14 19 14 H17 M8 3 C7 5 9 5 8 7 M12 3 C11 5 13 5 12 7',
  star: 'M12 3 L14.6 9 L21 9.5 L16 13.6 L17.6 20 L12 16.6 L6.4 20 L8 13.6 L3 9.5 L9.4 9 Z',
  sprout: 'M12 21 V11 M12 13 C12 8 8 6 4 6 C4 10 7 13 12 13 M12 11 C12 7 15 4 20 4 C20 8 17 11 12 11',
  telescope: 'M4 14 L18 6 L20 10 L6 18 Z M11 15 L8 21 M12 15 L15 21',
  butterfly: 'M12 7 V19 M12 10 C9 4 3 4 4 9 C5 13 9 13 12 12 C15 13 19 13 20 9 C21 4 15 4 12 10 M12 13 C9 15 6 18 8 20 C10 21 11 17 12 15 C13 17 14 21 16 20 C18 18 15 15 12 13',
  heart: 'M12 20 C4 14 3 9 6 6 C8 4 11 5 12 8 C13 5 16 4 18 6 C21 9 20 14 12 20 Z',
  bookmark: 'M7 3 H17 V21 L12 17 L7 21 Z',
  dress: 'M9 3 L12 6 L15 3 M9 3 C9 6 10 8 10 9 L6 21 H18 L14 9 C14 8 15 6 15 3',
  gear: 'M12 9 A3 3 0 1 0 12.01 9 M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M19 5 L17 7 M7 17 L5 19',
  search: 'M10.5 4 A6.5 6.5 0 1 0 10.51 4 M15 15 L21 21',
  music: 'M9 18 V6 L20 4 V16 M9 18 A3 3 0 1 1 6 15 A3 3 0 0 1 9 18 M20 16 A3 3 0 1 1 17 13 A3 3 0 0 1 20 16',
  well: 'M5 11 H19 V19 H5 Z M7 11 V6 M17 11 V6 M4 7 L12 3 L20 7',
  key: 'M8 14 A4 4 0 1 1 8.01 14 M11 12 L21 12 M18 12 V15 M15 12 V14',
  inbox: 'M3 13 L6 5 H18 L21 13 V19 H3 Z M3 13 H8 L10 16 H14 L16 13 H21',
  rss: 'M5 19 h.01 M5 12 A7 7 0 0 1 12 19 M5 5 A14 14 0 0 1 19 19',
  compass: 'M12 3 A9 9 0 1 0 12.01 3 M15 9 L13 13 L9 15 L11 11 Z',
  plus: 'M12 5 V19 M5 12 H19',
  lock: 'M6 11 H18 V20 H6 Z M8 11 V8 A4 4 0 0 1 16 8 V11',
  sparkle: 'M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z',
  moon: 'M15 3 A9 9 0 1 0 21 15 A7 7 0 1 1 15 3 Z',
  door: 'M6 21 V5 C6 3 18 3 18 5 V21 M4 21 H20 M14 13 h.01',
};
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] ?? P.heart} />
    </svg>
  );
}
export const TEMPLATE_ICON: Record<string, string> = {
  welcome: 'home', library: 'book', journal: 'quill', gallery: 'palette', music: 'music', postoffice: 'envelope',
  cafe: 'cup', garden: 'sprout', observatory: 'telescope', secret: 'butterfly', collection: 'well', freeform: 'sparkle', commonplace: 'quill', cinema: 'sparkle', recordstore: 'music', bookstore: 'book', museum: 'palette', region: 'sprout',
};
