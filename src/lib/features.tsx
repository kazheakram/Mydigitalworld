import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { FeatureMode, WorldConfig } from '../../shared/types';
import { FEATURE_BY_ID, FEATURES, NOT_YET_BUILT, featureForPath, featureForTemplate, featureMode, featureState } from '../../shared/features';
import { useStore } from './store';

// Reading and changing feature modes from anywhere in the app.

export function useFeature(id: string) {
  const { world, updateWorld, owner, appearance } = useStore();
  const st = featureState(world, id);
  const def = FEATURE_BY_ID.get(id);
  const quietHidden = appearance === 'quiet' && !!def?.quietHides;
  return {
    mode: st.mode,
    /** Shown in menus and on the map. */
    shown: st.mode === 'on' && !quietHidden,
    /** Works at all (on or hidden). */
    available: st.mode !== 'off',
    settings: st.settings ?? {},
    owner,
    setMode: (mode: FeatureMode) => updateWorld((w) => setFeature(w, id, { mode })),
    setSettings: (patch: Record<string, any>) => updateWorld((w) => setFeature(w, id, { settings: { ...(featureState(w, id).settings ?? {}), ...patch } })),
  };
}

export function setFeature(w: WorldConfig, id: string, patch: Partial<{ mode: FeatureMode; settings: Record<string, any> }>): WorldConfig {
  const cur = featureState(w, id);
  return { ...w, features: { ...(w.features ?? {}), [id]: { ...cur, ...patch } } };
}

/** Is a room's template switched off (resting) or hidden? */
export function roomFeatureMode(world: WorldConfig, template: string): FeatureMode {
  const f = featureForTemplate(template);
  return f ? featureMode(world, f.id) : 'on';
}

/** Menu entries contributed by features that are on. */
export function useFeatureNav(area: 'dollhouse' | 'stargirl' | 'village' | 'atelier') {
  const { world, appearance } = useStore();
  return FEATURES.filter((f) => featureMode(world, f.id) === 'on' && !NOT_YET_BUILT.has(f.id) && !(appearance === 'quiet' && f.quietHides))
    .flatMap((f) => (f.nav ?? []).filter((n) => n.area === area))
    .filter((n, i, all) => all.findIndex((m) => m.to === n.to) === i);
}

/** Wraps a page: if its feature is switched off, show a gentle "resting" note instead. */
export function FeatureGate({ children, id }: { children: ReactNode; id?: string }) {
  const { world, owner } = useStore();
  const loc = useLocation();
  const def = id ? FEATURE_BY_ID.get(id) : featureForPath(loc.pathname);
  if (!def || featureMode(world, def.id) !== 'off') return <>{children}</>;
  return <Resting name={def.name} owner={owner} />;
}

export function Resting({ name, owner }: { name: string; owner: boolean }) {
  return (
    <div className="page"><main className="page-main narrow">
      <div className="paper-sheet center">
        <p className="script big">{name} is resting</p>
        <p>This part of the village is switched off for now. Nothing inside it has been deleted — it's simply sleeping.</p>
        {owner ? <Link className="btn" to="/atelier/features">Wake it in the Feature Manager</Link> : <Link className="btn" to="/">Back to the village</Link>}
      </div>
    </main></div>
  );
}
