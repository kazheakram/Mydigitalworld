import { ITEM_KINDS, type Item, type ItemKind, type Visibility, type WorldConfig } from './types';
import { featureForTemplate, featureMode, publicFeatures } from './features';

// Rules shared by every backend (the Node server and the Firebase/Cloudflare version),
// so privacy filtering and validation behave identically everywhere.

export const VISIBILITIES: Visibility[] = ['private', 'public', 'unlisted'];
/** Where uploaded images live: /uploads/… (Node server) or /media/… (Cloudflare). */
export const MEDIA_URL_RE = /^(https?:\/\/|\/uploads\/|\/media\/)/i;

/** What visitors receive: no private rooms, no owner-only or hidden objects, nothing from unrevealed regions. */
export function publicWorld(w: WorldConfig): WorldConfig {
  // Rooms belonging to a switched-off feature rest quietly, as if they weren't there.
  const resting = (t: string) => { const f = featureForTemplate(t); return !!f && featureMode(w, f.id) === 'off'; };
  const rooms = w.rooms.filter((r) => r.visibility !== 'private' && !resting(r.template));
  const roomIds = new Set(rooms.map((r) => r.id));
  const hiddenRegions = new Set(w.regions.filter((r) => !r.revealed).map((r) => r.id));
  const objects = w.objects.filter((o) => !o.ownerOnly && !o.hidden && !(o.regionId && hiddenRegions.has(o.regionId)) && (!o.roomId || roomIds.has(o.roomId)) && !(o.feature && featureMode(w, o.feature) === 'off'));
  return {
    ...w,
    objects,
    rooms: rooms.map((r) => ({ ...r, scene: r.scene?.filter((o) => !o.hidden && !o.ownerOnly) })),
    regions: w.regions.map((r) => (r.revealed ? r : { ...r, name: r.name })),
    trash: [], dashboard: [], inbox: { cooldownHours: 0 },
    features: publicFeatures(w.features),
  };
}
export const publicTheme = (t: any) => ({ active: t.active, custom: [] });

/** Fields that belong to the owner only, even on a public item. */
export const PRIVATE_FIELDS = ['privateNotes'] as const;
export function splitPrivate(data: Record<string, any>) {
  const pub: Record<string, any> = { ...data };
  const priv: Record<string, any> = {};
  for (const k of PRIVATE_FIELDS) if (k in pub) { if (pub[k] !== undefined && pub[k] !== '') priv[k] = pub[k]; delete pub[k]; }
  return { pub, priv };
}
export function stripPrivateFields(it: Item): Item {
  return { ...it, data: splitPrivate(it.data).pub };
}

export function validateItem(kind: any, visibility: any, data: any, roomId: any): string | null {
  if (!ITEM_KINDS.includes(kind as ItemKind)) return 'Unknown kind of item.';
  if (!VISIBILITIES.includes(visibility)) return 'Visibility must be private, public or unlisted.';
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return 'Item data must be an object.';
  if (JSON.stringify(data).length > 400_000) return 'That item is too large.';
  if (roomId !== null && (typeof roomId !== 'string' || roomId.length > 80)) return 'Invalid room.';
  for (const key of ['url', 'link', 'href', 'image', 'cover']) {
    const v = data[key];
    if (v && typeof v === 'string' && !/^(https?:\/\/|\/uploads\/|\/media\/|mailto:)/i.test(v)) return `The ${key} must start with http:// or https://.`;
  }
  return null;
}

export function validateWorld(w: any): string | null {
  if (!w || typeof w !== 'object') return 'World data is missing.';
  if (!Array.isArray(w.objects) || !Array.isArray(w.rooms) || !Array.isArray(w.regions)) return 'World data is incomplete.';
  if (w.objects.length > 2000) return 'That is a lot of objects! Please keep it under 2000.';
  const ids = new Set<string>();
  for (const r of w.rooms) {
    if (typeof r.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(r.id)) return `Room id "${r.id}" should use lowercase letters, numbers and dashes.`;
    if (ids.has(r.id)) return `Two rooms share the id "${r.id}".`;
    ids.add(r.id);
  }
  for (const o of [...w.objects, ...w.rooms.flatMap((r: any) => r.scene ?? [])]) {
    if (['x', 'y', 'w', 'h', 'z'].some((k) => typeof o[k] !== 'number' || !isFinite(o[k]))) return 'An object has an invalid position or size.';
    if (o.href && !/^(https?:\/\/|\/|mailto:)/.test(o.href)) return 'Object links must start with https://, mailto: or /.';
    if (o.src && !MEDIA_URL_RE.test(o.src)) return 'Images must be uploads or https links.';
  }
  return null;
}
export function validateTheme(t: any): string | null {
  if (!t?.active?.colors || !t?.active?.fonts) return 'Theme data is incomplete.';
  for (const v of Object.values(t.active.colors)) if (typeof v !== 'string' || !/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v)) return `"${v}" is not a colour.`;
  for (const v of Object.values(t.active.fonts)) if (typeof v !== 'string' || !/^[\w \-']{1,60}$/.test(v)) return 'Font names may only contain letters, numbers and spaces.';
  return null;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
/** Identify an image by its first bytes (never trust the file name). */
export function sniffImage(b: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | 'svg' | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (ascii(b, 0, 4) === 'GIF8') return 'gif';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  const head = new TextDecoder().decode(b.subarray(0, 1000)).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg';
  return null;
}
export function isSafeSvg(s: string): boolean {
  return !/<script|<foreignObject|\son\w+\s*=|javascript:|<iframe|<embed|<object|xlink:href\s*=\s*["']\s*(?!#|data:image)|href\s*=\s*["']\s*(?!#|data:image)/i.test(s);
}
export const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
