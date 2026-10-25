import { useEffect, useMemo, useState } from 'react';
import type { Room, SceneObject } from '../../shared/types';
import { ArtSvg } from '../art';
import { tok } from '../art/palette';
import { useFeature } from '../lib/features';
import { addPearls, award, getProgress, recordGame } from '../lib/progress';
import { useStore } from '../lib/store';
import { Scene } from '../world/Scene';
import { LandscapeBackground, landscapeScene } from '../world/Landscapes';

// The Games Parlour: five gentle games. Untimed, optional, and never needed to see anything else
// in the village. Finishing one earns a few pretend pearls (if pearls are switched on) and,
// for the flower table, a keepsake bouquet.

type GameId = 'memory' | 'hidden' | 'letters' | 'flowers' | 'puzzle';
const GAMES: { id: GameId; name: string; about: string; art: string }[] = [
  { id: 'memory', name: 'Memory cards', about: 'Turn over two cards at a time and find the pairs.', art: 'teacup' },
  { id: 'hidden', name: 'Hidden in the garden', about: 'Find the little things tucked among the flowers.', art: 'butterfly' },
  { id: 'letters', name: 'Sorting the post', about: 'Pop each letter into the right pigeonhole.', art: 'letter' },
  { id: 'flowers', name: 'The flower table', about: 'Arrange a bouquet and keep it.', art: 'flowerpot' },
  { id: 'puzzle', name: 'Picture puzzle', about: 'Slide the tiles until the meadow is whole.', art: 'cloud' },
];
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const finish = async (game: GameId, ach: string, pearls: number, patch: { best?: number; keepsake?: any } = {}) => {
  await recordGame(game, patch); await award(ach); await addPearls(pearls);
};

export function GamesRoom(_: { room: Room }) {
  const [game, setGame] = useState<GameId | null>(null);
  const { available } = useFeature('minigames');
  if (!available) return null;
  return (
    <div className="games-room">
      {!game ? (
        <div className="games-grid">
          {GAMES.map((g) => (
            <button key={g.id} className="game-card" onClick={() => setGame(g.id)}>
              <ArtSvg art={g.art} className="game-art" />
              <strong className="script">{g.name}</strong><small>{g.about}</small>
            </button>
          ))}
          <p className="muted small games-note">No timers, no scores to beat, nothing locked behind a game. Play if you feel like it.</p>
        </div>
      ) : (
        <div className="game-stage">
          <button className="btn small ghost" onClick={() => setGame(null)}>← All games</button>
          <h2 className="script center">{GAMES.find((g) => g.id === game)!.name}</h2>
          {game === 'memory' && <MemoryGame />}
          {game === 'hidden' && <HiddenGame />}
          {game === 'letters' && <LetterSort />}
          {game === 'flowers' && <FlowerTable />}
          {game === 'puzzle' && <SlidePuzzle />}
        </div>
      )}
    </div>
  );
}

// ── Memory cards ──
const CARD_ART = ['teacup', 'bow', 'bunny', 'swan', 'heart', 'moon', 'butterfly', 'stamp'];
function MemoryGame() {
  const deal = () => shuffle([...CARD_ART, ...CARD_ART].map((art, i) => ({ id: i, art })));
  const [cards, setCards] = useState(deal);
  const [up, setUp] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const done = found.size === CARD_ART.length;
  const flip = (i: number) => {
    if (up.length === 2 || up.includes(i) || found.has(cards[i].art)) return;
    const next = [...up, i]; setUp(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (cards[a].art === cards[b].art) {
        const f = new Set(found).add(cards[a].art); setFound(f); setUp([]);
        if (f.size === CARD_ART.length) finish('memory', 'games-memory', 3, { best: moves + 1 });
      } else window.setTimeout(() => setUp([]), 900);
    }
  };
  return (
    <div className="memory">
      <p className="center muted" aria-live="polite">{done ? `All pairs found in ${moves} turns ✿` : `${found.size} of ${CARD_ART.length} pairs · ${moves} turns`}</p>
      <div className="memory-grid">
        {cards.map((c, i) => {
          const shown = up.includes(i) || found.has(c.art);
          return (
            <button key={c.id} className={`memory-card ${shown ? 'up' : ''} ${found.has(c.art) ? 'matched' : ''}`} onClick={() => flip(i)} aria-label={shown ? c.art : `card ${i + 1}, face down`} aria-pressed={shown}>
              {shown ? <ArtSvg art={c.art} /> : <span aria-hidden>❦</span>}
            </button>
          );
        })}
      </div>
      {done && <p className="center"><button className="btn" onClick={() => { setCards(deal()); setFound(new Set()); setUp([]); setMoves(0); }}>Deal again</button></p>}
    </div>
  );
}

