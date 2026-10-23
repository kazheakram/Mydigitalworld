import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import type { SceneObject, WorldConfig } from '../../shared/types';
import { DEFAULT_WORLD } from '../../shared/defaultWorld';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { clone } from '../lib/util';
import { TopNav } from '../ui/Nav';
import { BowIcon, Empty } from '../ui/kit';
import { Ground } from '../world/Ground';
import { SceneEditor, useHistory } from './SceneEditor';

// The Atelier: the owner's private design studio.

const TABS = [
  { to: '/atelier', label: 'Village map', end: true },
  { to: '/atelier/theme', label: 'Theme closet' },
  { to: '/atelier/rooms', label: 'Rooms' },
  { to: '/atelier/media', label: 'Media & decorations' },
  { to: '/atelier/village', label: 'Village settings' },
  { to: '/atelier/backup', label: 'Backups' },
];

export function AtelierShell({ children }: { children: ReactNode }) {
  const { owner, ready, saveState, saveError } = useStore();
  if (ready && !owner) {
    return (
      <div className="page"><header className="page-header"><TopNav /></header>
        <main className="page-main narrow"><Empty title="The Atelier is locked" art="🗝">Only the owner can redecorate. <Link to="/login">Sign in</Link></Empty></main></div>
    );
  }
  return (
    <div className="page atelier">
      <header className="atelier-header">
        <div className="atelier-title"><BowIcon size={36} /><div><h1 className="script">The Atelier</h1><p className="smallcaps">your private design studio</p></div></div>
        <nav className="atelier-tabs" aria-label="Atelier sections">{TABS.map((t) => <NavLink key={t.to} to={t.to} end={t.end}>{t.label}</NavLink>)}</nav>
        <span className={`save-state ${saveState}`} role="status" aria-live="polite">
          {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? 'draft saved ✓' : saveState === 'error' ? `not saved: ${saveError}` : ''}
        </span>
        <TopNav variant="atelier" />
      </header>
      <main className="atelier-main" id="main">{children}</main>
    </div>
  );
}

/** Save/publish controls shared by the world and room editors. */
export function PublishBar({ dirty, onSave, hist }: { dirty: boolean; onSave: () => Promise<void>; hist: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } }) {
  const { publish, discard, worldUnpublished, setPreview } = useStore();
  return (
    <span className="tool-group publish-bar">
      <button className="icon-btn" onClick={hist.undo} disabled={!hist.canUndo} aria-label="Undo">↶</button>
      <button className="icon-btn" onClick={hist.redo} disabled={!hist.canRedo} aria-label="Redo">↷</button>
      <button className="btn small" onClick={onSave} disabled={!dirty}>{dirty ? 'Save draft' : 'Saved'}</button>
      <button className="btn small" onClick={async () => { await onSave(); await publish('world'); }} disabled={!dirty && !worldUnpublished}>Publish</button>
      {worldUnpublished && <button className="btn small ghost" onClick={() => confirm('Throw away all unpublished village changes and go back to what visitors see?') && discard('world')}>Discard draft</button>}
      <button className="btn small ghost" onClick={async () => { await onSave(); setPreview(true); }}>Preview</button>
    </span>
  );
}

function useAutosave(dirty: boolean, save: () => Promise<void>) {
  const t = useRef<number>();
  useEffect(() => {
    if (!dirty) return;
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => { save().catch(() => {}); }, 1500);
    return () => window.clearTimeout(t.current);
  });
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

