import { api, items as itemsApi } from '../lib/api';
import { isUrl, linkType } from '../lib/util';

export type InboxStatus = 'new' | 'keep' | 'later' | 'archived';
export interface InboxData {
  content: string; url?: string; title?: string; description?: string; image?: string; note?: string;
  type: string; tags: string[]; status: InboxStatus; availableAt?: string; remindAt?: string; source?: string;
}

/** Save anything to the Letterbox right away; fetch a title in the background afterwards. */
export async function quickSave(text: string, cooldownHours: number, extra: Partial<InboxData> = {}) {
  const raw = text.trim();
  const url = raw.match(/https?:\/\/\S+/)?.[0];
  const data: InboxData = {
    content: raw, url, type: url ? linkType(url) : raw.split(/\s+/).length > 12 ? 'note' : 'idea', tags: [], status: 'new',
    availableAt: cooldownHours > 0 ? new Date(Date.now() + cooldownHours * 3600_000).toISOString() : undefined,
    ...extra,
  };
  const saved = await itemsApi.create<InboxData>('inbox', data);
  if (url && !extra.title) {
    api('POST', '/api/unfurl', { url })
      .then((m) => m.title && itemsApi.update(saved.id, { data: { title: m.title, description: m.description, image: m.image } }))
      .catch(() => { /* no preview — fine, the link itself is saved */ });
  }
  return saved;
}

export const isResting = (d: InboxData) => d.status === 'new' && !!d.availableAt && Date.parse(d.availableAt) > Date.now();
export const reminderDue = (d: InboxData) => !!d.remindAt && Date.parse(d.remindAt) <= Date.now() && d.status !== 'archived';
export { isUrl };
