import { useEffect, useRef, useState } from 'react';
import type { Item, SceneObject } from '../../shared/types';
import { featureMode } from '../../shared/features';
import { items as itemsApi } from '../lib/api';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { useItems } from '../rooms/common';
import { PET_HOMES, PET_SPECIES, PetHome, PetSvg, type PetSpecies } from '../art/pets';
import { Empty, Field, Loading, Modal } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';

// Companions: adopt a bunny, fawn, kitten or swan, name them and dress them up.
// They never need feeding, never get sad and never run away; they simply wait for you.

export interface PetData {
  name: string;
  species: PetSpecies;
  colors: Record<string, string>;
  home: string;
  /** The companion that follows your cursor around the private wing (only one at a time). */
  follow?: boolean;
  /** Tucked away: kept safe, but not shown anywhere. */
  away?: boolean;
  adoptedAt: string;
}

const SAYINGS = ['♡', 'happy to see you', 'a little hop', '*soft nuzzle*', 'they look content', 'a sleepy blink', 'they lean into your hand'];
const BOW_COLOURS = ['#e8a1b0', '#c97b8a', '#f6d6de', '#a8c3a0', '#bfa6d6', '#ffffff'];
export const companionObjectId = (petId: string) => `companion-${petId}`;

function Hearts({ burst }: { burst: number }) {
  if (!burst) return null;
  return <span className="pet-hearts" key={burst} aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} style={{ ['--i' as any]: i }}>♥</i>)}</span>;
}

