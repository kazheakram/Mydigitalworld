import { useSync } from '../lib/backend/sync';
import { IS_FIREBASE } from '../lib/backend/config';

/** Tells the owner, in plain words, whether their changes have reached the cloud. */
export function SyncBadge() {
  const s = useSync();
  if (!IS_FIREBASE) return null;
  let cls = 'ok'; let text = '☁ synced'; let title = s.lastSynced ? `Everything is saved to the cloud (last sync ${new Date(s.lastSynced).toLocaleTimeString()}).` : 'Everything is saved to the cloud.';
  if (!s.online) { cls = 'offline'; text = s.pending ? `☁ offline · ${s.pending} waiting` : '☁ offline'; title = "You're offline. Changes are kept on this device and will sync automatically when you're back online."; }
  else if (s.pending) { cls = 'saving'; text = '☁ saving…'; title = 'Sending your changes to the cloud…'; }
  else if (s.error) { cls = 'error'; text = '⚠ not synced'; title = s.error; }
  return <span className={`sync-badge sync-${cls}`} role="status" aria-live="polite" title={title}>{text}{cls === 'error' && <span className="sr-only">: {s.error}</span>}</span>;
}
