import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { TopNav } from '../ui/Nav';
import { BowIcon, Tag } from '../ui/kit';
import { ArtSvg } from '../art';
import { PRESET_THEMES } from '../../shared/themes';
import { themeVars } from '../lib/theme';
import { applyAppearance } from '../../shared/appearance';
import { featureMode } from '../../shared/features';
import { useFeatureNav } from '../lib/features';

// The frame shared by Dollhouse Mode and Stargirl Mode: script title, ribbon nav bar, lace edges.

type NavItem = { to: string; label: string; end?: boolean; feature?: string };
export const DOLLHOUSE_NAV: NavItem[] = [
  { to: '/dollhouse', label: 'Home', end: true },
  { to: '/dollhouse/inbox', label: 'Inbox', feature: 'letterbox' },
  { to: '/dollhouse/reading', label: 'Reading Room' },
  { to: '/dollhouse/diary', label: 'Diary' },
  { to: '/dollhouse/bookmarks', label: 'Bookmarks', feature: 'cabinet' },
  { to: '/dollhouse/favorites', label: 'Favorites', feature: 'reader' },
  { to: '/atelier/theme', label: 'Theme Closet' },
];
export const STARGIRL_NAV: NavItem[] = [
  { to: '/stargirl', label: 'Home', end: true },
  { to: '/stargirl/picks', label: 'Curated Picks' },
  { to: '/stargirl/rabbit-holes', label: 'Rabbit Holes' },
  { to: '/dollhouse/reading', label: 'Reading Room' },
  { to: '/stargirl/discoveries', label: 'Saved Discoveries' },
  { to: '/dollhouse/bookmarks', label: 'Collections', feature: 'cabinet' },
];

/** The ribbon menu: core places, plus whatever optional rooms are switched on (tucked into "more"). */
function RibbonNav({ mode, label }: { mode: 'private' | 'stargirl'; label: string }) {
  const { world, appearance } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const base = (mode === 'private' ? DOLLHOUSE_NAV : STARGIRL_NAV).filter((n) => !n.feature || featureMode(world, n.feature) === 'on');
  const extras = useFeatureNav(mode === 'private' ? 'dollhouse' : 'stargirl').filter((n) => !base.some((b) => b.to === n.to));
  return (
    <nav className="ribbon-nav" aria-label={`${label} sections`}>
      <BowIcon size={30} />
      {base.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
      {extras.length > 0 && (
        <span className="ribbon-more">
          <button className="ribbon-more-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{appearance === 'quiet' ? 'More' : '✿ more rooms'}</button>
          {open && <span className="ribbon-more-pop lace-card">{extras.map((n) => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}</span>}
        </span>
      )}
      <span className="script ribbon-nav-tail hide-narrow decor-only">just for me</span>
    </nav>
  );
}

export function ModeShell({ mode, children, small }: { mode: 'private' | 'stargirl'; children: ReactNode; small?: boolean }) {
  const { world, owner, ready, theme, appearance } = useStore();
  const copy = world.modes[mode];
  // A mode can wear its own theme (Stargirl Mode defaults to the night palette); otherwise it follows the main theme.
  const modeTheme = copy.theme ? [...PRESET_THEMES, ...theme.custom].find((t) => t.id === copy.theme) : undefined;
  // A mode's own theme still wears the chosen appearance (Midnight colours, Pixie and Quiet lettering).
  const style = modeTheme ? (themeVars(applyAppearance(modeTheme, appearance)) as React.CSSProperties) : undefined;
  if (ready && !owner) {
    return (
      <div className={`mode-page mode-${mode}`}>
        <header className="page-header"><TopNav /></header>
        <main className="page-main narrow">
          <div className="paper-sheet center">
            <p className="script big">The curtains are drawn</p>
            <p>This is a private wing of the village. Only its owner can step inside.</p>
            <Link className="btn" to="/login">I live here — sign in</Link> <Link className="btn ghost" to="/">Back to the village</Link>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className={`mode-page mode-${mode} ${small ? 'compact' : ''}`} style={style}>
      <div className="lace-edge top" aria-hidden />
      <header className="mode-header">
        {mode === 'stargirl' && (
          <div className="night-band" aria-hidden>
            <ArtSvg art="moon" className="header-moon" />
            {[[8, 30], [18, 70], [30, 22], [62, 18], [74, 64], [86, 28], [94, 72], [44, 80]].map(([x, y], i) => <span key={i} className="band-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * -0.7}s` }}>✦</span>)}
          </div>
        )}
        <div className="mode-header-side hide-narrow decor-only">{copy.notes[0] && <Tag tilt={-4}>{copy.notes[0]}</Tag>}</div>
        <div className="mode-title">
          <BowIcon size={56} className="title-bow" />
          <h1 className="script">{copy.title}</h1>
          <p className="smallcaps">{copy.subtitle} ♥</p>
        </div>
        <div className="mode-header-side right"><TopNav variant={mode === 'private' ? 'dollhouse' : 'stargirl'} /></div>
      </header>
      <RibbonNav mode={mode} label={copy.title} />
      <main className="mode-main" id="main">{children}</main>
      <div className="lace-edge bottom" aria-hidden />
    </div>
  );
}

export const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="section-title"><h2 className="script">{title}</h2>{sub && <p className="smallcaps">{sub}</p>}</div>
);
