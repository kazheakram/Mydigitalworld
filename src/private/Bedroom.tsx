import { Link } from 'react-router-dom';
import type { Room, SceneObject, WorldConfig } from '../../shared/types';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { Scene } from '../world/Scene';
import { Field } from '../ui/kit';
import { DEFAULT_INTERIOR, FLOORS, InteriorBackground, WALLPAPERS, type Interior } from '../world/Interior';
import { ModeShell, SectionTitle } from './Shell';

// My Bedroom: a private dollhouse room. It is an ordinary freeform room underneath (so the
// Atelier's room editor arranges it), with a wallpaper and floor drawn behind the furniture.

export const BEDROOM_ID = 'my-bedroom';

let n = 0;
const o = (art: string, x: number, y: number, w: number, h: number, z: number, extra: Partial<SceneObject> = {}): SceneObject =>
  ({ id: `bd-${art}-${++n}`, type: 'decor', art, x, y, w, h, z, ...extra });
export function defaultBedroomScene(): SceneObject[] {
  n = 0;
  return [
    o('window', 470, 60, 260, 300, 1),
    o('frame', 180, 120, 120, 130, 1),
    o('wallshelf', 840, 150, 200, 120, 1),
    o('bed', 380, 330, 440, 380, 3, { label: 'canopy bed' }),
    o('nightstand', 230, 470, 150, 180, 3),
    o('floorlamp', 60, 330, 160, 330, 3),
    o('vanity', 860, 380, 240, 290, 3),
    o('rug', 420, 640, 360, 110, 2),
    o('bunny', 330, 620, 90, 90, 4, { animation: 'bob' }),
  ];
}

export const findBedroom = (w: WorldConfig) => w.rooms.find((r) => r.id === BEDROOM_ID || r.settings?.bedroom);
export function newBedroom(): Room {
  return { id: BEDROOM_ID, name: 'My Bedroom', template: 'freeform', visibility: 'private', subtitle: 'a little room of my own', settings: { bedroom: true, interior: DEFAULT_INTERIOR }, scene: defaultBedroomScene() };
}
/** Feature Manager reset: back to the starting furniture and wallpaper. Uploaded images stay in the media library. */
export function resetBedroom(w: WorldConfig): WorldConfig {
  const room = findBedroom(w);
  if (!room) return w;
  return { ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...(r.settings ?? {}), interior: DEFAULT_INTERIOR }, scene: defaultBedroomScene(), sceneBackground: undefined } : r)) };
}

export function BedroomPage() {
  const { world, updateWorld } = useStore();
  const room = findBedroom(world);
  const interior: Interior = { ...DEFAULT_INTERIOR, ...(room?.settings?.interior ?? {}) };
  const create = () => updateWorld((w) => (findBedroom(w) ? w : { ...w, rooms: [...w.rooms, newBedroom()] }));
  const setInterior = (patch: Partial<Interior>) => {
    if (!room) return;
    updateWorld((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room.id ? { ...r, settings: { ...(r.settings ?? {}), interior: { ...interior, ...patch } } } : r)) }));
    award('decorator');
  };
  return (
    <ModeShell mode="private">
      <SectionTitle title="My Bedroom" sub="a dollhouse room · just for me" />
      {!room ? (
        <div className="paper-sheet center">
          <p className="script big">An empty room with good light</p>
          <p>Make a little bedroom: a canopy bed, a vanity, a lamp and a window. You can rearrange every piece, swap the wallpaper and hang your own photographs. It stays private unless you choose otherwise.</p>
          <button className="btn" onClick={create}>Make my bedroom</button>
        </div>
      ) : (
        <>
          <div className="bedroom-stage lace-card">
            <Scene width={1200} height={750} objects={room.scene ?? []} ariaLabel="My bedroom" background={<InteriorBackground interior={interior} />} />
          </div>
          <div className="bedroom-tools row wrap gap">
            <Field label="Wallpaper">
              <select className="input" value={interior.wallpaper} onChange={(e) => setInterior({ wallpaper: e.target.value })}>
                {WALLPAPERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Floor">
              <select className="input" value={interior.floor} onChange={(e) => setInterior({ floor: e.target.value })}>
                {FLOORS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <label className="mini-color">Wall colour <input type="color" value={interior.wallColor || '#f6dfe3'} onChange={(e) => setInterior({ wallColor: e.target.value })} /></label>
            {interior.wallColor && <button className="btn small ghost" onClick={() => setInterior({ wallColor: undefined })}>Theme wall colour</button>}
          </div>
          <p className="row wrap gap">
            <Link className="btn" to={`/atelier/room/${room.id}`}>Arrange furniture & photos</Link>
            <Link className="btn ghost" to={`/room/${room.id}`}>Open as a room</Link>
            <span className="muted">In the editor, the <em>Furniture</em> shelf has beds, wardrobes, lamps, mirrors and more. Add your own photos from the media library and choose a frame for them.</span>
          </p>
        </>
      )}
    </ModeShell>
  );
}
