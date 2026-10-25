import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeatureMode } from '../../shared/types';
import { FEATURE_GROUPS, FEATURES, NOT_YET_BUILT, featureState, type FeatureDef } from '../../shared/features';
import { APPEARANCES } from '../../shared/appearance';
import { useStore } from '../lib/store';
import { setFeature } from '../lib/features';
import { resetFeature } from '../lib/featureReset';
import { Modal } from '../ui/kit';
import { AtelierShell } from './Atelier';
import { DAYLIGHT_CHOICES, WEATHER_CHOICES } from '../world/Atmosphere';

/** Small per-feature options shown on its card. */
const FEATURE_OPTIONS: Record<string, { label: string; key: string; choices: { id: string; name: string }[] }> = {
  weather: { label: 'Weather', key: 'choice', choices: WEATHER_CHOICES },
  daynight: { label: 'Light', key: 'choice', choices: DAYLIGHT_CHOICES },
};

// The Feature Manager: one place to switch every optional part of Ribbonmere on, hide it, let it
// rest, or (separately, with confirmation) reset only its own data.

const MODES: { id: FeatureMode; label: string; hint: string }[] = [
  { id: 'on', label: 'On', hint: 'In the menus and on the map' },
  { id: 'hidden', label: 'Hidden', hint: 'Still works and keeps everything, but out of menus and off the map' },
  { id: 'off', label: 'Resting', hint: 'Switched off for now — nothing is deleted' },
];

export function FeatureManagerPage() {
  const { world, saveWorld, toast, publish, worldUnpublished } = useStore();
  const [confirming, setConfirming] = useState<FeatureDef | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const setMode = async (f: FeatureDef, mode: FeatureMode) => {
    await saveWorld(setFeature(world, f.id, { mode }));
    toast(mode === 'on' ? `${f.name} is on ♡` : mode === 'hidden' ? `${f.name} is tucked away (still working, out of the menus).` : `${f.name} is resting. Nothing was deleted.`);
  };
  const doReset = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      const n = await resetFeature(confirming.id, world, saveWorld);
      toast(`${confirming.name} was reset${n ? ` (${n} item${n > 1 ? 's' : ''} removed)` : ''}. Nothing else was touched.`, { essential: true });
      setConfirming(null); setTyped('');
    } catch (e: any) { toast(e.message, { essential: true }); }
    finally { setBusy(false); }
  };
  const restoreAll = async () => {
    if (!confirm('Turn every feature back on and into the menus? (Nothing is reset or deleted.)')) return;
    let w = world;
    for (const f of FEATURES) w = setFeature(w, f.id, { mode: 'on' });
    await saveWorld(w);
    toast('Every feature is back ♡');
  };
  return (
    <AtelierShell>
      <div className="feature-manager">
        <section className="lace-card fm-intro">
          <h2 className="script">The Feature Manager</h2>
          <p>Everything here is optional and reversible. <strong>Hidden</strong> keeps a feature working but out of the way. <strong>Resting</strong> switches it off without deleting anything. <strong>Reset</strong> is separate, always asks first, and only clears that feature's own things.</p>
          <div className="row wrap gap">
            <button className="btn small ghost" onClick={restoreAll}>Restore every feature</button>
            {worldUnpublished && <button className="btn small" onClick={() => publish('world')}>Publish changes for visitors</button>}
            <Link className="btn small ghost" to="/atelier/rooms">Rooms are managed here →</Link>
          </div>
          <p className="muted">Feature choices save straight away for you. Visitors see them once you publish the village.</p>
        </section>

        <section className="lace-card">
          <h3 className="smallcaps">appearance visitors see first</h3>
          <div className="row wrap gap" role="radiogroup" aria-label="Default appearance">
            {APPEARANCES.map((a) => (
              <button key={a.id} role="radio" aria-checked={(world.appearanceDefault ?? 'coquette') === a.id} className={`chip ${(world.appearanceDefault ?? 'coquette') === a.id ? 'on' : ''}`} title={a.about}
                onClick={() => saveWorld({ ...world, appearanceDefault: a.id })}>{a.name}</button>
            ))}
          </div>
          <p className="muted">Everyone can still switch for themselves from the ☾ menu (or press <kbd>Alt</kbd>+<kbd>Q</kbd> for Quiet).</p>
        </section>

        {FEATURE_GROUPS.map((g) => (
          <section key={g} className="fm-group">
            <h3 className="script">{g}</h3>
            <div className="fm-cards">
              {FEATURES.filter((f) => f.group === g).map((f) => {
                const st = featureState(world, f.id);
                return (
                  <article key={f.id} className={`fm-card mode-${st.mode}`} aria-label={f.name}>
                    <header><strong>{f.name}</strong><span className={`fm-badge ${st.mode}`}>{MODES.find((m) => m.id === st.mode)!.label}</span>{NOT_YET_BUILT.has(f.id) && <span className="fm-soon">coming soon</span>}</header>
                    <p className="muted">{f.about}</p>
                    <div className="fm-modes" role="radiogroup" aria-label={`${f.name}: on, hidden or resting`}>
                      {MODES.map((m) => (
                        <button key={m.id} role="radio" aria-checked={st.mode === m.id} className={`chip ${st.mode === m.id ? 'on' : ''}`} title={m.hint} onClick={() => setMode(f, m.id)}>{m.label}</button>
                      ))}
                    </div>
                    {FEATURE_OPTIONS[f.id] && (() => {
                      const opt = FEATURE_OPTIONS[f.id];
                      return (
                        <label className="fm-option"><span className="smallcaps">{opt.label}</span>
                          <select className="input" value={st.settings?.[opt.key] ?? opt.choices[0].id}
                            onChange={(e) => saveWorld(setFeature(world, f.id, { settings: { ...(st.settings ?? {}), [opt.key]: e.target.value } }))}>
                            {opt.choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </label>
                      );
                    })()}
                    <div className="row wrap gap fm-links">
                      {!NOT_YET_BUILT.has(f.id) && f.nav?.map((n) => <Link key={n.to} className="linkish" to={n.to}>open</Link>)}
                      {f.reset && <button className="linkish danger-link" onClick={() => { setConfirming(f); setTyped(''); }}>reset…</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <Modal open={!!confirming} onClose={() => setConfirming(null)} title={`Reset ${confirming?.name ?? ''}?`}>
        {confirming && (
          <div className="item-form">
            <p><strong>{confirming.reset!.what}</strong></p>
            <p className="muted">Only this feature is affected. Your other rooms, books, pages, images, themes and settings stay exactly as they are. To be extra safe, download a backup first (Atelier → Backups).</p>
            <label className="field"><span className="field-label smallcaps">type RESET to confirm</span><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></label>
            <div className="form-actions">
              <button className="btn danger" disabled={typed.trim().toUpperCase() !== 'RESET' || busy} onClick={doReset}>{busy ? 'Resetting…' : 'Reset'}</button>
              <button className="btn ghost" onClick={() => setConfirming(null)}>Keep everything</button>
            </div>
          </div>
        )}
      </Modal>
    </AtelierShell>
  );
}
