import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item, Room, RoomTemplate, ThemeTokens } from '../../shared/types';
import { FONT_CHOICES, PRESET_THEMES } from '../../shared/themes';
import { useStore } from '../lib/store';
import { api, items as itemsApi, uploadImage } from '../lib/api';
import { contrast } from '../lib/theme';
import { clone, prettyDate, slug, uid } from '../lib/util';
import { Field, Loading, VisibilityPicker, useAsync } from '../ui/kit';
import { Icon, TEMPLATE_ICON } from '../ui/Icon';
import { ArtSvg } from '../art';
import { AtelierShell } from './Atelier';

// ───────────── Theme Closet ─────────────
const COLOR_GROUPS: { title: string; keys: [string, string][] }[] = [
  { title: 'Paper & ink', keys: [['bg', 'Page background'], ['paper', 'Paper / windows'], ['cream', 'Cream'], ['ink', 'Text'], ['inkSoft', 'Soft text']] },
  { title: 'Pinks', keys: [['pink', 'Baby pink'], ['blush', 'Blush'], ['rose', 'Dusty rose'], ['roseDeep', 'Deep rose']] },
  { title: 'Accents', keys: [['gold', 'Gold'], ['accent', 'Accent'], ['focus', 'Keyboard focus ring']] },
  { title: 'The village', keys: [['skyTop', 'Sky (top)'], ['sky', 'Sky (horizon)'], ['sage', 'Meadow'], ['sageDeep', 'Leaves'], ['water', 'Water'], ['path', 'Cobblestones'], ['roof', 'Roofs'], ['wall', 'Walls'], ['trim', 'Trim & lace'], ['window', 'Window glow']] },
];
const OPTS = {
  frame: [['lace', 'Lace'], ['ribbon', 'Ribbon'], ['pixel', 'Pixel window'], ['plain', 'Plain']],
  button: [['pill', 'Satin pill'], ['ribbon', 'Ribbon tab'], ['pixel', 'Pixel']],
  texture: [['none', 'None'], ['gingham', 'Gingham'], ['dots', 'Polka dots'], ['florals', 'Florals'], ['lace', 'Lace'], ['stars', 'Stars']],
  cursor: [['default', 'Normal'], ['heart', 'Little heart'], ['wand', 'Star wand']],
  hover: [['lift', 'Lift'], ['glow', 'Glow'], ['none', 'None']],
  season: [['none', 'None'], ['petals', 'Falling petals'], ['snow', 'Snow'], ['leaves', 'Autumn leaves'], ['fireflies', 'Fireflies'], ['hearts', 'Floating hearts']],
} as const;

