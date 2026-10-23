import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Room } from '../../shared/types';
import { useStore } from '../lib/store';
import { themeVars } from '../lib/theme';
import { TopNav, BackToVillage } from '../ui/Nav';
import { BowIcon, Empty, VisBadge, Field, Modal, VisibilityPicker } from '../ui/kit';
import { Icon, TEMPLATE_ICON } from '../ui/Icon';
import { Prose } from '../lib/markdown';
import { WelcomeRoom, LibraryRoom, JournalRoom, GalleryRoom, MusicRoom } from './templatesA';
import { PostOfficeRoom, CafeRoom, GardenRoom, ObservatoryRoom, SecretRoom, CollectionRoom, FreeformRoom } from './templatesB';

const TEMPLATES: Record<string, (p: { room: Room; itemId?: string }) => ReactNode> = {
  welcome: WelcomeRoom, library: LibraryRoom, journal: JournalRoom, gallery: GalleryRoom, music: MusicRoom,
  postoffice: PostOfficeRoom, cafe: CafeRoom, garden: GardenRoom, observatory: ObservatoryRoom, secret: SecretRoom,
  collection: CollectionRoom, freeform: FreeformRoom,
};

export function RoomPage() {
  const { roomId, itemId } = useParams();
  const { world, theme, owner, updateWorld } = useStore();
  const room = world.rooms.find((r) => r.id === roomId);
  const [editingRoom, setEditingRoom] = useState(false);

  if (!room) {
    return (
      <div className="page"><header className="page-header"><BackToVillage /><TopNav /></header>
        <main className="page-main narrow"><Empty title="This door is locked">There is no room here — or it's private. <Link to="/">Back to the village</Link></Empty></main>
      </div>
    );
  }
  const Tpl = TEMPLATES[room.template] ?? FreeformRoom;
  const style = { ...themeVars(theme.active, { ...(theme.active.locations?.[room.id] ?? {}), ...(room.theme ?? {}) }) } as React.CSSProperties;

  return (
    <div className={`page room-page tpl-${room.template}`} style={style}>
      <header className="page-header">
        <BackToVillage />
        <TopNav />
      </header>
      <main className="page-main" id="main">
        <div className="room-heading">
          <BowIcon size={48} />
          <div>
            <p className="smallcaps"><Icon name={TEMPLATE_ICON[room.template] ?? 'heart'} size={16} /> {room.subtitle}</p>
            <h1 className="script page-title">{room.name}</h1>
          </div>
          {owner && (
            <div className="room-owner-tools">
              <VisBadge v={room.visibility} />
              <button className="btn small ghost" onClick={() => setEditingRoom(true)}>Edit room</button>
            </div>
          )}
        </div>
        {room.intro && !itemId && <Prose text={room.intro} className="room-intro hand-lite" />}
        <Tpl room={room} itemId={itemId} />
      </main>
      <Modal open={editingRoom} onClose={() => setEditingRoom(false)} title="Room details">
        {editingRoom && <RoomDetailsForm room={room} onDone={async (r) => { await updateWorld((w) => ({ ...w, rooms: w.rooms.map((x) => (x.id === r.id ? r : x)) })); setEditingRoom(false); }} />}
      </Modal>
    </div>
  );
}

export function RoomDetailsForm({ room, onDone }: { room: Room; onDone: (r: Room) => void }) {
  const [r, setR] = useState<Room>(room);
  return (
    <form className="item-form" onSubmit={(e) => { e.preventDefault(); onDone(r); }}>
      <Field label="Name"><input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} required /></Field>
      <Field label="Little subtitle"><input className="input" value={r.subtitle ?? ''} onChange={(e) => setR({ ...r, subtitle: e.target.value })} /></Field>
      <Field label="Introduction" hint="Shown at the top of the room."><textarea className="input" rows={4} value={r.intro ?? ''} onChange={(e) => setR({ ...r, intro: e.target.value })} /></Field>
      <Field group label="Who can visit this room"><VisibilityPicker value={r.visibility} onChange={(v) => setR({ ...r, visibility: v })} /></Field>
      <Field group label="Room colours" hint="Override the theme just for this room.">
        <span className="row wrap">
          {['bg', 'paper', 'rose', 'pink', 'ink'].map((k) => (
            <label key={k} className="mini-color"><input type="color" value={r.theme?.[k] ?? '#ffffff'} onChange={(e) => setR({ ...r, theme: { ...(r.theme ?? {}), [k]: e.target.value } })} /> {k}</label>
          ))}
          {r.theme && <button type="button" className="btn small ghost" onClick={() => setR({ ...r, theme: undefined })}>Use theme colours</button>}
        </span>
      </Field>
      <p className="muted">Changes are saved as a draft; press <strong>Publish</strong> in the pink banner when you want visitors to see them.</p>
      <div className="form-actions"><button className="btn">Save</button></div>
    </form>
  );
}
