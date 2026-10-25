import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACHIEVEMENTS, CHARMS } from '../../shared/achievements';
import { ArtSvg } from '../art';
import { useFeature } from '../lib/features';
import { getProgress, unlockCharm, type Progress } from '../lib/progress';
import { useStore } from '../lib/store';
import { prettyDate } from '../lib/util';
import { BouquetSvg, type Bouquet } from '../rooms/Games';
import { ModeShell, SectionTitle } from './Shell';

// Charms: the achievements you've stumbled into, your pretend pearls, and a little shop of
// keepsake charms. Pearls are never real money, and every cosmetic here is also free in the
// Atelier and the Companions page; a charm is simply a keepsake on your bracelet.

const CHARM_ART: Record<string, string> = { 'acc-pearls': 'pearls', 'acc-crown': 'rosebush', 'acc-bonnet': 'bow', 'wp-roses': 'rosebush', 'wp-stars': 'star', 'frame-gilt': 'frame', 'decor-swan-lamp': 'swanlamp', 'decor-music-box': 'musicbox', 'theme-valentine': 'heart' };
const WHERE: Record<string, { label: string; to: string }> = {
  'pet-accessory': { label: 'Companions', to: '/dollhouse/pets' }, wallpaper: { label: 'My Bedroom', to: '/dollhouse/bedroom' }, frame: { label: 'any room editor', to: '/atelier/rooms' },
  decor: { label: 'the artwork shelves', to: '/atelier' }, theme: { label: 'the Theme Closet', to: '/atelier/theme' },
};

export function useProgress() {
  const [pr, setPr] = useState<Progress | null>(null);
  useEffect(() => {
    const load = () => getProgress().then(setPr);
    load(); window.addEventListener('rm-progress', load);
    return () => window.removeEventListener('rm-progress', load);
  }, []);
  return pr;
}

export function CharmsPage() {
  const { toast } = useStore();
  const ach = useFeature('achievements'); const pearls = useFeature('pearls'); const games = useFeature('minigames');
  const pr = useProgress();
  const earned = ACHIEVEMENTS.filter((a) => pr?.achievements[a.id]);
  const buy = async (id: string, price: number) => { const err = await unlockCharm(id, price); toast(err ?? 'A new charm for your bracelet ♡'); };
  const bouquets: Bouquet[] = pr?.games.flowers?.keepsakes ?? [];
  return (
    <ModeShell mode="private">
      <SectionTitle title="Charms" sub="little celebrations · pretend pearls · keepsakes" />
      <p className="center muted">Nothing here counts days or expects anything of you. Pearls are pretend, and everything they buy is also free in the Atelier.</p>
      {!pr ? null : (
        <>
          {pearls.available && (
            <div className="pearl-purse lace-card" aria-label="Pearls">
              <ArtSvg art="pearls" className="purse-art" />
              <p><strong className="script">{pr.pearls}</strong> <span className="smallcaps">pearls</span></p>
            </div>
          )}
          {ach.available && (
            <section className="lace-card" aria-label="Achievements">
              <h3 className="smallcaps">achievements · {earned.length} of {ACHIEVEMENTS.length}</h3>
              <div className="achievement-grid">
                {ACHIEVEMENTS.map((a) => {
                  const when = pr.achievements[a.id];
                  return (
                    <div key={a.id} className={`achievement ${when ? 'earned' : ''}`} aria-label={`${a.name}${when ? ', earned' : ', not yet'}`}>
                      <span className="achievement-glyph" aria-hidden>{when ? a.glyph : '·'}</span>
                      <strong>{a.name}</strong>
                      <small>{a.about}</small>
                      {when && <small className="muted">{prettyDate(when)}{pearls.available && a.pearls ? ` · ${a.pearls} pearls` : ''}</small>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {pearls.available && (
            <section className="lace-card" aria-label="The Charm Shop">
              <h3 className="smallcaps">the charm shop</h3>
              <div className="charm-grid">
                {CHARMS.map((c) => {
                  const have = pr.unlocked.includes(c.id);
                  return (
                    <article key={c.id} className={`charm ${have ? 'owned' : ''}`} aria-label={c.name}>
                      <ArtSvg art={CHARM_ART[c.id] ?? 'heart'} className="charm-art" />
                      <strong>{c.name}</strong><small>{c.about}</small>
                      <small className="muted">Also free in <Link to={WHERE[c.kind].to}>{WHERE[c.kind].label}</Link>.</small>
                      {have ? <span className="smallcaps">on your bracelet ✓</span> : <button className="btn small" onClick={() => buy(c.id, c.price)}>{c.price} pearls</button>}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {pr.unlocked.length > 0 && (
            <section className="charm-bracelet" aria-label="Charm bracelet">
              <svg viewBox="0 0 600 120" aria-hidden><path d="M20 30 Q300 130 580 30" fill="none" stroke="var(--c-gold)" strokeWidth={4} strokeDasharray="2 8" strokeLinecap="round" /></svg>
              <div className="bracelet-charms">{pr.unlocked.map((id) => <span key={id} title={CHARMS.find((c) => c.id === id)?.name}><ArtSvg art={CHARM_ART[id] ?? 'heart'} /></span>)}</div>
            </section>
          )}
          {games.available && bouquets.length > 0 && (
            <section className="lace-card" aria-label="Kept bouquets"><h3 className="smallcaps">bouquets from the flower table</h3><div className="bouquet-shelf">{bouquets.map((b, i) => <BouquetSvg key={i} b={b} />)}</div></section>
          )}
          {games.available && (
            <p className="center muted small">Games live in a Games Parlour room. Build one in <Link to="/atelier/rooms">Atelier → Rooms</Link> if you'd like one.</p>
          )}
        </>
      )}
    </ModeShell>
  );
}