// ── Hidden in the garden ──
const HIDE = ['teacup', 'letter', 'heart', 'star', 'butterfly'];
function HiddenGame() {
  const make = () => {
    const base: SceneObject[] = landscapeScene('meadow').filter((o) => !HIDE.includes(o.art!)); // no decoys
    const extra: SceneObject[] = Array.from({ length: 10 }, (_, i) => ({ id: `fl-${i}`, type: 'decor', art: i % 2 ? 'rosebush' : 'flowerpot', x: 80 + ((i * 113) % 1000), y: 420 + ((i * 71) % 240), w: 90, h: 70, z: 20 }));
    const hidden = HIDE.map((art, i) => ({ id: `hid-${art}`, type: 'decor' as const, art, label: art, x: 60 + Math.round(Math.random() * 1060), y: 320 + Math.round(Math.random() * 360), w: 34 + (i % 2) * 6, h: 34 + (i % 2) * 6, z: 40, opacity: 0.8 })); // small and soft, but never fully covered
    return [...base, ...extra, ...hidden];
  };
  const [objs, setObjs] = useState(make);
  const [found, setFound] = useState<string[]>([]);
  const done = found.length === HIDE.length;
  const click = (o: SceneObject) => {
    if (!o.id.startsWith('hid-') || found.includes(o.art!)) return;
    const f = [...found, o.art!]; setFound(f);
    if (f.length === HIDE.length) finish('hidden', 'games-hidden', 3);
  };
  return (
    <div className="hidden-game">
      <p className="center">Find: {HIDE.map((h) => <span key={h} className={`chip static ${found.includes(h) ? 'on' : ''}`}>{found.includes(h) ? '✓ ' : ''}{h}</span>)}</p>
      <div className="hidden-stage">
        <Scene width={1200} height={750} ariaLabel="A garden full of flowers" objects={objs.map((o) => (found.includes(o.art!) && o.id.startsWith('hid-') ? { ...o, opacity: 0.25 } : o))}
          background={<LandscapeBackground kind="meadow" />} isPlayful={(o) => o.id.startsWith('hid-')} onActivate={click}
          labelFor={() => undefined} classFor={(o) => (o.id.startsWith('hid-') && found.includes(o.art!) ? 'found' : undefined)} />
      </div>
      {done && <p className="center hand">Everything found ✿ <button className="btn small" onClick={() => { setObjs(make()); setFound([]); }}>Hide them again</button></p>}
    </div>
  );
}