export function WorldEditorPage() {
  const { world, saveWorld, toast, refresh } = useStore();
  const hist = useHistory<SceneObject[]>(world.objects);
  const savedRef = useRef(world.objects);
  const [, force] = useState(0);
  const [trash, setTrash] = useState<SceneObject[]>(world.trash ?? []);
  const [showTrash, setShowTrash] = useState(false);
  // If the world changes from outside the editor (discard, restore, reload), start fresh from it.
  useEffect(() => {
    if (world.objects !== savedRef.current) { savedRef.current = world.objects; hist.reset(world.objects); setTrash(world.trash ?? []); }
  }, [world.objects]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = hist.value !== savedRef.current || (world.trash ?? []).length !== trash.length;
  const save = async () => { const objs = hist.value; savedRef.current = objs; force((n) => n + 1); await saveWorld({ ...world, objects: objs, trash }); };
  useAutosave(dirty, save);
  const restore = (o: SceneObject) => { setTrash(trash.filter((x) => x.id !== o.id)); hist.commit([...hist.value, o]); toast(`${o.label || o.art || 'Object'} is back ♡`); };
  const resetAll = async () => {
    if (!confirm('Reset the village map to how it first looked? Your rooms and content stay; a checkpoint of the current map is saved first.')) return;
    await api('POST', '/api/config/world/checkpoint', { label: 'Before resetting the map' });
    hist.commit(clone(DEFAULT_WORLD.objects));
  };
  const checkpoint = async () => { await save(); await api('POST', '/api/config/world/checkpoint', { label: prompt('Name this checkpoint:', 'My village') || 'Checkpoint' }); toast('Checkpoint saved — restore it from Backups any time.'); };

  return (
    <AtelierShell>
      <SceneEditor kind="world" width={world.scene.width} height={world.scene.height}
        objects={hist.value} onChange={hist.commit} rooms={world.rooms} regions={world.regions}
        background={<Ground width={world.scene.width} height={world.scene.height} />}
        onTrash={(o) => setTrash([o, ...trash].slice(0, 60))}
        toolbarExtra={<>
          <PublishBar dirty={dirty} onSave={save} hist={hist} />
          <span className="tool-group">
            <button className="btn small ghost" onClick={() => setShowTrash(!showTrash)} aria-expanded={showTrash}>Restore deleted ({trash.length})</button>
            <button className="btn small ghost" onClick={checkpoint}>Checkpoint</button>
            <button className="btn small ghost" onClick={resetAll}>Reset map</button>
            <button className="btn small ghost" onClick={refresh}>Reload</button>
          </span>
        </>}
      />
      {showTrash && (
        <div className="trash lace-card">
          <h3 className="smallcaps">recently deleted</h3>
          {trash.length === 0 && <p className="muted">Nothing deleted.</p>}
          {trash.map((o) => <button key={o.id} className="chip" onClick={() => restore(o)}>↺ {o.label || o.text || o.art || o.type}</button>)}
        </div>
      )}
    </AtelierShell>
  );
}

export function RoomEditorPage() {
  const { roomId } = useParams();
  const { world, saveWorld } = useStore();
  const room = world.rooms.find((r) => r.id === roomId);
  const initialScene = useRef(room?.scene ?? []).current;
  const hist = useHistory<SceneObject[]>(initialScene);
  const savedRef = useRef(initialScene);
  const [, force] = useState(0);
  const [bg, setBg] = useState(room?.sceneBackground ?? '');
  // Never autosave a room that isn't loaded (that could write an older copy of the village).
  const dirty = !!room && (hist.value !== savedRef.current || bg !== (room?.sceneBackground ?? ''));
  const save = async () => {
    if (!room) return;
    const objs = hist.value; savedRef.current = objs; force((n) => n + 1);
    await saveWorld({ ...world, rooms: world.rooms.map((r) => (r.id === roomId ? { ...r, scene: objs, sceneBackground: bg || undefined } : r)) });
  };
  useAutosave(dirty, save);
  if (!room) return <AtelierShell><Empty title="No such room" /></AtelierShell>;
  return (
    <AtelierShell>
      <p className="row wrap gap"><Link to={`/room/${room.id}`} className="back-link">← back to {room.name}</Link>
        <label className="mini-color">Room background <input type="color" value={bg || '#fbf1e2'} onChange={(e) => setBg(e.target.value)} /></label>
        {bg && <button className="btn small ghost" onClick={() => setBg('')}>Theme background</button>}
      </p>
      <SceneEditor kind="room" width={1200} height={750} objects={hist.value} onChange={hist.commit} rooms={world.rooms}
        background={<rect width={1200} height={750} fill={bg || 'var(--c-cream)'} />}
        toolbarExtra={<PublishBar dirty={dirty} onSave={save} hist={hist} />} />
    </AtelierShell>
  );
}

export type { WorldConfig };
