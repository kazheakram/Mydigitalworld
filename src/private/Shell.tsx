import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useStore } from '../lib/store';
import { TopNav } from '../ui/Nav';
import { BowIcon, Tag } from '../ui/kit';

// The frame shared by Dollhouse Mode and Stargirl Mode: script title, ribbon nav bar, lace edges.

export const DOLLHOUSE_NAV = [
  { to: '/dollhouse', label: 'Home', end: true },
  { to: '/dollhouse/inbox', label: 'Inbox' },
  { to: '/dollhouse/reading', label: 'Reading Room' },
  { to: '/dollhouse/diary', label: 'Diary' },
  { to: '/dollhouse/bookmarks', label: 'Bookmarks' },
  { to: '/dollhouse/favorites', label: 'Favorites' },
  { to: '/atelier/theme', label: 'Theme Closet' },
];
export const STARGIRL_NAV = [
  { to: '/stargirl', label: 'Home', end: true },
  { to: '/stargirl/picks', label: 'Curated Picks' },
  { to: '/stargirl/rabbit-holes', label: 'Rabbit Holes' },
  { to: '/dollhouse/reading', label: 'Reading Room' },
  { to: '/stargirl/discoveries', label: 'Saved Discoveries' },
  { to: '/dollhouse/bookmarks', label: 'Collections' },
];

export function ModeShell({ mode, children, small }: { mode: 'private' | 'stargirl'; children: ReactNode; small?: boolean }) {
  const { world, owner, ready } = useStore();
  const copy = world.modes[mode];
  const navItems = mode === 'private' ? DOLLHOUSE_NAV : STARGIRL_NAV;
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
    <div className={`mode-page mode-${mode} ${small ? 'compact' : ''}`}>
      <div className="lace-edge top" aria-hidden />
      <header className="mode-header">
        <div className="mode-header-side hide-narrow">{copy.notes[0] && <Tag tilt={-4}>{copy.notes[0]}</Tag>}</div>
        <div className="mode-title">
          <BowIcon size={56} className="title-bow" />
          <h1 className="script">{copy.title}</h1>
          <p className="smallcaps">{copy.subtitle} ♥</p>
        </div>
        <div className="mode-header-side right"><TopNav variant={mode === 'private' ? 'dollhouse' : 'stargirl'} /></div>
      </header>
      <nav className="ribbon-nav" aria-label={`${copy.title} sections`}>
        <BowIcon size={30} />
        {navItems.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
        <span className="script ribbon-nav-tail hide-narrow">just for me</span>
      </nav>
      <main className="mode-main" id="main">{children}</main>
      <div className="lace-edge bottom" aria-hidden />
    </div>
  );
}

export const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="section-title"><h2 className="script">{title}</h2>{sub && <p className="smallcaps">{sub}</p>}</div>
);
