import { useEffect, useRef } from 'react';
import { featureMode } from '../../shared/features';
import { useStore } from './store';

// Automatic Book Tracker syncs: only for the owner, only while Ribbonmere is open and visible,
// at most every 15 minutes, and only after the first import was previewed and confirmed. There is
// no server-side timer, which keeps everything inside the free tiers.

const EVERY = 15 * 60_000;
const KEY = 'rm-tracker-last';

export function TrackerAutoSync() {
  const { owner, world, updateWorld } = useStore();
  const mode = featureMode(world, 'bookSync');
  const live = useRef({ world, updateWorld });
  live.current = { world, updateWorld };
  useEffect(() => {
    if (!owner || mode === 'off') return;
    const tick = async () => {
      if (document.hidden) return;
      let last = 0;
      try { last = Number(localStorage.getItem(KEY) ?? 0); } catch { /* storage blocked */ }
      if (Date.now() - last < EVERY) return;
      try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ }
      const { google, loadState, syncNow } = await import('./trackerSync');
      try {
        const s = await loadState();
        if (!s.firstImportAt || s.schedule !== 'auto' || !s.config) return;
        const st = await google.status();
        if (!st.connected || st.sheet?.id !== s.config.spreadsheetId) return;
        await syncNow(live.current.world, live.current.updateWorld);
      } catch { /* recorded in the Book Tracker's history; never interrupts the owner */ }
    };
    const first = setTimeout(tick, 20_000);
    const every = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [owner, mode]);
  return null;
}