// ── Sorting the post ──
const HOLES = ['Bowknot Cottage', 'The Library', 'Café Meringue', 'The Observatory'];
const NAMES = ['Miss Clementine', 'Mr. Pemberton', 'Little Bea', 'Madame Rosalind', 'The Baker', 'Professor Finch', 'Dear Margot', 'Old Mr. Wren'];
function LetterSort() {
  const make = () => shuffle(NAMES).map((n, i) => ({ id: i, to: n, house: HOLES[i % HOLES.length], color: ['#f6d6de', '#e8f0f8', '#efe6f6', '#fbf4e6'][i % 4] }));
  const [letters, setLetters] = useState(make);
  const [held, setHeld] = useState<number | null>(null);
  const [sorted, setSorted] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const left = letters.filter((l) => sorted[l.id] === undefined);
  const drop = (hole: string, id = held) => {
    if (id === null) { setNote('Pick up a letter first.'); return; }
    const l = letters.find((x) => x.id === id)!;
    if (l.house !== hole) { setNote(`Not quite: that one is for ${l.house}.`); return; }
    const s = { ...sorted, [l.id]: 1 }; setSorted(s); setHeld(null); setNote('');
    if (Object.keys(s).length === letters.length) finish('letters', 'games-letters', 3);
  };
  return (
    <div className="letter-sort">
      <p className="center muted" aria-live="polite">{note || (left.length ? `${left.length} letters to sort. Pick one up, then choose its pigeonhole.` : 'All the post is sorted ✿')}</p>
      <div className="pigeonholes">
        {HOLES.map((h) => (
          <button key={h} className="pigeonhole" onClick={() => drop(h)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(h, Number(e.dataTransfer.getData('text/plain')))} aria-label={`Pigeonhole: ${h}`}>
            <span className="smallcaps">{h}</span>
            <span className="pigeon-count">{letters.filter((l) => l.house === h && sorted[l.id] !== undefined).length} ✉</span>
          </button>
        ))}
      </div>
      <div className="post-pile">
        {left.map((l) => (
          <button key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(l.id))} className={`post-letter ${held === l.id ? 'held' : ''}`} style={{ background: l.color }} onClick={() => setHeld(held === l.id ? null : l.id)} aria-pressed={held === l.id} aria-label={`Letter to ${l.to}, ${l.house}`}>
            <span className="hand">{l.to}</span><small>{l.house}</small>
          </button>
        ))}
      </div>
      {!left.length && <p className="center"><button className="btn" onClick={() => { setLetters(make()); setSorted({}); }}>A fresh sack of post</button></p>}
    </div>
  );
}

