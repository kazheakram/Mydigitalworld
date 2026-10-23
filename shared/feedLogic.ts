// RSS/Atom parsing, feed discovery and link previews. Shared by the Node server and the browser
// (the Cloudflare version fetches through a tiny function and parses here, to stay within free CPU limits).
import { XMLParser } from 'fast-xml-parser';

export interface ParsedEntry { guid: string; title: string; link: string; published: string | null; summary: string; image: string | null }
export interface ParsedFeed { title: string; siteUrl: string | null; entries: ParsedEntry[] }

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true });

const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const txt = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in v) return String(v['#text']);
  return '';
};
export const stripHtml = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
const firstImg = (html: string) => html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
const isoDate = (s: string) => { const d = new Date(s); return isNaN(+d) ? null : d.toISOString(); };
const safeLink = (s: string) => (/^https?:\/\//i.test(s) ? s : '');

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);
  if (doc.rss || doc['rdf:RDF']) {
    const channel = doc.rss?.channel ?? doc['rdf:RDF']?.channel ?? {};
    const items = arr(doc.rss?.channel?.item ?? doc['rdf:RDF']?.item);
    return {
      title: stripHtml(txt(channel.title)) || 'Untitled feed',
      siteUrl: safeLink(txt(channel.link)) || null,
      entries: items.map((it: any) => {
        const html = txt(it['content:encoded']) || txt(it.description);
        const link = safeLink(txt(it.link) || txt(it.guid));
        const media = it['media:thumbnail']?.['@url'] || it['media:content']?.['@url'] || it.enclosure?.['@url'];
        return {
          guid: txt(it.guid) || link || txt(it.title),
          title: stripHtml(txt(it.title)) || '(untitled)',
          link,
          published: isoDate(txt(it.pubDate) || txt(it['dc:date'])),
          summary: stripHtml(html).slice(0, 400),
          image: (typeof media === 'string' && /^https?:/.test(media) && !/\.(mp3|m4a|ogg)(\?|$)/i.test(media) ? media : null) || firstImg(html),
        };
      }),
    };
  }
  if (doc.feed) {
    const f = doc.feed;
    const linkOf = (links: any) => {
      const list = arr(links);
      const alt = list.find((l: any) => !l['@rel'] || l['@rel'] === 'alternate') ?? list[0];
      return safeLink(alt?.['@href'] ?? '');
    };
    return {
      title: stripHtml(txt(f.title)) || 'Untitled feed',
      siteUrl: linkOf(f.link) || null,
      entries: arr(f.entry).map((e: any) => {
        const html = txt(e.content) || txt(e.summary) || txt(e['media:group']?.['media:description']);
        const thumb = e['media:group']?.['media:thumbnail']?.['@url'];
        const link = linkOf(e.link);
        return {
          guid: txt(e.id) || link,
          title: stripHtml(txt(e.title)) || '(untitled)',
          link,
          published: isoDate(txt(e.published) || txt(e.updated)),
          summary: stripHtml(html).slice(0, 400),
          image: thumb ?? firstImg(html),
        };
      }),
    };
  }
  throw new Error('This address is not an RSS or Atom feed.');
}

/** Turn a YouTube channel link into its public RSS feed URL, where possible without fetching. */
function youtubeFeedUrl(u: URL): string | null {
  if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
  const ch = u.pathname.match(/^\/channel\/(UC[\w-]{20,})/);
  if (ch) return `https://www.youtube.com/feeds/videos.xml?channel_id=${ch[1]}`;
  const list = u.searchParams.get('list');
  if (list) return `https://www.youtube.com/feeds/videos.xml?playlist_id=${list}`;
  return null;
}

/** Accepts a feed URL, a YouTube channel/playlist URL, or a normal web page that advertises its feed. */
export type TextFetcher = (url: string, accept: string) => Promise<{ text: string; finalUrl: string; contentType: string }>;

export async function discoverAndFetch(input: string, safeFetchText: TextFetcher): Promise<{ feedUrl: string; feed: ParsedFeed }> {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const yt = youtubeFeedUrl(new URL(url));
  if (yt) url = yt;
  const first = await safeFetchText(url, 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8');
  const looksXml = /xml|rss|atom/.test(first.contentType) || /^\s*<\?xml|<rss|<feed/i.test(first.text.slice(0, 500));
  if (looksXml) return { feedUrl: first.finalUrl, feed: parseFeed(first.text) };
  // An HTML page: look for <link rel="alternate" type="application/rss+xml" href="…">
  const linkTags = first.text.match(/<link[^>]+>/gi) ?? [];
  let found: string | null = null;
  for (const tag of linkTags) {
    if (/rel=["']?alternate/i.test(tag) && /type=["']?application\/(rss|atom)\+xml/i.test(tag)) {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) { found = new URL(href.replace(/&amp;/g, '&'), first.finalUrl).toString(); break; }
    }
  }
  if (!found) {
    const channelId = first.text.match(/"channelId":"(UC[\w-]{20,})"/)?.[1];
    if (channelId && /youtube\.com/.test(first.finalUrl)) found = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }
  if (!found) throw new Error('No RSS or Atom feed was found on that page. Try pasting the feed address directly.');
  const second = await safeFetchText(found, 'application/rss+xml, application/atom+xml, application/xml, text/xml');
  return { feedUrl: second.finalUrl, feed: parseFeed(second.text) };
}

/** Title, description and preview image for a bookmark, from <title> and Open Graph tags. */
export async function unfurl(input: string, safeFetchText: TextFetcher) {
  const { text, finalUrl, contentType } = await safeFetchText(input, 'text/html,application/xhtml+xml');
  if (!/html/.test(contentType) && !/<html/i.test(text.slice(0, 2000))) return { url: finalUrl, title: '', description: '', image: '' };
  const head = text.slice(0, 200_000);
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = head.match(re)?.[0];
    return tag ? stripHtml(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '') : '';
  };
  const title = meta('og:title') || stripHtml(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  let image = meta('og:image') || meta('twitter:image');
  if (image) { try { image = new URL(image, finalUrl).toString(); } catch { image = ''; } }
  return {
    url: finalUrl,
    title: title.slice(0, 300),
    description: (meta('og:description') || meta('description')).slice(0, 500),
    image: /^https?:/.test(image) ? image : '',
    siteName: meta('og:site_name'),
  };
}
