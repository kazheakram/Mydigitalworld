import type { Room } from '../../shared/types';
import { useStore } from '../lib/store';
import { CommonplaceRoom } from '../rooms/Commonplace';
import { ModeShell, SectionTitle } from './Shell';

// The Commonplace Book from inside the Dollhouse. It is an ordinary room underneath, so it can be
// placed on the map or shared later (Atelier → Rooms); it starts private.
export const COMMONPLACE_ID = 'commonplace-book';
export function CommonplacePage() {
  const { world, updateWorld } = useStore();
  const room = world.rooms.find((r) => r.template === 'commonplace');
  const create = () => updateWorld((w) => (w.rooms.some((r) => r.template === 'commonplace') ? w : {
    ...w, rooms: [...w.rooms, { id: COMMONPLACE_ID, name: 'The Commonplace Book', template: 'commonplace', visibility: 'private', subtitle: 'words worth keeping' } as Room],
  }));
  return (
    <ModeShell mode="private">
      <SectionTitle title="The Commonplace Book" sub="quotations · excerpts · reflections" />
      {room ? <CommonplaceRoom room={room} /> : (
        <div className="paper-sheet center">
          <p className="script big">A book for words worth keeping</p>
          <p>Gather quotations, passages and your own reflections, each with its source, and link them to your books, pages and notes. It starts private.</p>
          <button className="btn" onClick={create}>Open a commonplace book</button>
        </div>
      )}
    </ModeShell>
  );
}