// ── The flower table ──
const BLOOMS: { id: string; name: string; color: string; shape: 'rose' | 'tulip' | 'daisy' | 'lavender' | 'peony' | 'baby' }[] = [
  { id: 'rose', name: 'Rose', color: '#d97b8f', shape: 'rose' }, { id: 'peony', name: 'Peony', color: '#f4b6c2', shape: 'peony' },
  { id: 'tulip', name: 'Tulip', color: '#f0a3a3', shape: 'tulip' }, { id: 'daisy', name: 'Daisy', color: '#fffaf0', shape: 'daisy' },
  { id: 'lavender', name: 'Lavender', color: '#b9a3d6', shape: 'lavender' }, { id: 'baby', name: "Baby's breath", color: '#ffffff', shape: 'baby' },
];
const VASES = [{ id: 'jug', name: 'Milk jug', color: '#f3ead8' }, { id: 'glass', name: 'Glass bottle', color: '#cfe3ea' }, { id: 'teacup', name: 'Teacup', color: '#f6d6de' }];
export interface Bouquet { vase: string; stems: string[]; at: string }
function Bloom({ shape, color }: { shape: string; color: string }) {
  switch (shape) {
    case 'rose': return <g><circle r={13} fill={color} stroke="rgba(74,46,53,.35)" /><path d="M-6 -2 q6 -8 12 0 q-6 8 -12 0 M-3 2 q3 -4 6 0" stroke="rgba(74,46,53,.4)" fill="none" /></g>;
    case 'peony': return <g>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} rx={9} ry={13} transform={`rotate(${a}) translate(0 -7)`} fill={color} stroke="rgba(74,46,53,.25)" />)}<circle r={6} fill="#f7d38a" /></g>;
    case 'tulip': return <path d="M-10 -4 Q-12 -20 -4 -14 Q0 -24 4 -14 Q12 -20 10 -4 Q8 10 0 10 Q-8 10 -10 -4 Z" fill={color} stroke="rgba(74,46,53,.35)" />;
    case 'daisy': return <g>{Array.from({ length: 10 }, (_, i) => <ellipse key={i} rx={3.5} ry={11} transform={`rotate(${i * 36}) translate(0 -9)`} fill={color} stroke="rgba(74,46,53,.2)" />)}<circle r={5} fill="#f2c14e" /></g>;
    case 'lavender': return <g>{Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={i % 2 ? 3 : -3} cy={-i * 6} rx={3.5} ry={5} fill={color} />)}</g>;
    default: return <g>{Array.from({ length: 7 }, (_, i) => <circle key={i} cx={Math.cos(i) * 9} cy={Math.sin(i * 1.7) * 9} r={3} fill={color} stroke="rgba(74,46,53,.2)" />)}</g>;
  }
}
export function BouquetSvg({ b, className }: { b: Bouquet; className?: string }) {
  const vase = VASES.find((v) => v.id === b.vase) ?? VASES[0];
  const n = b.stems.length;
  return (
    <svg viewBox="0 0 200 240" className={className ?? 'bouquet'} role="img" aria-label={`A bouquet of ${b.stems.join(', ') || 'nothing yet'}`}>
      {b.stems.map((s, i) => {
        const angle = n > 1 ? -50 + (100 * i) / (n - 1) : 0; const len = 92 + ((i * 17) % 26);
        const rad = (angle * Math.PI) / 180; const x = 100 + Math.sin(rad) * len; const y = 150 - Math.cos(rad) * len;
        const bl = BLOOMS.find((x2) => x2.id === s) ?? BLOOMS[0];
        return <g key={i}><path d={`M100 160 Q${100 + Math.sin(rad) * len * 0.4} ${150 - len * 0.5} ${x} ${y}`} stroke={tok('sageDeep')} strokeWidth={2.4} fill="none" /><g transform={`translate(${x} ${y})`}><Bloom shape={bl.shape} color={bl.color} /></g></g>;
      })}
      {b.vase === 'teacup' ? <g><path d="M60 170 H140 Q138 220 100 222 Q62 220 60 170 Z" fill={vase.color} stroke="rgba(74,46,53,.35)" strokeWidth={2} /><path d="M140 180 q22 0 18 18 q-4 12 -20 10" fill="none" stroke="rgba(74,46,53,.35)" strokeWidth={4} /><ellipse cx={100} cy={226} rx={58} ry={8} fill={vase.color} stroke="rgba(74,46,53,.3)" /></g>
        : b.vase === 'glass' ? <path d="M84 150 H116 V168 Q132 182 130 214 Q128 230 100 230 Q72 230 70 214 Q68 182 84 168 Z" fill={vase.color} opacity={0.75} stroke="rgba(74,46,53,.35)" strokeWidth={2} />
          : <g><path d="M70 160 H130 Q140 196 128 226 H72 Q60 196 70 160 Z" fill={vase.color} stroke="rgba(74,46,53,.35)" strokeWidth={2} /><path d="M130 172 q20 6 12 28" fill="none" stroke="rgba(74,46,53,.35)" strokeWidth={4} /><path d="M74 196 H126" stroke={tok('rose')} strokeWidth={3} /></g>}
    </svg>
  );
}
function FlowerTable() {
  const { owner, toast } = useStore();
  const [b, setB] = useState<Bouquet>({ vase: 'jug', stems: [], at: '' });
  const [kept, setKept] = useState<Bouquet[]>([]);
  useEffect(() => { getProgress().then((p) => setKept(p.games.flowers?.keepsakes ?? [])); }, []);
  const keep = async () => {
    const bouquet = { ...b, at: new Date().toISOString() };
    await finish('flowers', 'games-flowers', 2, { keepsake: bouquet });
    setKept((k) => [bouquet, ...k].slice(0, 24)); setB({ vase: b.vase, stems: [], at: '' });
    toast(owner ? 'Bouquet kept in your charms ♡' : 'Bouquet kept on this device ♡');
  };
  return (
    <div className="flower-table">
      <div className="flower-bench">
        <BouquetSvg b={b} className="bouquet big" />
        <div>
          <p className="smallcaps">vase</p>
          <div className="row wrap gap">{VASES.map((v) => <button key={v.id} className={`chip ${b.vase === v.id ? 'on' : ''}`} aria-pressed={b.vase === v.id} onClick={() => setB({ ...b, vase: v.id })}>{v.name}</button>)}</div>
          <p className="smallcaps">flowers ({b.stems.length}/12)</p>
          <div className="row wrap gap">
            {BLOOMS.map((f) => (
              <button key={f.id} className="bloom-btn" disabled={b.stems.length >= 12} onClick={() => setB({ ...b, stems: [...b.stems, f.id] })} aria-label={`Add a ${f.name}`}>
                <svg viewBox="-16 -26 32 40" aria-hidden><Bloom shape={f.shape} color={f.color} /></svg><small>{f.name}</small>
              </button>
            ))}
          </div>
          <div className="row wrap gap">
            <button className="btn small ghost" disabled={!b.stems.length} onClick={() => setB({ ...b, stems: b.stems.slice(0, -1) })}>Take one out</button>
            <button className="btn small ghost" disabled={!b.stems.length} onClick={() => setB({ ...b, stems: shuffle(b.stems) })}>Rearrange</button>
            <button className="btn" disabled={b.stems.length < 3} onClick={keep}>Keep this bouquet</button>
          </div>
        </div>
      </div>
      {kept.length > 0 && (
        <section aria-label="Kept bouquets"><h3 className="smallcaps">kept bouquets</h3><div className="bouquet-shelf">{kept.map((k, i) => <BouquetSvg key={i} b={k} />)}</div></section>
      )}
    </div>
  );
}

