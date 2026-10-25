import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Region, SceneObject } from '../../shared/types';
import { useStore, chime } from '../lib/store';
import { Scene } from './Scene';
import { Ground, SkyClouds } from './Ground';
import { TopNav } from '../ui/Nav';
import { Icon, TEMPLATE_ICON } from '../ui/Icon';
import { BowIcon, Modal, Tag } from '../ui/kit';
import { addStamp, getStamps, STAMP_NAMES } from '../lib/stamps';
import { featureMode } from '../../shared/features';
import { roomFeatureMode } from '../lib/features';
import { DaylightOverlay, EffectLayer, WeatherOverlay, pokeFor, resolveWeather, useDaypart, type Effect } from './Atmosphere';
import { award } from '../lib/progress';

// Rosegarden Mode — the public village. The illustrated map is the navigation.

function useIsNarrow() {
  const [n, setN] = useState(() => window.innerWidth < 760);
  useEffect(() => { const f = () => setN(window.innerWidth < 760); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return n;
}

export function Intro({ onDone }: { onDone: () => void }) {
  const { world } = useStore();
  const [untying, setUntying] = useState(false);
  const go = () => { setUntying(true); setTimeout(onDone, 900); };
  return (
    <div className={`intro ${untying ? 'untying' : ''}`} role="dialog" aria-label={`Welcome to ${world.name}`}>
      <div className="intro-curtain left" /><div className="intro-curtain right" />
      <div className="intro-card lace-card">
        <p className="smallcaps">welcome to</p>
        <h1 className="script intro-title">{world.name}</h1>
        <p className="intro-tagline">{world.tagline}</p>
        <button className="intro-bow" onClick={go} autoFocus aria-label={world.introText}>
          <BowIcon size={92} />
          <span className="hand">{world.introText}</span>
        </button>
      </div>
    </div>
  );
}

export function WorldPage() {
  const { world, owner, soundOn, toast, appearance } = useStore();
  const nav = useNavigate();
  const narrow = useIsNarrow();
  const introOn = world.introEnabled && featureMode(world, 'intro') === 'on' && appearance !== 'quiet';
  const stampsOn = featureMode(world, 'stamps') === 'on' && appearance !== 'quiet';
  const [intro, setIntro] = useState(() => { try { return introOn && !sessionStorage.getItem('rm-entered'); } catch { return introOn; } });
  const [zoom, setZoom] = useState(narrow ? 1.9 : 1);
  const [secret, setSecret] = useState<{ title: string; message: string; stamp?: string; fresh?: boolean } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [stamps, setStamps] = useState(getStamps);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const quiet = appearance === 'quiet';
  const weatherOn = featureMode(world, 'weather') === 'on' && !quiet;
  const daynightOn = featureMode(world, 'daynight') === 'on' && !quiet;
  const playOn = featureMode(world, 'interactions') === 'on' && !quiet;
  const daypart = useDaypart(world, daynightOn);
  const weather = useMemo(() => resolveWeather(world), [world]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [lampsOff, setLampsOff] = useState<Set<string>>(() => new Set());
  const [hopping, setHopping] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const { width, height } = world.scene;
  const mode = world.modes.visitor;

  useEffect(() => { setZoom(narrow ? 1.9 : 1); }, [narrow]);
  useEffect(() => {
    // Centre the view on the village square when zoomed on a phone.
    const v = viewport.current;
    if (v && zoom > 1) { v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2; v.scrollTop = (v.scrollHeight - v.clientHeight) / 2; }
  }, [zoom]);

  const roomsById = useMemo(() => new Map(world.rooms.map((r) => [r.id, r])), [world.rooms]);
  const places = world.rooms.filter((r) => r.visibility !== 'unlisted' && (owner || r.visibility === 'public') && roomFeatureMode(world, r.template) === 'on');
  // Buildings of hidden or resting features step off the map (their data is untouched);
  // with easter eggs switched off, curious objects become plain decorations.
  const objects = world.objects
    .filter((o) => !(o.feature && featureMode(world, o.feature) !== 'on'))
    .filter((o) => (owner || !o.ownerOnly) && (!o.roomId || !roomsById.has(o.roomId) || roomFeatureMode(world, roomsById.get(o.roomId)!.template) === 'on'))
    .map((o) => (o.secret && !stampsOn ? { ...o, secret: undefined } : o));

  const poke = (o: SceneObject) => {
    const kind = pokeFor(o.art);
    if (!kind) return;
    if (kind === 'lamp') { setLampsOff((s) => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; }); chime(soundOn, [523]); return; }
    if (kind === 'hop') { setHopping(o.id); window.setTimeout(() => setHopping((h) => (h === o.id ? null : h)), 700); }
    const key = Date.now() + Math.random();
    const y = kind === 'splash' ? o.y + o.h * 0.75 : kind === 'petals' ? o.y + o.h * 0.35 : o.y;
    setEffects((e) => [...e.slice(-6), { key, kind, x: o.x + o.w / 2, y }]);
    window.setTimeout(() => setEffects((e) => e.filter((x) => x.key !== key)), 1600);
    chime(soundOn, kind === 'splash' ? [659, 784] : [988]);
  };
  const activate = (o: SceneObject) => {
    if (!o.roomId && !o.href && !o.secret) { if (playOn) poke(o); return; }
    if (o.secret) {
      const fresh = o.secret.stamp ? addStamp(o.secret.stamp) : false;
      if (fresh) {
        setStamps(getStamps()); chime(soundOn, [880, 1175, 1568]);
        award('curious');
        if (getStamps().length >= 5) award('stamp-collector');
      }
      if (o.secret.roomId && roomsById.has(o.secret.roomId)) {
        if (fresh) toast(`You found a stamp: ${STAMP_NAMES[o.secret.stamp!] ?? o.secret.stamp} ✧`);
        nav(`/room/${o.secret.roomId}`);
        return;
      }
      setSecret({ title: o.label || 'Something curious', message: o.secret.message ?? '…', stamp: o.secret.stamp, fresh });
      return;
    }
    chime(soundOn);
    if (o.roomId) nav(`/room/${o.roomId}`);
    else if (o.href?.startsWith('/')) nav(o.href);
    else if (o.href) window.open(o.href, '_blank', 'noopener');
  };

  return (
    <div className="world-page mode-rosegarden" data-daypart={daynightOn ? daypart : undefined} data-weather={weatherOn ? weather : undefined}>
      {intro && <Intro onDone={() => { setIntro(false); award('first-steps'); try { sessionStorage.setItem('rm-entered', '1'); } catch { /* ignore */ } }} />}

      <header className="world-header">
        <div className="header-note hide-narrow decor-only">{mode.notes[0] && <Tag tilt={-4}>{mode.notes[0]}</Tag>}</div>
        <div className="cartouche lace-card">
          <BowIcon size={54} className="cartouche-bow" />
          <h1 className="script">{mode.title}</h1>
          <p className="smallcaps">{mode.subtitle}</p>
        </div>
        <div className="header-right">
          <TopNav />
          {mode.notes[1] && <span className="hide-narrow decor-only"><Tag tilt={4}>{mode.notes[1]}</Tag></span>}
        </div>
      </header>

      <aside className="side-panel lace-card" aria-label="Places in the village">
        <BowIcon size={44} className="panel-bow" />
        <ul>
          {places.slice(0, 8).map((r) => (
            <li key={r.id}>
              <Link to={`/room/${r.id}`}>
                <Icon name={TEMPLATE_ICON[r.template] ?? 'heart'} size={22} />
                <span><strong>{r.name}</strong><small>{r.subtitle}</small></span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className="smallcaps more-places" to="/places">all places →</Link>
      </aside>

      <div className="map-frame">
        <div className="map-viewport" ref={viewport} tabIndex={-1}>
          <div className="map-inner" style={{ width: `${zoom * 100}%` }}>
            <Scene
              width={width} height={height}
              ariaLabel={`Map of ${world.name}. Each building is a link to a room.`}
              background={<><Ground width={width} height={height} /><SkyClouds width={width} /></>}
              objects={objects}
              regions={world.regions}
              labelFor={(o) => o.label || (o.roomId ? roomsById.get(o.roomId)?.name : undefined)}
              onActivate={activate}
              onRegion={setRegion}
              isPlayful={playOn ? (o) => !!pokeFor(o.art) : undefined}
              classFor={(o) => (lampsOff.has(o.id) ? 'lamp-off' : hopping === o.id ? 'hopping' : undefined)}
              overlay={<>
                {daynightOn && <DaylightOverlay part={daypart} width={width} height={height} glows={objects.filter((o) => !lampsOff.has(o.id) && (o.type === 'building' || o.art === 'lamppost' || o.art === 'candle')).map((o) => (o.type === 'building' ? { x: o.x + o.w / 2, y: o.y + o.h * 0.6, r: o.w * 0.45 } : { x: o.x + o.w / 2, y: o.y + o.h * 0.18, r: o.w * 0.9 }))} />}
                {weatherOn && <WeatherOverlay weather={weather} width={width} height={height} />}
                <EffectLayer effects={effects} />
              </>}
            />
          </div>
        </div>
        <div className="map-controls" role="group" aria-label="Map zoom">
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.4))} aria-label="Zoom in">＋</button>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(1, z - 0.4))} aria-label="Zoom out">－</button>
        </div>
        {stampsOn && stamps.length > 0 && (
          <div className="stamp-book lace-card" aria-label={`You have found ${stamps.length} stamps`}>
            <span className="smallcaps">stamps found</span>
            <div>{stamps.map((s) => <span key={s} className="stamp-chip" title={STAMP_NAMES[s] ?? s}>✉</span>)}</div>
          </div>
        )}
      </div>

      {welcomeOpen && (
        <section className="welcome-card lace-card" aria-label="Welcome">
          <button className="icon-btn close" onClick={() => setWelcomeOpen(false)} aria-label="Hide welcome card">✕</button>
          <p className="script welcome-heading">Welcome to {world.name}</p>
          <p>{world.tagline}. Explore the cosy corners, peek inside the buildings, leave a little letter, and stay awhile.</p>
          <button className="btn" onClick={() => { setWelcomeOpen(false); viewport.current?.focus(); (viewport.current?.querySelector('.obj.interactive') as SVGGElement | null)?.focus(); }}>Start exploring →</button>
        </section>
      )}

      <Modal open={!!secret} onClose={() => setSecret(null)} title={secret?.title ?? ''}>
        <p className="hand secret-msg">{secret?.message}</p>
        {secret?.fresh && secret.stamp && <p className="smallcaps">✧ you found a stamp: {STAMP_NAMES[secret.stamp] ?? secret.stamp} ✧</p>}
      </Modal>
      <Modal open={!!region} onClose={() => setRegion(null)} title="Beyond the clouds">
        <p className="script" style={{ fontSize: '1.8em' }}>{region?.name}</p>
        <p className="hand">{region?.mystery}</p>
        <p className="muted">This part of the village hasn't woken up yet. Come back another day.</p>
      </Modal>
    </div>
  );
}

