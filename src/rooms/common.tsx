import { useState } from 'react';
import type { Item, ItemKind, Room } from '../../shared/types';
import { items as itemsApi } from '../lib/api';
import { useAsync, Modal } from '../ui/kit';
import { ItemForm } from './ItemForm';
import { KINDS } from './schema';
import { useStore } from '../lib/store';

export interface TemplateProps { room: Room }

export function useItems<D = any>(kind: ItemKind, roomId?: string) {
  return useAsync<Item<D>[]>(() => itemsApi.list<D>(kind, roomId), [kind, roomId]);
}

/** Add/edit modal wiring shared by every template. */
export function useEditor(kind: ItemKind, roomId: string | null, reload: () => void, ctx: any = {}) {
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [initial, setInitial] = useState<Record<string, any> | undefined>();
  const def = KINDS[kind]!;
  const modal = (
    <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `A new ${def.noun}` : `Edit ${def.noun}`} wide>
      {editing && (
        <ItemForm kind={kind} roomId={roomId} ctx={ctx} initial={initial}
          item={editing === 'new' ? undefined : editing}
          onSaved={() => { setEditing(null); reload(); }}
          onCancel={() => setEditing(null)}
          onDeleted={() => { setEditing(null); reload(); }} />
      )}
    </Modal>
  );
  return { modal, add: (init?: Record<string, any>) => { setInitial(init); setEditing('new'); }, edit: (it: Item) => { setInitial(undefined); setEditing(it); } };
}

export function OwnerBar({ children }: { children: React.ReactNode }) {
  const { owner } = useStore();
  if (!owner) return null;
  return <div className="owner-bar" role="toolbar" aria-label="Owner tools"><span className="smallcaps">♡ only you see this</span>{children}</div>;
}