export function PetsPage() {
  const { world, updateWorld, toast } = useStore();
  const pets = useItems<PetData>('pet');
  const [adopting, setAdopting] = useState<PetSpecies | null>(null);
  const [name, setName] = useState('');
  const [burst, setBurst] = useState<Record<string, number>>({});
  const [said, setSaid] = useState<Record<string, string>>({});
  const [goodbye, setGoodbye] = useState<Item<PetData> | null>(null);
  // A local copy so changes show instantly while they save.
  const [list, setList] = useState<Item<PetData>[]>([]);
  useEffect(() => { if (pets.data) setList(pets.data); }, [pets.data]);
  const onMap = (id: string) => world.objects.some((o) => o.id === companionObjectId(id));

  const refresh = () => { pets.reload(); window.dispatchEvent(new CustomEvent('rm-pets')); };
  const adopt = async () => {
    if (!adopting) return;
    const sp = PET_SPECIES.find((s) => s.id === adopting)!;
    const first = list.length === 0;
    await itemsApi.create<PetData>('pet', {
      name: name.trim() || sp.name.split(' ').pop()!, species: adopting, colors: { fur: sp.defaultFur, bow: '#e8a1b0' },
      home: adopting === 'swan' ? 'pond' : adopting === 'bunny' ? 'hutch' : 'cushion', follow: first, adoptedAt: new Date().toISOString(),
    });
    setAdopting(null); setName('');
    award('pet-friend');
    toast(`${name.trim() || 'Your new companion'} has come home ♡`);
    refresh();
  };
  const patch = async (p: Item<PetData>, data: Partial<PetData>) => {
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, data: { ...x.data, ...data } } : x)));
    await itemsApi.update(p.id, { data });
    if (onMap(p.id)) await syncMapObject({ ...p, data: { ...p.data, ...data } });
    refresh();
  };
  const dress = (p: Item<PetData>, k: string, v: string | undefined) => {
    const colors = { ...p.data.colors };
    if (v === undefined) delete colors[k]; else colors[k] = v;
    award('dressed-up');
    return patch(p, { colors });
  };
  const follow = async (p: Item<PetData>, on: boolean) => {
    // Only one companion follows at a time.
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, data: { ...x.data, follow: on, away: on ? false : x.data.away } } : on && x.data.follow ? { ...x, data: { ...x.data, follow: false } } : x)));
    for (const other of list) if (other.id !== p.id && other.data.follow && on) await itemsApi.update(other.id, { data: { follow: false } });
    await patch(p, { follow: on, away: on ? false : p.data.away });
  };
  const pat = (p: Item<PetData>) => {
    setBurst((b) => ({ ...b, [p.id]: (b[p.id] ?? 0) + 1 }));
    setSaid((s) => ({ ...s, [p.id]: SAYINGS[Math.floor(Math.random() * SAYINGS.length)] }));
  };
  const mapObject = (p: Item<PetData>, at?: SceneObject): SceneObject => ({
    id: companionObjectId(p.id), type: 'decor', art: `pet-${p.data.species}`, label: p.data.name, colors: p.data.colors, feature: 'pets',
    animation: p.data.species === 'swan' ? 'bob' : 'wander', x: at?.x ?? 760 + Math.round(Math.random() * 120), y: at?.y ?? 720, w: at?.w ?? 80, h: at?.h ?? 80, z: at?.z ?? 40,
  });
  const syncMapObject = (p: Item<PetData>) => updateWorld((w) => ({ ...w, objects: w.objects.map((o) => (o.id === companionObjectId(p.id) ? mapObject(p, o) : o)) }));
  const toggleMap = (p: Item<PetData>) => updateWorld((w) => {
    const id = companionObjectId(p.id);
    return w.objects.some((o) => o.id === id) ? { ...w, objects: w.objects.filter((o) => o.id !== id) } : { ...w, objects: [...w.objects, mapObject(p)] };
  });
  const rehome = async (p: Item<PetData>) => {
    await itemsApi.remove(p.id);
    await updateWorld((w) => ({ ...w, objects: w.objects.filter((o) => o.id !== companionObjectId(p.id)) }));
    setGoodbye(null);
    toast(`${p.data.name} has gone to live in the meadow. Thank you for looking after them.`);
    refresh();
  };

  return (
    <ModeShell mode="private">
      <SectionTitle title="Companions" sub="bunnies · fawns · kittens · swans" />
      <p className="center muted">They never get hungry, lonely or lost. Visit whenever you like — they'll be just as you left them.</p>

      {pets.loading && <Loading what="Calling the companions" />}
      {!pets.loading && list.length === 0 && <Empty title="No companions yet" art="🐇">Choose a little friend below.</Empty>}

      <div className="pet-grid">
        {list.map((p) => (
          <article key={p.id} className={`pet-card lace-card ${p.data.away ? 'is-away' : ''}`} aria-label={p.data.name}>
            <button className="pet-portrait" onClick={() => pat(p)} aria-label={`Pat ${p.data.name}`}>
              <svg viewBox="0 0 100 100" className="pet-home-art" aria-hidden><PetHome kind={p.data.home} /></svg>
              <PetSvg species={p.data.species} colors={p.data.colors} className="pet-art" />
              <Hearts burst={burst[p.id] ?? 0} />
            </button>
            <p className="pet-said hand" aria-live="polite">{said[p.id] ?? ' '}</p>
            <Field label="Name"><input className="input" defaultValue={p.data.name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.data.name && patch(p, { name: e.target.value.trim() })} /></Field>
            <details className="pet-dress">
              <summary>Accessories & colours</summary>
              <div className="row wrap gap">
                <label className="mini-color"><input type="color" value={p.data.colors.fur ?? '#ffffff'} onChange={(e) => dress(p, 'fur', e.target.value)} /> fur</label>
                <label className="mini-color"><input type="color" value={p.data.colors.collar ?? '#c97b8a'} onChange={(e) => dress(p, 'collar', e.target.value)} /> collar</label>
                {p.data.colors.collar && <button className="btn small ghost" onClick={() => dress(p, 'collar', undefined)}>no collar</button>}
              </div>
              <div className="row wrap gap" role="group" aria-label="Bow">
                <span className="smallcaps">bow</span>
                {BOW_COLOURS.map((c) => <button key={c} className={`swatch ${p.data.colors.bow === c ? 'on' : ''}`} style={{ background: c }} aria-label={`bow ${c}`} aria-pressed={p.data.colors.bow === c} onClick={() => dress(p, 'bow', c)} />)}
                <button className="btn small ghost" onClick={() => dress(p, 'bow', undefined)}>no bow</button>
              </div>
              <div className="row wrap gap">
                {(['pearls', 'crown', 'bonnet'] as const).map((k) => (
                  <label key={k} className="check"><input type="checkbox" checked={p.data.colors[k] === '1'} onChange={(e) => dress(p, k, e.target.checked ? '1' : undefined)} /> {k === 'crown' ? 'flower crown' : k === 'pearls' ? 'pearl necklace' : 'lace bonnet'}</label>
                ))}
              </div>
              <Field label="Home">
                <select className="input" value={p.data.home} onChange={(e) => patch(p, { home: e.target.value })}>
                  {PET_HOMES.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Field>
            </details>
            <div className="pet-actions">
              <label className="check"><input type="checkbox" checked={!!p.data.follow} onChange={(e) => follow(p, e.target.checked)} /> follows me around</label>
              <label className="check"><input type="checkbox" checked={onMap(p.id)} onChange={() => toggleMap(p)} /> wanders the village map</label>
              <label className="check"><input type="checkbox" checked={!!p.data.away} onChange={(e) => patch(p, { away: e.target.checked, follow: e.target.checked ? false : p.data.follow })} /> tucked away for now</label>
              {onMap(p.id) && <p className="muted small">Visitors will see {p.data.name} on the map after you publish the village.</p>}
              <button className="btn small ghost" onClick={() => setGoodbye(p)}>Rehome…</button>
            </div>
          </article>
        ))}
      </div>

      <section className="adopt lace-card">
        <h3 className="smallcaps">adopt a companion</h3>
        <div className="adopt-grid">
          {PET_SPECIES.map((s) => (
            <button key={s.id} className={`adopt-card ${adopting === s.id ? 'on' : ''}`} onClick={() => setAdopting(s.id)} aria-pressed={adopting === s.id}>
              <PetSvg species={s.id} colors={{ fur: s.defaultFur, bow: '#e8a1b0' }} className="pet-art small" />
              <strong>{s.name}</strong><span className="muted">{s.about}</span>
            </button>
          ))}
        </div>
        {adopting && (
          <div className="row wrap gap">
            <Field label="What will you call them?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Clover, Pearl, Bambi…" onKeyDown={(e) => e.key === 'Enter' && adopt()} /></Field>
            <button className="btn" onClick={adopt}>Bring them home</button>
          </div>
        )}
      </section>

      <Modal open={!!goodbye} onClose={() => setGoodbye(null)} title={`Rehome ${goodbye?.data.name ?? ''}?`}>
        <p>{goodbye?.data.name} will go to live in the meadow, and their name and accessories won't be kept. If you'd just like a break, <em>tucked away for now</em> keeps them safe instead.</p>
        <div className="form-actions">
          <button className="btn ghost" onClick={() => setGoodbye(null)}>Keep them</button>
          <button className="btn danger" onClick={() => goodbye && rehome(goodbye)}>Rehome</button>
        </div>
      </Modal>
    </ModeShell>
  );
}

