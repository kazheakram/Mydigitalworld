import type { WorldConfig } from '../../shared/types';
import { FEATURE_BY_ID } from '../../shared/features';
import { items as itemsApi } from './api';
import { resetProgress } from './progress';

// Resetting a feature deletes ONLY that feature's own data, as described in its definition.
// Everything else in the world is left exactly as it was.

export async function resetFeature(id: string, world: WorldConfig, saveWorld: (w: WorldConfig) => Promise<void>) {
  const def = FEATURE_BY_ID.get(id);
  if (!def?.reset) throw new Error('This feature has nothing to reset.');
  const r = def.reset;
  let removed = 0;
  if (r.kinds?.length) {
    const rooms = r.inTemplates ? new Set(world.rooms.filter((room) => r.inTemplates!.includes(room.template)).map((room) => room.id)) : null;
    for (const kind of r.kinds) {
      const list = await itemsApi.list(kind);
      for (const it of list) {
        if (rooms && (!it.roomId || !rooms.has(it.roomId))) continue; // shared kind outside this feature: keep
        await itemsApi.remove(it.id);
        removed++;
      }
    }
  }
  for (const f of r.fields ?? []) {
    const list = await itemsApi.list(f.kind);
    for (const it of list) {
      if (!f.keys.some((k) => k in (it.data ?? {}))) continue;
      const data = { ...it.data };
      for (const k of f.keys) delete data[k];
      await itemsApi.update(it.id, { data, replace: true });
    }
  }
  for (const k of r.local ?? []) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  if (r.progress?.length) await resetProgress(r.progress);
  // Feature-specific settings go back to their defaults; the on/hidden/off choice is kept.
  const cur = world.features?.[id];
  let next: WorldConfig = { ...world, features: { ...(world.features ?? {}), [id]: { mode: cur?.mode ?? def.defaultMode } } };
  if (id === 'bedroom') {
    const { resetBedroom } = await import('../private/Bedroom');
    next = resetBedroom(next);
  }
  await saveWorld(next);
  return removed;
}
