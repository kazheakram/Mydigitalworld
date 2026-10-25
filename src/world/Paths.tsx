import { Link } from 'react-router-dom';
import type { Room } from '../../shared/types';
import { useStore } from '../lib/store';
import { useFeature } from '../lib/features';
import { award, getProgress, noteVisit } from '../lib/progress';
import { Scene } from './Scene';
import { LANDSCAPES, LANDSCAPE_BY_ID, LandscapeBackground, LH, LW, landscapeScene } from './Landscapes';
import { TopNav } from '../ui/Nav';
import { Empty } from '../ui/kit';
import { OwnerBar } from '../rooms/common';

// Paths beyond the village: seven landscapes to wander. Each one is a "region" room underneath, so
// the room editor arranges it. A path stays under the clouds (private) until you reveal it.

export const regionRooms = (rooms: Room[]) => rooms.filter((r) => r.template === 'region');

function Postcard({ kind }: { kind: string }) {
  return <svg viewBox={`0 0 ${LW} ${LH}`} className="postcard-art" aria-hidden><LandscapeBackground kind={kind} /><Scene width={LW} height={LH} objects={landscapeScene(kind)} ariaLabel="" /></svg>;
}

export function PathsPage() {
  const { world, owner, updateWorld, toast } = useStore();
  const feature = useFeature('regions');
  const rooms = regionRooms(world.rooms);
  const revealed = rooms.filter((r) => r.visibility === 'public');
  const open = (id: string) => {
    const def = LANDSCAPE_BY_ID.get(id)!;
    const roomId = `path-${id}`;
    updateWorld((w) => (w.rooms.some((r) => r.id === roomId) ? w : { ...w, rooms: [...w.rooms, { id: roomId, name: def.name, template: 'region', visibility: 'private', subtitle: def.subtitle, settings: { landscape: id }, scene: landscapeScene(id) }] }));
    toast(`${def.name} is ready. It stays under the clouds until you reveal it.`);
  };
  const reveal = (r: Room, on: boolean) => {
    updateWorld((w) => ({ ...w, rooms: w.rooms.map((x) => (x.id === r.id ? { ...x, visibility: on ? 'public' : 'private' } : x)) }));
    toast(on ? `${r.name} is revealed — visitors will find it after you publish.` : `${r.name} is back under the clouds.`, { essential: true });
  };
  return (
    <div className="page paths-page">
      <header className="page-header"><Link to="/" className="back-link">← back to the village</Link><TopNav /></header>
      <main className="page-main" id="main">
        <div className="section-title"><h1 className="script">Paths Beyond the Village</h1><p className="smallcaps">wander wherever you like · there is nowhere you have to be</p></div>
        <OwnerBar><span className="small">{revealed.length} of {LANDSCAPES.length} paths revealed. Revealing makes a path public (after you publish); it never adds quests or timers.</span></OwnerBar>
        <div className="postcards">
          {(owner ? LANDSCAPES : LANDSCAPES.filter((l) => revealed.some((r) => r.settings?.landscape === l.id))).map((l) => {
            const room = rooms.find((r) => r.settings?.landscape === l.id);
            const shown = room && (room.visibility === 'public' || owner);
            return (
              <article key={l.id} className={`postcard ${room?.visibility === 'public' ? 'is-revealed' : 'is-clouded'}`} aria-label={l.name}>
                {shown ? <Link to={`/room/${room!.id}`} className="postcard-link" aria-label={`Wander ${l.name}`}><Postcard kind={l.id} /></Link>
                  : owner ? <div className="postcard-preview" title="A preview: open the path to make it yours"><Postcard kind={l.id} /></div>
                    : <div className="postcard-cloud"><span>✧ undiscovered ✧</span><small>{l.mystery}</small></div>}
                <h2 className="script">{l.name}</h2>
                <p className="smallcaps">{l.subtitle}</p>
                {owner && (
                  <div className="row wrap gap">
                    {!room && <button className="btn small" onClick={() => open(l.id)}>Open this path</button>}
                    {room && room.visibility !== 'public' && <button className="btn small" onClick={() => reveal(room, true)}>Reveal to visitors</button>}
                    {room?.visibility === 'public' && <button className="btn small ghost" onClick={() => reveal(room, false)}>Hide under the clouds</button>}
                    {room && <Link className="btn small ghost" to={`/atelier/room/${room.id}`}>Arrange</Link>}
                  </div>
                )}
              </article>
            );
          })}
          {!owner && feature.settings.teaser !== false && revealed.length < LANDSCAPES.length && (
            <article className="postcard is-clouded" aria-label="More paths">
              <div className="postcard-cloud"><span>✧ undiscovered ✧</span><small>More paths are still under the clouds.</small></div>
              <h2 className="script">Somewhere further</h2>
            </article>
          )}
        </div>
        {!owner && revealed.length === 0 && <Empty title="The paths are still misty" art="🌿">Come back another day.</Empty>}
      </main>
    </div>
  );
}

/** A region room: the landscape behind whatever has been arranged there. */
export function RegionRoom({ room }: { room: Room }) {
  const kind = room.settings?.landscape ?? 'meadow';
  const regions = regionRooms(useStore().world.rooms).filter((r) => r.visibility === 'public');
  const onVisit = async () => { // walked every revealed path?
    await noteVisit(room.id);
    const pr = await getProgress();
    if (regions.length > 1 && regions.every((r) => pr.visited.includes(r.id))) award('all-paths');
  };
  return (
    <div className="region-room" ref={(el) => { if (el && !el.dataset.seen) { el.dataset.seen = '1'; onVisit(); } }}>
      <OwnerBar><Link className="btn small" to={`/atelier/room/${room.id}`}>Arrange this path in the Atelier</Link><Link className="btn small ghost" to="/paths">All paths</Link></OwnerBar>
      <div className="freeform-stage region-stage">
        <Scene width={LW} height={LH} objects={room.scene ?? []} ariaLabel={room.name} background={<LandscapeBackground kind={kind} />}
          onActivate={(o) => { if (o.href) (o.href.startsWith('/') ? (window.location.href = o.href) : window.open(o.href, '_blank', 'noopener')); }} />
      </div>
      <p className="center"><Link to="/paths">← back to the crossroads</Link></p>
    </div>
  );
}
