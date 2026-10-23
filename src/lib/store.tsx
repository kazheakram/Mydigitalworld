import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ThemeState, WorldConfig } from '../../shared/types';
import { DEFAULT_WORLD } from '../../shared/defaultWorld';
import { COQUETTE } from '../../shared/themes';
import { api, setPreviewAsPublic } from './api';
import { applyTheme } from './theme';

// App-wide state: who is looking (owner or visitor), the world map/rooms config and the theme.
// The owner always sees the *draft*; visitors only ever receive the published, filtered copy.

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Store {
  ready: boolean;
  owner: boolean;
  needsSetup: boolean;
  preview: boolean;
  setPreview: (v: boolean) => void;
  world: WorldConfig;
  theme: ThemeState;
  worldUnpublished: boolean;
  themeUnpublished: boolean;
  saveState: SaveState;
  saveError: string | null;
  /** Replace the world draft and persist it. */
  saveWorld: (w: WorldConfig) => Promise<void>;
  updateWorld: (fn: (w: WorldConfig) => WorldConfig) => Promise<void>;
  saveTheme: (t: ThemeState) => Promise<void>;
  /** Show a theme instantly without saving (live preview while editing). */
  previewTheme: (t: ThemeState | null) => void;
  publish: (key: 'world' | 'theme') => Promise<void>;
  discard: (key: 'world' | 'theme') => Promise<void>;
  refresh: () => Promise<void>;
  motionOff: boolean;
  setMotionOff: (v: boolean) => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  toast: (msg: string) => void;
  toasts: { id: number; msg: string }[];
  offline: boolean;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
};

const readPref = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const writePref = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* storage unavailable */ } };

/** Older saved worlds may predate newer fields; fill them from the defaults. */
function normaliseWorld(w: Partial<WorldConfig>): WorldConfig {
  return { ...DEFAULT_WORLD, ...w, modes: { ...DEFAULT_WORLD.modes, ...(w.modes ?? {}) }, inbox: { ...DEFAULT_WORLD.inbox, ...(w.inbox ?? {}) } } as WorldConfig;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState({ owner: false, needsSetup: false });
  const [preview, setPreviewState] = useState(false);
  const [world, setWorld] = useState<WorldConfig>(DEFAULT_WORLD);
  const [theme, setTheme] = useState<ThemeState>({ active: COQUETTE, custom: [] });
  const [themePreview, setThemePreview] = useState<ThemeState | null>(null);
  const [unpub, setUnpub] = useState({ world: false, theme: false });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [motionOff, setMotionOffState] = useState(() => readPref('rm-motion-off', window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false));
  const [soundOn, setSoundOnState] = useState(() => readPref('rm-sound', false));
  const [offline, setOffline] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const worldRef = useRef(world);
  worldRef.current = world;

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const status = await api<{ owner: boolean; needsSetup: boolean }>('GET', '/api/auth/status');
      setAuth(status);
      const [w, t] = await Promise.all([api('GET', '/api/config/world'), api('GET', '/api/config/theme')]);
      const ownerView = status.owner && !!w.draft;
      setWorld(normaliseWorld(ownerView ? w.draft : w.published));
      setTheme(ownerView ? t.draft : t.published);
      setUnpub({ world: !!w.hasUnpublished, theme: !!t.hasUnpublished });
    } catch (e: any) {
      setSaveError(e.message);
      setOffline(true);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { applyTheme((themePreview ?? theme).active, motionOff); }, [theme, themePreview, motionOff]);

  const persist = useCallback(async (key: 'world' | 'theme', body: unknown) => {
    setSaveState('saving'); setSaveError(null);
    try {
      await api('PUT', `/api/config/${key}/draft`, body);
      setSaveState('saved');
      setUnpub((u) => ({ ...u, [key]: true }));
    } catch (e: any) {
      setSaveState('error'); setSaveError(e.message); toast(`Not saved: ${e.message}`);
      throw e;
    }
  }, [toast]);

  const saveWorld = useCallback(async (w: WorldConfig) => { setWorld(w); await persist('world', w); }, [persist]);
  const updateWorld = useCallback(async (fn: (w: WorldConfig) => WorldConfig) => saveWorld(fn(worldRef.current)), [saveWorld]);
  const saveTheme = useCallback(async (t: ThemeState) => { setTheme(t); setThemePreview(null); await persist('theme', t); }, [persist]);

  const publish = useCallback(async (key: 'world' | 'theme') => {
    await api('POST', `/api/config/${key}/publish`, { label: `Before publishing ${new Date().toLocaleString()}` });
    setUnpub((u) => ({ ...u, [key]: false }));
    toast(key === 'world' ? 'Your village is published ♡ visitors can see the changes now.' : 'Your theme is published ♡');
  }, [toast]);
  const discard = useCallback(async (key: 'world' | 'theme') => {
    await api('POST', `/api/config/${key}/discard`);
    await refresh();
    toast('Unpublished changes were set aside. You are back to the published version.');
  }, [refresh, toast]);

  const setPreview = useCallback((v: boolean) => {
    setPreviewAsPublic(v); setPreviewState(v);
    // Re-fetch exactly what an anonymous visitor would receive.
    (async () => {
      if (v) {
        const [w, t] = await Promise.all([api('GET', '/api/config/world'), api('GET', '/api/config/theme')]);
        setWorld(normaliseWorld(w.published)); setTheme(t.published);
      } else await refresh();
    })();
  }, [refresh]);

  const value = useMemo<Store>(() => ({
    ready, owner: auth.owner && !preview, needsSetup: auth.needsSetup, preview, setPreview,
    world, theme: themePreview ?? theme, worldUnpublished: unpub.world, themeUnpublished: unpub.theme,
    saveState, saveError, saveWorld, updateWorld, saveTheme, previewTheme: setThemePreview, publish, discard, refresh,
    motionOff, setMotionOff: (v) => { setMotionOffState(v); writePref('rm-motion-off', v); },
    soundOn, setSoundOn: (v) => { setSoundOnState(v); writePref('rm-sound', v); },
    toast, toasts, offline,
  }), [offline, ready, auth, preview, setPreview, world, theme, themePreview, unpub, saveState, saveError, saveWorld, updateWorld, saveTheme, publish, discard, refresh, motionOff, soundOn, toast, toasts]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** A soft two-note chime, only when the viewer has turned sound on. */
let audioCtx: AudioContext | null = null;
export function chime(on: boolean, notes = [784, 1047]) {
  if (!on) return;
  try {
    audioCtx ??= new AudioContext();
    notes.forEach((f, i) => {
      const o = audioCtx!.createOscillator(); const g = audioCtx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = audioCtx!.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(audioCtx!.destination); o.start(t); o.stop(t + 0.65);
    });
  } catch { /* audio unavailable */ }
}
