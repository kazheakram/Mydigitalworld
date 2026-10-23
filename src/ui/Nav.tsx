import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { BowIcon } from './kit';

/** The lace-edged navigation card that floats in the top-right of every page. */
export function TopNav({ variant = 'village' }: { variant?: 'village' | 'dollhouse' | 'stargirl' | 'atelier' }) {
  const { owner, preview, setPreview, world, motionOff, setMotionOff, soundOn, setSoundOn, refresh, toast } = useStore();
  const nav = useNavigate();
  const [comfort, setComfort] = useState(false);
  const post = world.rooms.find((r) => r.template === 'postoffice' && r.visibility !== 'private');
  const welcome = world.rooms.find((r) => r.template === 'welcome');
  return (
    <nav className={`topnav lace-card topnav-${variant}`} aria-label="Main">
      <NavLink to="/" end><Icon name="home" /><span>Village</span></NavLink>
      <NavLink to="/places"><Icon name="map" /><span>Places</span></NavLink>
      {welcome && <NavLink to={`/room/${welcome.id}`}><Icon name="heart" /><span>About</span></NavLink>}
      {post && <NavLink to={`/room/${post.id}`}><Icon name="envelope" /><span>Guestbook</span></NavLink>}
      <NavLink to="/search"><Icon name="search" /><span>Search</span></NavLink>
      {owner && <NavLink to="/dollhouse" className="mode-link"><BowIcon size={20} /><span>Dollhouse</span></NavLink>}
      {owner && <NavLink to="/stargirl"><Icon name="moon" /><span>Stargirl</span></NavLink>}
      {owner && <NavLink to="/atelier"><Icon name="gear" /><span>Atelier</span></NavLink>}
      <div className="comfort">
        <button className="icon-btn" aria-expanded={comfort} aria-label="Comfort settings: motion and sound" onClick={() => setComfort(!comfort)}>☾</button>
        {comfort && (
          <div className="comfort-pop lace-card" role="dialog" aria-label="Comfort settings">
            <label className="check"><input type="checkbox" checked={!motionOff} onChange={(e) => setMotionOff(!e.target.checked)} /> Gentle animations</label>
            <label className="check"><input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} /> Little chimes</label>
            {(owner || preview) && (
              <label className="check"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> See it as a visitor</label>
            )}
            {owner ? (
              <button className="btn small ghost" onClick={async () => { await api('POST', '/api/auth/logout'); await refresh(); toast('Signed out. See you soon ♡'); nav('/'); }}>Sign out</button>
            ) : !preview && <Link className="btn small ghost" to="/login">Sign in</Link>}
          </div>
        )}
      </div>
    </nav>
  );
}

export function PreviewBanner() {
  const { preview, setPreview, owner, worldUnpublished, themeUnpublished, publish } = useStore();
  if (preview) {
    return (
      <div className="banner preview-banner" role="status">
        You are seeing exactly what a visitor sees. Private things are hidden by the server, not just tucked away.
        <button className="btn small" onClick={() => setPreview(false)}>Back to my view</button>
      </div>
    );
  }
  if (owner && (worldUnpublished || themeUnpublished)) {
    return (
      <div className="banner draft-banner" role="status">
        <span>🎀 You have changes that visitors can't see yet{worldUnpublished && themeUnpublished ? ' (village & theme)' : worldUnpublished ? ' (village)' : ' (theme)'}.</span>
        <button className="btn small" onClick={async () => { if (worldUnpublished) await publish('world'); if (themeUnpublished) await publish('theme'); }}>Publish</button>
        <button className="btn small ghost" onClick={() => setPreview(true)}>Preview as visitor</button>
      </div>
    );
  }
  return null;
}

export const BackToVillage = () => <Link to="/" className="back-link"><Icon name="map" size={16} /> back to the village</Link>;
