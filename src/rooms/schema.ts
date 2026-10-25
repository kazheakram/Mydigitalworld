import type { ItemKind, Visibility } from '../../shared/types';

// Field definitions for each kind of content. The generic editor builds its form from these,
// so adding a field to a kind is one line here — no new screens needed.

export type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'image' | 'select' | 'tags' | 'color' | 'stars' | 'date' | 'lines' | 'check';
export interface FieldDef { key: string; label: string; type: FieldType; options?: string[] | ((ctx: any) => string[]); hint?: string; placeholder?: string; required?: boolean }

export interface KindDef { label: string; noun: string; fields: FieldDef[]; defaultVisibility: Visibility; titleKey: string }

export const KINDS: Partial<Record<ItemKind, KindDef>> = {
  book: {
    label: 'Book', noun: 'book', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'shelf', label: 'Shelf', type: 'select', options: (ctx) => ctx.shelves ?? ['Currently Reading', 'Read', 'Want to Read'] },
      { key: 'cover', label: 'Cover image', type: 'image', hint: 'Optional — without one, the book gets a cloth cover in the colour below.' },
      { key: 'color', label: 'Cloth cover colour', type: 'color' },
      { key: 'rating', label: 'Hearts', type: 'stars' },
      { key: 'spice', label: 'Spice', type: 'stars', hint: 'Optional, for romance readers. Only shown when set.' },
      { key: 'favorite', label: 'A favourite', type: 'check' },
      { key: 'pagesRead', label: 'Pages read', type: 'number' },
      { key: 'pages', label: 'Total pages', type: 'number' },
      { key: 'audioListened', label: 'Listened so far (audiobooks)', type: 'text', placeholder: '4:10:00' },
      { key: 'audioLength', label: 'Total length (audiobooks)', type: 'text', placeholder: '11:27:00' },
      { key: 'startedOn', label: 'Started on', type: 'date' },
      { key: 'finishedOn', label: 'Finished on', type: 'date' },
      { key: 'genre', label: 'Genre', type: 'text', placeholder: 'literary fiction, poetry, gothic…' },
      { key: 'series', label: 'Series', type: 'text', hint: 'Books with the same series name are gathered together in the Reading Journal.' },
      { key: 'seriesNumber', label: 'Number in the series', type: 'number' },
      { key: 'seriesTotal', label: 'Books in the series', type: 'number' },
      { key: 'format', label: 'Format', type: 'select', options: ['Paper', 'E-book', 'Audiobook'] },
      { key: 'review', label: 'Review', type: 'textarea', placeholder: 'What did it make you feel?' },
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'favoriteMoment', label: 'Favourite moment', type: 'textarea' },
      { key: 'favoriteCharacter', label: 'Favourite character', type: 'text' },
      { key: 'quotes', label: 'Favourite quotes', type: 'lines', hint: 'One quote per line.' },
      { key: 'annotations', label: 'Margin notes', type: 'textarea', hint: 'Thoughts while reading. Shown with the book in your Reading Journal.' },
      { key: 'recommendedBy', label: 'Recommended by', type: 'text' },
      { key: 'price', label: 'Price', type: 'text' },
      { key: 'link', label: 'Link (shop, library, Goodreads…)', type: 'url' },
      { key: 'recommendation', label: 'Bookshop note (handwritten card)', type: 'textarea', hint: 'Bookshop: a little recommendation card shown on the display.' },
      { key: 'wishlist', label: 'On my wishlist', type: 'check' },
      { key: 'secretMessage', label: 'Secret message tucked inside', type: 'textarea', hint: 'Visitors find it by opening the book and clicking the pressed flower.' },
      { key: 'privateNotes', label: 'Private notes', type: 'textarea', hint: 'Never shown to visitors, even when the book is public.' },
    ],
  },
  entry: {
    label: 'Journal page', noun: 'page', titleKey: 'title', defaultVisibility: 'private',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind of writing', type: 'select', options: ['Diary', 'Essay', 'Creative writing', 'Reflection', 'Letter'] },
      { key: 'mood', label: 'Mood', type: 'text', placeholder: 'wistful, sunlit, rainy…' },
      { key: 'body', label: 'Writing', type: 'textarea', hint: 'Blank lines make paragraphs. **bold**, *italic*, > quotes and [links](https://…) work.' },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'archived', label: 'Archived (tucked away in the drawer)', type: 'check' },
    ],
  },
  artwork: {
    label: 'Artwork', noun: 'artwork', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Painting, collage, sketch…' },
      { key: 'medium', label: 'Medium', type: 'text' },
      { key: 'date', label: 'Made on', type: 'date' },
      { key: 'description', label: 'About this piece', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['Finished', 'In progress', 'Idea'] },
    ],
  },
  music: {
    label: 'Record', noun: 'record', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'artist', label: 'Artist', type: 'text' },
      { key: 'type', label: 'Type', type: 'select', options: ['Album', 'Song', 'Playlist', 'Artist'] },
      { key: 'link', label: 'Link', type: 'url', hint: 'YouTube, Spotify and SoundCloud links show a player. Anything else becomes a button.' },
      { key: 'color', label: 'Sleeve colour', type: 'color' },
      { key: 'cover', label: 'Sleeve image', type: 'image' },
      { key: 'note', label: 'Why I love it', type: 'textarea' },
      { key: 'crate', label: 'Crate or shelf', type: 'select', options: (ctx) => ctx.crates ?? [], hint: 'Record Shop: which crate it lives in.' },
      { key: 'format', label: 'Format', type: 'select', options: ['Vinyl', 'CD', 'Cassette', 'Digital'] },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'rating', label: 'Hearts', type: 'stars' },
      { key: 'review', label: 'Review', type: 'textarea' },
    ],
  },
  note: {
    label: 'Garden note', noun: 'note', titleKey: 'title', defaultVisibility: 'private',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'stage', label: 'Stage', type: 'select', options: (ctx) => ctx.stages ?? ['seedling', 'growing', 'blooming'] },
      { key: 'body', label: 'Note', type: 'textarea', hint: 'Link to another note with [[Its Title]].' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
  },
  drink: {
    label: 'Drink', noun: 'drink', titleKey: 'name', defaultVisibility: 'public',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'color', label: 'Colour', type: 'color' },
      { key: 'pairing', label: 'Pairs with… (recommendation)', type: 'textarea' },
      { key: 'link', label: 'Recommendation link', type: 'url' },
    ],
  },
  star: {
    label: 'Star', noun: 'star', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'category', label: 'Kind', type: 'select', options: ['Dream', 'Curiosity', 'Plan', 'Discovery'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['Someday', 'Working on it', 'Came true'] },
      { key: 'link', label: 'Link', type: 'url' },
    ],
  },
  secret: {
    label: 'Secret', noun: 'secret', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'title', label: 'Where it hides', type: 'text', required: true },
      { key: 'message', label: 'The secret', type: 'textarea' },
      { key: 'link', label: 'Optional link', type: 'url' },
    ],
  },
  link: {
    label: 'Link', noun: 'link', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'url', label: 'Address', type: 'url', required: true },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'image', label: 'Preview image', type: 'image' },
    ],
  },
  bookmark: {
    label: 'Bookmark', noun: 'bookmark', titleKey: 'title', defaultVisibility: 'private',
    fields: [
      { key: 'url', label: 'Address', type: 'url', required: true },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'collection', label: 'Collection', type: 'select', options: (ctx) => ctx.collections ?? [] },
      { key: 'label', label: 'Little label', type: 'text', placeholder: 'favourite, to revisit, research…' },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'description', label: 'Notes', type: 'textarea' },
      { key: 'image', label: 'Preview image', type: 'image' },
      { key: 'favorite', label: 'Favourite ♥', type: 'check' },
    ],
  },
  film: {
    label: 'Film', noun: 'film', titleKey: 'title', defaultVisibility: 'public',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'director', label: 'Director', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Watchlist', 'Watched', 'Favourite'] },
      { key: 'poster', label: 'Poster', type: 'image', hint: 'Without one, the film gets a painted poster in the colour below.' },
      { key: 'color', label: 'Poster colour', type: 'color' },
      { key: 'rating', label: 'Hearts', type: 'stars' },
      { key: 'watchedOn', label: 'Watched on', type: 'date' },
      { key: 'collection', label: 'Collection', type: 'select', options: (ctx) => ctx.collections ?? [], placeholder: 'Rainy-day films, Hepburn…' },
      { key: 'tags', label: 'Genres & moods', type: 'tags' },
      { key: 'review', label: 'Review', type: 'textarea' },
      { key: 'link', label: 'Link (where to find it legally, a trailer…)', type: 'url' },
    ],
  },
  memory: {
    label: 'Memory', noun: 'memory', titleKey: 'title', defaultVisibility: 'private',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'date', label: 'When', type: 'date' },
      { key: 'image', label: 'Photograph or keepsake', type: 'image' },
      { key: 'exhibition', label: 'Exhibition', type: 'select', options: (ctx) => ctx.exhibitions ?? [], hint: 'Memories with the same exhibition hang together.' },
      { key: 'place', label: 'Where', type: 'text' },
      { key: 'people', label: 'With', type: 'tags' },
      { key: 'description', label: 'The story', type: 'textarea' },
    ],
  },
  excerpt: {
    label: 'Commonplace entry', noun: 'entry', titleKey: 'text', defaultVisibility: 'private',
    fields: [
      { key: 'text', label: 'The words', type: 'textarea', required: true, placeholder: 'A line you want to keep…' },
      { key: 'type', label: 'Kind', type: 'select', options: ['Quote', 'Excerpt', 'Passage', 'Reflection', 'Idea'] },
      { key: 'source', label: 'From (book, article, film…)', type: 'text' },
      { key: 'author', label: 'By', type: 'text' },
      { key: 'page', label: 'Page or chapter', type: 'text' },
      { key: 'url', label: 'Link to the source', type: 'url' },
      { key: 'linked', label: 'Linked to one of my things', type: 'select', options: (ctx) => ctx.linkables ?? [], hint: 'A book, journal page or note in your village.' },
      { key: 'reflection', label: 'My reflection', type: 'textarea', placeholder: 'Why it stayed with me…' },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'favorite', label: 'Favourite ♥', type: 'check' },
    ],
  },
};

export function titleOf(kind: ItemKind, data: any): string {
  const k = KINDS[kind]?.titleKey ?? 'title';
  return data?.[k] || data?.title || data?.name || data?.text || data?.content || data?.url || 'Untitled';
}