// ── Picture puzzle (3×3 sliding tiles) ──
const SIDE = 3;
function solvable(t: number[]) { let inv = 0; const a = t.filter((x) => x !== 8); for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++; return inv % 2 === 0; }
function newTiles() { let t: number[]; do { t = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]); } while (!solvable(t) || t.every((x, i) => x === i)); return t; }
function SlidePuzzle() {
  const [tiles, setTiles] = useState(newTiles);
  const [moves, setMoves] = useState(0);
  const solved = tiles.every((x, i) => x === i);
  const scene = useMemo(() => landscapeScene('lakeside'), []);
  const tap = (i: number) => {
    if (solved) return;
    const e = tiles.indexOf(8);
    const [r, c, er, ec] = [Math.floor(i / SIDE), i % SIDE, Math.floor(e / SIDE), e % SIDE];
    if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return;
    const t = [...tiles]; [t[i], t[e]] = [t[e], t[i]]; setTiles(t); setMoves((m) => m + 1);
    if (t.every((x, k) => x === k)) finish('puzzle', 'games-puzzle', 3, { best: moves + 1 });
  };
  const tw = 1200 / SIDE; const th = 750 / SIDE;
  return (
    <div className="slide-puzzle">
      <p className="center muted" aria-live="polite">{solved ? `The lake is whole again, in ${moves} moves ✿` : `${moves} moves · tap a tile next to the gap`}</p>
      <div className="puzzle-board" role="grid" aria-label="Sliding picture puzzle">
        {tiles.map((t, i) => (
          <button key={i} className={`puzzle-tile ${t === 8 && !solved ? 'gap' : ''}`} onClick={() => tap(i)} aria-label={t === 8 ? 'gap' : `tile ${t + 1}`} disabled={t === 8 && !solved}>
            {(t !== 8 || solved) && (
              <svg viewBox={`${(t % SIDE) * tw} ${Math.floor(t / SIDE) * th} ${tw} ${th}`} preserveAspectRatio="none" aria-hidden>
                <LandscapeBackground kind="lakeside" />
                <Scene width={1200} height={750} objects={scene} ariaLabel="" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <p className="center"><button className="btn small ghost" onClick={() => { setTiles(newTiles()); setMoves(0); }}>{solved ? 'Play again' : 'Shuffle'}</button></p>
    </div>
  );
}