/** An accessible, plain list of every place — the keyboard- and screen-reader-friendly path. */
export function PlacesPage() {
  const { world, owner } = useStore();
  const places = world.rooms.filter((r) => (r.visibility !== 'unlisted' || owner) && roomFeatureMode(world, r.template) === 'on');
  return (
    <div className="page">
      <header className="page-header"><TopNav /></header>
      <main className="page-main narrow" id="main">
        <div className="paper-sheet">
          <h1 className="script page-title">The village signpost</h1>
          <p className="smallcaps">every place in {world.name}</p>
          <ul className="places-list">
            {places.map((r) => (
              <li key={r.id}>
                <Link to={`/room/${r.id}`}>
                  <Icon name={TEMPLATE_ICON[r.template] ?? 'heart'} size={26} />
                  <span><strong>{r.name}</strong> <small>{r.subtitle}</small></span>
                  {owner && r.visibility !== 'public' && <em className="muted"> ({r.visibility})</em>}
                </Link>
              </li>
            ))}
            {owner && <li><Link to="/dollhouse"><Icon name="door" size={26} /><span><strong>{world.modes.private.title}</strong> <small>your private wing</small></span></Link></li>}
          </ul>
          {world.regions.some((r) => !r.revealed) && <p className="hand muted">…and somewhere beyond the clouds, {world.regions.filter((r) => !r.revealed).length} more places are still asleep.</p>}
        </div>
      </main>
    </div>
  );
}
