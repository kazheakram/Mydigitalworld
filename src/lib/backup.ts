import { IS_FIREBASE } from './backend/config';
import { api } from './api';

// Backups work the same way on both versions of Ribbonmere and use one portable format
// ("ribbonmere-backup", version 1), so a world can move between them in either direction.

export interface Backup {
  format: 'ribbonmere-backup'; version: number; exportedAt: string;
  config: Record<'world' | 'theme', { draft: any; published: any; updatedAt?: string }>;
  items: any[]; feeds: any[]; savedEntries: any[]; media?: { file: string; base64: string }[];
}

export function saveFile(name: string, data: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export async function makeBackup(withMedia: boolean): Promise<Backup> {
  if (!IS_FIREBASE) {
    const res = await fetch(`/api/export${withMedia ? '?media=1' : ''}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Could not make the backup.');
    return res.json();
  }
  const { exportFirebase } = await import('./backend/firebaseBackup');
  return exportFirebase(withMedia);
}

export async function downloadBackup(withMedia: boolean, label = 'backup') {
  const b = await makeBackup(withMedia);
  saveFile(`ribbonmere-${label}-${stamp()}.json`, new Blob([JSON.stringify(b)], { type: 'application/json' }));
  return b;
}

export async function downloadOpml() {
  let text: string;
  if (IS_FIREBASE) text = await (await import('./backend/firebaseApi')).opmlText();
  else {
    const res = await fetch('/api/feeds/opml', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Could not export your subscriptions.');
    text = await res.text();
  }
  saveFile('ribbonmere-feeds.opml', new Blob([text], { type: 'text/x-opml' }));
}

export function readBackupFile(text: string): Backup {
  let b: any;
  try { b = JSON.parse(text); } catch { throw new Error('That file is not a Ribbonmere backup (it is not valid JSON).'); }
  if (b?.format !== 'ribbonmere-backup') throw new Error('That file is not a Ribbonmere backup.');
  return b;
}

export async function restoreBackup(b: Backup, mode: 'replace' | 'merge', onProgress: (msg: string) => void) {
  if (!IS_FIREBASE) {
    onProgress('Restoring…');
    await api('POST', `/api/import?mode=${mode}`, b);
    return { notes: [] as string[] };
  }
  const { importFirebase } = await import('./backend/firebaseBackup');
  return importFirebase(b, mode, onProgress);
}
