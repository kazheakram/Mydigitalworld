export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 9);
export const clone = <T,>(v: T): T => structuredClone(v);
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'room';

export function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
export const prettyDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
export const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Guess what a saved link is, for presentation (video → little TV, podcast → cassette…). */
export function linkType(url: string): 'video' | 'podcast' | 'pin' | 'article' | 'music' | 'website' {
  const h = hostOf(url);
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(h)) return 'video';
  if (/pinterest\./.test(h)) return 'pin';
  if (/spotify\.com|bandcamp\.com|soundcloud\.com|music\.apple/.test(h)) return 'music';
  if (/podcasts?\.|anchor\.fm|overcast|pocketcasts/.test(h + url)) return 'podcast';
  if (/substack\.com|medium\.com|\/(p|blog|posts?|articles?)\//.test(h + new URL(url).pathname)) return 'article';
  return 'website';
}

/** Safe embeds for music & video: only well-known players, always via their official embed URLs. */
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'youtube.com' || h === 'm.youtube.com') {
      const v = u.searchParams.get('v'); const list = u.searchParams.get('list');
      if (v) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}`;
      if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`;
    }
    if (h === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (h === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(intl-\w+\/)?(track|album|playlist|artist|episode|show)\/([\w]+)/);
      if (m) return `https://open.spotify.com/embed/${m[2]}/${m[3]}`;
    }
    if (h === 'soundcloud.com') return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23c98694`;
  } catch { /* not a url */ }
  return null;
}