export function ThemeClosetPage() {
  const { theme, saveTheme, previewTheme, publish, themeUnpublished, discard, world, toast } = useStore();
  const [t, setT] = useState<ThemeTokens>(() => clone(theme.active));
  const [dirty, setDirty] = useState(false);
  const edit = (next: ThemeTokens) => { setT(next); setDirty(true); previewTheme({ ...theme, active: next }); };
  const setColor = (k: string, v: string) => edit({ ...t, colors: { ...t.colors, [k]: v } });
  const save = async () => { await saveTheme({ ...theme, active: t }); setDirty(false); toast('Theme saved as a draft ♡'); };
  const saveAsCustom = async () => {
    const name = prompt('Name your theme:', t.name.startsWith('My ') ? t.name : `My ${t.name}`);
    if (!name) return;
    const mine = { ...t, id: uid('theme-'), name };
    await saveTheme({ active: mine, custom: [...theme.custom, mine] });
    setT(mine); setDirty(false);
  };
  const ratio = contrast(t.colors.ink, t.colors.paper);
  const exportTheme = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' })); a.download = `${slug(t.name)}.theme.json`; a.click(); };
  const importTheme = async (f?: File | null) => {
    if (!f) return;
    try { const imp = JSON.parse(await f.text()); if (!imp.colors || !imp.fonts) throw new Error(); edit({ ...t, ...imp, id: uid('theme-') }); toast('Theme loaded — save it to keep it.'); }
    catch { toast('That file is not a Ribbonmere theme.'); }
  };
  return (
    <AtelierShell>
      <div className="theme-closet">
        <section className="closet-rail lace-card">
          <h2 className="script">The Theme Closet</h2>
          <p className="smallcaps">presets — layout and content always stay the same</p>
          <div className="theme-swatches">
            {[...PRESET_THEMES, ...theme.custom].map((p) => (
              <div key={p.id} className={`theme-swatch ${t.id === p.id ? 'on' : ''}`}>
                <button onClick={() => edit(clone(p))} aria-label={`Try ${p.name}`}>
                  <span className="sw-row">{['pink', 'rose', 'cream', 'sage', 'gold', 'ink'].map((k) => <i key={k} style={{ background: p.colors[k] }} />)}</span>
                  <span>{p.name}</span>
                </button>
                {theme.custom.some((c) => c.id === p.id) && (
                  <button className="icon-btn tiny" aria-label={`Delete ${p.name}`} onClick={async () => { if (confirm(`Delete “${p.name}”?`)) await saveTheme({ ...theme, custom: theme.custom.filter((c) => c.id !== p.id) }); }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="row wrap gap">
            <button className="btn" onClick={save} disabled={!dirty}>{dirty ? 'Save theme' : 'Saved'}</button>
            <button className="btn" onClick={async () => { if (dirty) await save(); await publish('theme'); }} disabled={!dirty && !themeUnpublished}>Publish</button>
            <button className="btn ghost" onClick={saveAsCustom}>Save as my own theme</button>
            {dirty && <button className="btn ghost" onClick={() => { setT(clone(theme.active)); setDirty(false); previewTheme(null); }}>Cancel changes</button>}
            {themeUnpublished && !dirty && <button className="btn ghost" onClick={() => discard('theme')}>Discard draft</button>}
          </div>
          <p className="muted">Changes preview instantly across the whole site. Nothing reaches visitors until you press Publish.</p>
          <div className="row wrap gap">
            <button className="btn small ghost" onClick={exportTheme}>Export this theme</button>
            <label className="btn small ghost">Import a theme<input type="file" accept=".json" hidden onChange={(e) => importTheme(e.target.files?.[0])} /></label>
          </div>
        </section>

        <section className="lace-card">
          <Field label="Theme name"><input className="input" value={t.name} onChange={(e) => edit({ ...t, name: e.target.value })} /></Field>
          {COLOR_GROUPS.map((g) => (
            <fieldset key={g.title} className="color-group">
              <legend className="smallcaps">{g.title}</legend>
              {g.keys.map(([k, label]) => (
                <label key={k} className="color-row"><input type="color" value={t.colors[k]?.slice(0, 7) ?? '#ffffff'} onChange={(e) => setColor(k, e.target.value)} /> <span>{label}</span></label>
              ))}
            </fieldset>
          ))}
          <p className={ratio < 4.5 ? 'error-note' : 'muted'}>Text contrast on paper: {ratio.toFixed(1)} : 1 {ratio < 4.5 ? '— a little hard to read; try a darker text colour.' : '✓ easy to read'}</p>
        </section>

        <section className="lace-card">
          <fieldset className="color-group">
            <legend className="smallcaps">fonts</legend>
            {(['display', 'body', 'script', 'pixel'] as const).map((k) => (
              <Field key={k} label={{ display: 'Headings', body: 'Body text', script: 'Script titles', pixel: 'Little pixel labels' }[k]}>
                <select className="input" value={t.fonts[k]} onChange={(e) => edit({ ...t, fonts: { ...t.fonts, [k]: e.target.value } })} style={{ fontFamily: t.fonts[k] }}>
                  {FONT_CHOICES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </Field>
            ))}
            <Field label={`Text size · ${t.sizes.base}px`}><input type="range" min={14} max={24} value={t.sizes.base} onChange={(e) => edit({ ...t, sizes: { ...t.sizes, base: Number(e.target.value) } })} /></Field>
          </fieldset>
          <fieldset className="color-group">
            <legend className="smallcaps">frames, buttons & textures</legend>
            {(Object.keys(OPTS) as (keyof typeof OPTS)[]).map((k) => (
              <Field group key={k} label={{ frame: 'Window frames', button: 'Buttons', texture: 'Background texture', cursor: 'Cursor', hover: 'Hover effect', season: 'Seasonal effect' }[k]}>
                <span className="row wrap">{OPTS[k].map(([v, label]) => <button key={v} className={`chip ${t[k] === v ? 'on' : ''}`} onClick={() => edit({ ...t, [k]: v } as ThemeTokens)}>{label}</button>)}</span>
              </Field>
            ))}
            <Field label={`Corner roundness · ${t.radius}px`}><input type="range" min={0} max={28} value={t.radius} onChange={(e) => edit({ ...t, radius: Number(e.target.value) })} /></Field>
            <Field label="Shadows"><input type="range" min={0} max={1} step={0.1} value={t.shadow} onChange={(e) => edit({ ...t, shadow: Number(e.target.value) })} /></Field>
            <Field group label="Animation" hint="Visitors can also switch animations off themselves, and reduced-motion settings are always respected.">
              <span className="row wrap">{[[0, 'Still'], [1, 'Gentle'], [2, 'Lively']].map(([v, l]) => <button key={v} className={`chip ${t.animation === v ? 'on' : ''}`} onClick={() => edit({ ...t, animation: v as number })}>{l}</button>)}</span>
            </Field>
          </fieldset>
          <fieldset className="color-group">
            <legend className="smallcaps">location colours</legend>
            <p className="muted">Give one room its own shade (it overrides the theme just there).</p>
            {world.rooms.map((r) => (
              <div key={r.id} className="row wrap loc-row">
                <span>{r.name}</span>
                {['bg', 'rose', 'pink'].map((k) => (
                  <label key={k} className="mini-color"><input type="color" value={t.locations?.[r.id]?.[k] ?? t.colors[k]} onChange={(e) => edit({ ...t, locations: { ...(t.locations ?? {}), [r.id]: { ...(t.locations?.[r.id] ?? {}), [k]: e.target.value } } })} />{k}</label>
                ))}
                {t.locations?.[r.id] && <button className="btn small ghost" onClick={() => { const l = { ...(t.locations ?? {}) }; delete l[r.id]; edit({ ...t, locations: l }); }}>reset</button>}
              </div>
            ))}
          </fieldset>
        </section>
      </div>
    </AtelierShell>
  );
}

// ───────────── Rooms ─────────────
const TEMPLATE_INFO: { id: RoomTemplate; name: string; about: string; art: string }[] = [
  { id: 'library', name: 'Library', about: 'Bookshelves, book pages, quotes, reading goal', art: 'library' },
  { id: 'gallery', name: 'Gallery', about: 'Artwork, photographs and projects with captions', art: 'loft' },
  { id: 'journal', name: 'Journal', about: 'Essays, diary entries and reflections', art: 'townhouse' },
  { id: 'collection', name: 'Collection', about: 'Saved websites, videos, articles and resources', art: 'well' },
  { id: 'freeform', name: 'Freeform room', about: 'An open space to arrange images, text, decorations and links', art: 'manor-door' },
  { id: 'music', name: 'Music room', about: 'Records, playlists and embedded players', art: 'pavilion' },
  { id: 'garden', name: 'Digital garden', about: 'Notes that grow through stages and link together', art: 'greenhouse' },
  { id: 'observatory', name: 'Observatory', about: 'Dreams, curiosities and plans as stars', art: 'observatory' },
  { id: 'cafe', name: 'Café', about: 'A menu of drinks with recommendations', art: 'cafe' },
  { id: 'postoffice', name: 'Post office', about: 'Guestbook and contact links', art: 'postoffice' },
  { id: 'secret', name: 'Secret room', about: 'Hidden notes to discover', art: 'chest' },
  { id: 'welcome', name: 'Welcome room', about: 'An introduction and guide', art: 'cottage' },
];

export function RoomsManagerPage() {
  const { world, saveWorld, toast } = useStore();
  const [creating, setCreating] = useState<RoomTemplate | null>(null);
  const [name, setName] = useState('');
  const [addToMap, setAddToMap] = useState(true);
  const create = async () => {
    const info = TEMPLATE_INFO.find((t) => t.id === creating)!;
    let id = slug(name || info.name); while (world.rooms.some((r) => r.id === id)) id = `${id}-${Math.floor(Math.random() * 99)}`;
    const room: Room = { id, name: name || `My ${info.name}`, template: creating!, visibility: 'private', subtitle: info.about.toLowerCase(), intro: '' };
    const building = { id: uid('o-'), type: 'building' as const, art: info.art, label: room.name, roomId: id, x: 700, y: 250, w: 180, h: 180, z: 50, opacity: 1 };
    await saveWorld({ ...world, rooms: [...world.rooms, room], objects: addToMap ? [...world.objects, building] : world.objects });
    toast(`${room.name} is built ♡ It starts private — make it public when it's ready.`);
    setCreating(null); setName('');
  };
  const duplicate = async (r: Room) => {
    let id = `${r.id}-copy`; while (world.rooms.some((x) => x.id === id)) id += '-2';
    await saveWorld({ ...world, rooms: [...world.rooms, { ...clone(r), id, name: `${r.name} (copy)`, visibility: 'private' }] });
    if (confirm('Copy the books, pages and other items inside too?')) await api('POST', `/api/rooms/${r.id}/duplicate-items`, { to: id });
    toast('Room duplicated. Place it on the map from the Village map editor (set a building to open it).');
  };
  const remove = async (r: Room) => {
    if (!confirm(`Remove “${r.name}”? Its building comes off the map. A checkpoint is kept so you can restore the room's settings.`)) return;
    const alsoItems = confirm('Also delete everything inside it (books, pages, notes…)? Press Cancel to keep the content.');
    await api('POST', '/api/config/world/checkpoint', { label: `Before removing ${r.name}` });
    await saveWorld({ ...world, rooms: world.rooms.filter((x) => x.id !== r.id), objects: world.objects.filter((o) => o.roomId !== r.id) });
    if (alsoItems) await api('DELETE', `/api/rooms/${r.id}/items`);
    toast('Room removed.');
  };
  const setVis = (r: Room, v: Room['visibility']) => saveWorld({ ...world, rooms: world.rooms.map((x) => (x.id === r.id ? { ...x, visibility: v } : x)) });
  const placeOnMap = async (r: Room) => {
    const info = TEMPLATE_INFO.find((t) => t.id === r.template);
    await saveWorld({ ...world, objects: [...world.objects, { id: uid('o-'), type: 'building', art: info?.art ?? 'cottage', label: r.name, roomId: r.id, x: 700, y: 250, w: 180, h: 180, z: 50, opacity: 1 }] });
    toast('A building for it is in the middle of the map — drag it where you like in the Village map editor.');
  };
  return (
    <AtelierShell>
      <div className="rooms-manager">
        <section className="lace-card">
          <h2 className="script">Build a new room</h2>
          <div className="template-grid">
            {TEMPLATE_INFO.map((t) => (
              <button key={t.id} className={`template-card ${creating === t.id ? 'on' : ''}`} onClick={() => setCreating(t.id)}>
                <ArtSvg art={t.art} /><strong>{t.name}</strong><small>{t.about}</small>
              </button>
            ))}
          </div>
          {creating && (
            <div className="row wrap gap create-row">
              <input className="input" placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Room name" />
              <label className="check"><input type="checkbox" checked={addToMap} onChange={(e) => setAddToMap(e.target.checked)} /> put a building for it on the map</label>
              <button className="btn" onClick={create}>Build it</button>
            </div>
          )}
        </section>
        <section className="lace-card">
          <h2 className="script">All rooms</h2>
          <ul className="room-rows">
            {world.rooms.map((r) => {
              const onMap = world.objects.some((o) => o.roomId === r.id || o.secret?.roomId === r.id);
              return (
                <li key={r.id}>
                  <Icon name={TEMPLATE_ICON[r.template] ?? 'heart'} size={24} />
                  <span className="room-row-name"><Link to={`/room/${r.id}`}><strong>{r.name}</strong></Link><small className="muted"> {r.template}{onMap ? '' : ' · not on the map'}</small></span>
                  <VisibilityPicker value={r.visibility} onChange={(v) => setVis(r, v)} />
                  <span className="row">
                    {r.template === 'freeform' && <Link className="btn small ghost" to={`/atelier/room/${r.id}`}>Arrange</Link>}
                    {!onMap && <button className="btn small ghost" onClick={() => placeOnMap(r)}>Place on map</button>}
                    <button className="btn small ghost" onClick={() => duplicate(r)}>Duplicate</button>
                    <button className="btn small danger" onClick={() => remove(r)}>Remove</button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="muted">Room changes are drafts until you publish. Private rooms (and everything inside them) are never sent to visitors.</p>
        </section>
      </div>
    </AtelierShell>
  );
}

// ───────────── Media library ─────────────
const MEDIA_CATS = ['Uploads', 'Illustrations', 'Photos', 'Bows & Ribbons', 'Flowers & Plants', 'Furniture', 'Stationery', 'Creatures', 'Frames & Borders', 'Textures', 'Seasonal'];
export function MediaLibraryPage() {
  const { toast } = useStore();
  const media = useAsync<Item[]>(() => itemsApi.list('media'), []);
  const [cat, setCat] = useState('Illustrations');
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try { await uploadImage(f, { category: cat, decoration: cat !== 'Uploads' && cat !== 'Photos' }); ok++; }
      catch (e: any) { toast(`${f.name}: ${e.message}`); }
    }
    setBusy(false); media.reload();
    if (ok) toast(`${ok} image${ok > 1 ? 's' : ''} added ♡`);
  };
  const list = (media.data ?? []).filter((m) => !filter || m.data.category === filter);
  return (
    <AtelierShell>
      <section className="lace-card">
        <h2 className="script">Media & decorations</h2>
        <p>Upload PNG, JPEG, WebP, GIF or SVG (up to 12&nbsp;MB). Transparent PNGs from Procreate or Canva work beautifully as decorations. Anything you upload can be dragged onto the map or into a freeform room from the editor's library, or used to replace any building's artwork.</p>
        <div className="row wrap gap">
          <Field label="Save into"><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{MEDIA_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <label className="btn">{busy ? 'Uploading…' : 'Choose images'}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => upload(e.target.files)} /></label>
        </div>
        <p className="muted">Uploaded files are served from your site so visitors can see them on public pages. Their addresses are random and unguessable, but don't upload anything you'd never want shared.</p>
      </section>
      <div className="row wrap gap filters">
        <button className={`chip ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>all</button>
        {MEDIA_CATS.map((c) => <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>{c}</button>)}
      </div>
      {media.loading && <Loading />}
      <div className="media-grid">
        {list.map((m) => (
          <figure key={m.id} className="media-card">
            <img src={m.data.url} alt={m.data.name} loading="lazy" />
            <figcaption>
              <input className="input" value={m.data.name} aria-label="Name" onChange={(e) => media.set((media.data ?? []).map((x) => (x.id === m.id ? { ...x, data: { ...x.data, name: e.target.value } } : x)))} onBlur={(e) => itemsApi.update(m.id, { data: { name: e.target.value } })} />
              <select className="input" value={m.data.category} aria-label="Category" onChange={async (e) => { await itemsApi.update(m.id, { data: { category: e.target.value, decoration: true } }); media.reload(); }}>{MEDIA_CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <span className="row"><button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(location.origin + m.data.url).then(() => toast('Link copied'))}>Copy link</button>
                <button className="btn small danger" onClick={async () => { if (confirm('Delete this image? Anywhere it is used will show an empty frame.')) { await itemsApi.remove(m.id); media.reload(); } }}>Delete</button></span>
            </figcaption>
          </figure>
        ))}
      </div>
    </AtelierShell>
  );
}

// ───────────── Village settings ─────────────
export function VillageSettingsPage() {
  const { world, saveWorld, toast } = useStore();
  const [w, setW] = useState(() => clone(world));
  const [pw, setPw] = useState({ current: '', next: '' });
  const save = async () => { await saveWorld({ ...world, name: w.name, tagline: w.tagline, introEnabled: w.introEnabled, introText: w.introText, modes: w.modes, gardenStages: w.gardenStages, regions: w.regions }); toast('Saved as a draft — publish to share it.'); };
  const modeEditor = (k: 'visitor' | 'private' | 'stargirl', label: string) => (
    <fieldset className="color-group" key={k}>
      <legend className="smallcaps">{label}</legend>
      <Field label="Title"><input className="input" value={w.modes[k].title} onChange={(e) => setW({ ...w, modes: { ...w.modes, [k]: { ...w.modes[k], title: e.target.value } } })} /></Field>
      <Field label="Subtitle"><input className="input" value={w.modes[k].subtitle} onChange={(e) => setW({ ...w, modes: { ...w.modes, [k]: { ...w.modes[k], subtitle: e.target.value } } })} /></Field>
      <Field label="Little handwritten notes" hint="One per line — they appear on paper tags around the page."><textarea className="input" rows={3} value={w.modes[k].notes.join('\n')} onChange={(e) => setW({ ...w, modes: { ...w.modes, [k]: { ...w.modes[k], notes: e.target.value.split('\n') } } })} /></Field>
    </fieldset>
  );
  return (
    <AtelierShell>
      <div className="settings-grid">
        <section className="lace-card">
          <h2 className="script">The village</h2>
          <Field label="Name of your world"><input className="input" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} /></Field>
          <Field label="Tagline"><input className="input" value={w.tagline} onChange={(e) => setW({ ...w, tagline: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={w.introEnabled} onChange={(e) => setW({ ...w, introEnabled: e.target.checked })} /> show the ribbon-untying welcome when visitors arrive</label>
          <Field label="Welcome button words"><input className="input" value={w.introText} onChange={(e) => setW({ ...w, introText: e.target.value })} /></Field>
          <h3 className="smallcaps">digital garden stages</h3>
          {w.gardenStages.map((s, i) => (
            <div key={s.id} className="row">
              <input className="input emoji-input" value={s.emoji ?? ''} aria-label="Stage symbol" onChange={(e) => setW({ ...w, gardenStages: w.gardenStages.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)) })} />
              <input className="input" value={s.label} aria-label="Stage name" onChange={(e) => setW({ ...w, gardenStages: w.gardenStages.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            </div>
          ))}
          <button className="btn small ghost" onClick={() => setW({ ...w, gardenStages: [...w.gardenStages, { id: uid('stage-'), label: 'New stage', emoji: '✿' }] })}>+ add a stage</button>
        </section>
        <section className="lace-card">
          <h2 className="script">Regions beyond the clouds</h2>
          <p className="muted">Unrevealed regions stay under clouds with a mysterious note. Anything you place inside a region (set “Belongs to region” on an object in the map editor) only appears once you reveal it.</p>
          {w.regions.map((r, i) => (
            <fieldset key={r.id} className="color-group">
              <legend className="smallcaps">{r.revealed ? '✿ revealed' : '☁ under the clouds'}</legend>
              <Field label="Name"><input className="input" value={r.name} onChange={(e) => setW({ ...w, regions: w.regions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></Field>
              <Field label="Mysterious note"><input className="input" value={r.mystery} onChange={(e) => setW({ ...w, regions: w.regions.map((x, j) => (j === i ? { ...x, mystery: e.target.value } : x)) })} /></Field>
              <div className="num-grid">{(['x', 'y', 'w', 'h'] as const).map((k) => <label key={k} className="num"><span>{k}</span><input className="input" type="number" value={r[k]} onChange={(e) => setW({ ...w, regions: w.regions.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) } : x)) })} /></label>)}</div>
              <div className="row wrap">
                <button className="btn small" onClick={() => setW({ ...w, regions: w.regions.map((x, j) => (j === i ? { ...x, revealed: !x.revealed } : x)) })}>{r.revealed ? 'Hide under clouds again' : 'Reveal this region ✧'}</button>
                <button className="btn small danger" onClick={() => setW({ ...w, regions: w.regions.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            </fieldset>
          ))}
          <button className="btn small ghost" onClick={() => setW({ ...w, regions: [...w.regions, { id: uid('region-'), name: 'A new region', revealed: false, mystery: 'Something is waiting here…', x: 600, y: 300, w: 300, h: 200 }] })}>+ a new region</button>
        </section>
        <section className="lace-card">
          <h2 className="script">Modes</h2>
          {modeEditor('visitor', 'visitor mode (the public village)')}
          {modeEditor('private', 'private mode (your sanctuary)')}
          {modeEditor('stargirl', 'stargirl mode (exploration)')}
        </section>
        <section className="lace-card">
          <h2 className="script">Your key</h2>
          <form className="item-form" onSubmit={async (e) => { e.preventDefault(); try { await api('POST', '/api/auth/password', pw); toast('Password changed. Other devices were signed out.'); setPw({ current: '', next: '' }); } catch (err: any) { toast(err.message); } }}>
            <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password (8+ characters)"><input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <button className="btn small">Change password</button>
          </form>
        </section>
      </div>
      <div className="sticky-save"><button className="btn" onClick={save}>Save village settings</button></div>
    </AtelierShell>
  );
}

// ───────────── Backups ─────────────
export function BackupsPage() {
  const { toast, refresh } = useStore();
  const wv = useAsync<{ id: number; label: string; createdAt: string }[]>(() => api('GET', '/api/config/world/versions'), []);
  const tv = useAsync<{ id: number; label: string; createdAt: string }[]>(() => api('GET', '/api/config/theme/versions'), []);
  const [busy, setBusy] = useState(false);
  const restoreFile = async (f?: File | null, mode: 'replace' | 'merge' = 'replace') => {
    if (!f) return;
    if (!confirm(mode === 'replace' ? 'Restore this backup, replacing everything in your world? (A checkpoint of the current settings is kept.)' : 'Merge this backup into your world?')) return;
    setBusy(true);
    try { await api('POST', `/api/import?mode=${mode}`, JSON.parse(await f.text())); toast('Backup restored ♡'); await refresh(); }
    catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  };
  const restoreVersion = async (key: 'world' | 'theme', id: number) => {
    if (!confirm('Load this checkpoint as your draft? You can still publish or discard it afterwards.')) return;
    await api('POST', `/api/config/${key}/versions/${id}/restore`); toast('Checkpoint loaded as your draft.'); await refresh();
  };
  return (
    <AtelierShell>
      <div className="settings-grid">
        <section className="lace-card">
          <h2 className="script">Take your world with you</h2>
          <p>A backup is a single JSON file with your village, rooms, theme, every item, your feed subscriptions and saved posts. Keep one somewhere safe now and then.</p>
          <div className="row wrap gap">
            <a className="btn" href="/api/export" download>Download backup</a>
            <a className="btn ghost" href="/api/export?media=1" download>…including all images</a>
            <a className="btn ghost" href="/api/feeds/opml">Feeds as OPML</a>
          </div>
        </section>
        <section className="lace-card">
          <h2 className="script">Restore</h2>
          <label className="btn">{busy ? 'Restoring…' : 'Restore from a backup (replace)'}<input type="file" accept=".json" hidden onChange={(e) => restoreFile(e.target.files?.[0], 'replace')} /></label>{' '}
          <label className="btn ghost">Merge a backup in<input type="file" accept=".json" hidden onChange={(e) => restoreFile(e.target.files?.[0], 'merge')} /></label>
        </section>
        <section className="lace-card">
          <h2 className="script">Checkpoints</h2>
          <p className="muted">A checkpoint is saved automatically every time you publish, before restoring, and whenever you press “Checkpoint” in the map editor.</p>
          <h3 className="smallcaps">village</h3>
          <ul className="queue">{(wv.data ?? []).map((v) => <li key={v.id}>{v.label} <span className="muted">· {prettyDate(v.createdAt)} {new Date(v.createdAt).toLocaleTimeString()}</span> <button className="btn small ghost" onClick={() => restoreVersion('world', v.id)}>Load</button></li>)}</ul>
          <h3 className="smallcaps">theme</h3>
          <ul className="queue">{(tv.data ?? []).map((v) => <li key={v.id}>{v.label} <span className="muted">· {prettyDate(v.createdAt)}</span> <button className="btn small ghost" onClick={() => restoreVersion('theme', v.id)}>Load</button></li>)}</ul>
        </section>
      </div>
    </AtelierShell>
  );
}