/** The companion who follows the owner around (private wing and village), drifting after the pointer. */
export function CompanionLayer() {
  const { owner, world, appearance, motionOff } = useStore();
  const on = owner && featureMode(world, 'pets') === 'on' && appearance !== 'quiet';
  const [pet, setPet] = useState<Item<PetData> | null>(null);
  const [burst, setBurst] = useState(0);
  const el = useRef<HTMLButtonElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!on) { setPet(null); return; }
    let alive = true;
    const load = () => itemsApi.list<PetData>('pet').then((l) => alive && setPet(l.find((p) => p.data.follow && !p.data.away) ?? null)).catch(() => {});
    load();
    window.addEventListener('rm-pets', load);
    return () => { alive = false; window.removeEventListener('rm-pets', load); };
  }, [on]);
  useEffect(() => {
    if (!pet || motionOff) return;
    // Moves the element directly each frame (no re-render), easing gently after the pointer.
    let target = window.innerWidth - 120; let cur = target; let last = performance.now(); let raf = 0;
    const move = (e: PointerEvent) => { target = Math.max(10, Math.min(window.innerWidth - 90, e.clientX - 40)); };
    const tick = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      const d = target - cur;
      if (Math.abs(d) > 0.5) {
        cur += d * Math.min(1, dt / 900);
        if (el.current) el.current.style.transform = `translateX(${cur}px)`;
        if (inner.current && Math.abs(d) > 4) inner.current.style.transform = d < 0 ? '' : 'scaleX(-1)';
        el.current?.classList.add('walking');
      } else el.current?.classList.remove('walking');
      raf = requestAnimationFrame(tick);
    };
    if (el.current) el.current.style.transform = `translateX(${cur}px)`;
    window.addEventListener('pointermove', move);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, [pet, motionOff]);
  if (!pet) return null;
  return (
    <button ref={el} className={`companion ${motionOff ? 'still' : ''}`} onClick={() => setBurst((b) => b + 1)} aria-label={`${pet.data.name}, your companion`} title={pet.data.name}>
      <span ref={inner} className="companion-inner">
        <PetSvg species={pet.data.species} colors={pet.data.colors} className="pet-art" />
      </span>
      <Hearts burst={burst} />
    </button>
  );
}
