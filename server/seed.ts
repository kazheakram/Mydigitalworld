import type { Visibility, ItemKind } from '../shared/types';

// A handful of starter items so the village doesn't open empty. All of them can be edited or deleted.
// The Webring Well links are real, long-running independent-web projects.

export const SEED_ITEMS: { kind: ItemKind; roomId: string | null; visibility: Visibility; data: any }[] = [
  { kind: 'drink', roomId: 'cafe', visibility: 'public', data: { name: 'Rosewater Latte', description: 'Steamed milk, a whisper of rose, a pearl of honey.', color: '#f2c1cc', pairing: 'Something slow and romantic — a long novel with letters in it.' } },
  { kind: 'drink', roomId: 'cafe', visibility: 'public', data: { name: 'Earl Grey Fog', description: 'Bergamot, vanilla and the feeling of a rainy window.', color: '#c9b6a6', pairing: 'A melancholy album on vinyl and a blanket.' } },
  { kind: 'drink', roomId: 'cafe', visibility: 'public', data: { name: 'Strawberry Milk', description: 'Pink, sweet, unapologetic.', color: '#f7a8b8', pairing: 'Something nostalgic: an old cartoon or a childhood favourite book.' } },
  { kind: 'drink', roomId: 'cafe', visibility: 'public', data: { name: 'Midnight Cocoa', description: 'Dark chocolate with a single star of cream.', color: '#6b4a4f', pairing: 'A ghost story read aloud, ideally after dark.' } },

  { kind: 'link', roomId: 'webring', visibility: 'public', data: { title: 'Neocities', url: 'https://neocities.org/browse', description: 'Free hosting for handmade personal websites — browse thousands of them.', category: 'Directories' } },
  { kind: 'link', roomId: 'webring', visibility: 'public', data: { title: 'IndieWeb', url: 'https://indieweb.org', description: 'A community about owning your own corner of the web.', category: 'Communities' } },
  { kind: 'link', roomId: 'webring', visibility: 'public', data: { title: 'Marginalia Search', url: 'https://search.marginalia.nu', description: 'A search engine that favours small, text-heavy, non-commercial sites.', category: 'Discovery' } },
  { kind: 'link', roomId: 'webring', visibility: 'public', data: { title: 'Wiby', url: 'https://wiby.me', description: 'A search engine for old-fashioned, lightweight web pages. Try “surprise me”.', category: 'Discovery' } },
  { kind: 'link', roomId: 'webring', visibility: 'public', data: { title: 'Kagi Small Web', url: 'https://kagi.com/smallweb', description: 'A random walk through recent posts from personal blogs.', category: 'Discovery' } },
  { kind: 'link', roomId: 'webring', visibility: 'public', data: { title: '32-Bit Cafe', url: 'https://32bit.cafe', description: 'A community of personal-website makers, with events and a webring.', category: 'Webrings' } },

  { kind: 'secret', roomId: 'secret-garden', visibility: 'public', data: { title: 'A note tucked under a stone', message: 'If you are reading this, you are the kind of person who looks under stones. Thank you for that.' } },
  { kind: 'secret', roomId: 'secret-garden', visibility: 'public', data: { title: 'A ribbon on the sundial', message: 'Make a wish. It is free here.' } },

  { kind: 'note', roomId: 'garden', visibility: 'public', data: { title: 'How this garden works', stage: 'blooming', tags: ['meta'], body: 'Notes here grow over time. A **Seedling** is a fresh idea, a **Growing** note is being tended, and a **Blooming** note is mostly finished.\n\nNotes can link to each other by putting a title in double brackets, like [[On keeping a commonplace book]].' } },
  { kind: 'note', roomId: 'garden', visibility: 'public', data: { title: 'On keeping a commonplace book', stage: 'seedling', tags: ['reading', 'writing'], body: 'A commonplace book is a notebook of quotes, scraps and thoughts copied from what you read. This greenhouse is a bit like one.\n\nSee also: [[How this garden works]]' } },

  { kind: 'todo', roomId: null, visibility: 'private', data: { text: 'Sign in and visit the Atelier to make this village mine', done: false } },
  { kind: 'todo', roomId: null, visibility: 'private', data: { text: 'Add the first book to the library', done: false } },
];
