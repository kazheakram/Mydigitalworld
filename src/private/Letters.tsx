import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Item } from '../../shared/types';
import { items as itemsApi } from '../lib/api';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { downloadPng, downloadSvg } from '../lib/exportImage';
import { prettyDate } from '../lib/util';
import { useItems } from '../rooms/common';
import { ART } from '../art';
import { Empty, Field, Loading } from '../ui/kit';
import { TopNav } from '../ui/Nav';
import { ModeShell, SectionTitle } from './Shell';

// The Letter-Writing Desk: letters on pretty stationery, sealed with wax and tied with ribbon.
// Letters are private drafts unless you choose "share by link", which makes that one letter
// unlisted: readable only by someone holding its exact address. Letters never touch the guestbook.

export interface LetterData {
  to: string; from: string; body: string; closing?: string; date?: string;
  stationery: string; envelope: string; stamp: string; ribbon: string; seal: string; sealMark: string; font: string;
  finished?: boolean;
}
export const STATIONERY: Record<string, { name: string; paper: string; ink: string; rule?: string }> = {
  cream: { name: 'Cream laid paper', paper: '#fbf4e6', ink: '#4a2e35', rule: '#ead9c0' },
  rose: { name: 'Rose petal', paper: '#fbe6ea', ink: '#6b2e3d', rule: '#f2c4ce' },
  lavender: { name: 'Lavender', paper: '#efe6f6', ink: '#3f2e55', rule: '#d9c8ea' },
  sky: { name: 'Forget-me-not', paper: '#e8f0f8', ink: '#2e3f55', rule: '#c8d8ea' },
  kraft: { name: 'Kraft', paper: '#dcc3a0', ink: '#3d2b1c' },
  midnight: { name: 'Midnight', paper: '#2f2236', ink: '#f6e6ed', rule: '#4a3852' },
};
export const FONTS: Record<string, { name: string; css: string; size: number }> = {
  script: { name: 'Copperplate script', css: 'var(--font-script)', size: 30 },
  hand: { name: 'Handwriting', css: 'var(--font-hand)', size: 24 },
  serif: { name: 'Book serif', css: 'var(--font-display)', size: 22 },
  typewriter: { name: 'Typewriter', css: '"Courier New", Courier, monospace', size: 19 },
};
export const STAMPS = ['bunny', 'swan', 'deer', 'rosebush', 'butterfly', 'teacup', 'moon', 'heart'];
const DEFAULT: LetterData = { to: '', from: '', body: '', closing: 'With love,', stationery: 'cream', envelope: '#f3d9df', stamp: 'bunny', ribbon: '#c97b8a', seal: '#9e2f45', sealMark: '♥', font: 'hand' };
export const SHEET_W = 700; export const SHEET_H = 940;

/** The letter itself, drawn as SVG so it can also be downloaded as a picture. */
export function LetterSheet({ d }: { d: LetterData }) {
  const st = STATIONERY[d.stationery] ?? STATIONERY.cream; const f = FONTS[d.font] ?? FONTS.hand;
  return (
    <svg className="letter-sheet" viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} role="img" aria-label={`A letter${d.to ? ` to ${d.to}` : ''}`}>
      <rect width={SHEET_W} height={SHEET_H} rx={6} fill={st.paper} />
      {st.rule && Array.from({ length: 24 }, (_, i) => <path key={i} d={`M60 ${170 + i * 32} H${SHEET_W - 60}`} stroke={st.rule} strokeWidth={1} />)}
      <rect x={14} y={14} width={SHEET_W - 28} height={SHEET_H - 28} rx={4} fill="none" stroke={d.ribbon} strokeOpacity={0.5} strokeDasharray="2 6" />
      <foreignObject x={60} y={56} width={SHEET_W - 120} height={SHEET_H - 120}>
        <div className="letter-text" style={{ fontFamily: f.css, fontSize: f.size, color: st.ink, lineHeight: '32px' }}>
          {d.date && <p style={{ textAlign: 'right', margin: '0 0 20px', fontSize: '0.75em' }}>{prettyDate(d.date)}</p>}
          <p style={{ margin: '0 0 16px' }}>{d.to ? `Dear ${d.to},` : 'Dear —,'}</p>
          {d.body.split(/\n{2,}/).map((para, i) => <p key={i} style={{ margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{para}</p>)}
          <p style={{ margin: '24px 0 0', textAlign: 'right' }}>{d.closing}</p>
          <p style={{ margin: 0, textAlign: 'right' }}>{d.from}</p>
        </div>
      </foreignObject>
    </svg>
  );
}

/** The envelope: stamp, ribbon and a wax seal. */
export function Envelope({ d, open }: { d: LetterData; open?: boolean }) {
  const stamp = ART[d.stamp] ?? ART.heart;
  return (
    <svg className={`envelope ${open ? 'is-open' : ''}`} viewBox="0 0 700 440" role="img" aria-label={`An envelope${d.to ? ` for ${d.to}` : ''}`}>
      <rect x={10} y={10} width={680} height={420} rx={10} fill={d.envelope} stroke="rgba(74,46,53,.3)" strokeWidth={2} />
      <path className="envelope-flap" d={open ? 'M10 10 L350 -150 L690 10' : 'M10 10 L350 240 L690 10'} fill={d.envelope} stroke="rgba(74,46,53,.3)" strokeWidth={2} style={{ filter: 'brightness(.96)' }} />
      <path d="M10 430 L300 220 M690 430 L400 220" stroke="rgba(74,46,53,.18)" strokeWidth={2} />
      <path d="M0 220 H700" stroke={d.ribbon} strokeWidth={14} opacity={0.9} />
      <g transform="translate(540 40)">
        <rect width={110} height={130} fill="#fffdf8" stroke="rgba(74,46,53,.35)" strokeDasharray="4 3" strokeWidth={3} />
        <svg x={12} y={14} width={86} height={100} viewBox={stamp.viewBox} overflow="visible">{stamp.render()}</svg>
      </g>
      <text x={350} y={330} textAnchor="middle" fontFamily="var(--font-script)" fontSize={42} fill="rgba(74,46,53,.85)">{d.to || '…'}</text>
      {!open && (
        <g className="wax-seal" transform="translate(350 236)">
          <circle r={44} fill={d.seal} />
          <circle r={34} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={3} />
          <text y={14} textAnchor="middle" fontSize={38} fill="rgba(255,255,255,.75)" fontFamily="var(--font-script)">{d.sealMark || '♥'}</text>
        </g>
      )}
    </svg>
  );
}

export function LettersPage() {
  const letters = useItems<LetterData>('letter');
  const [openId, setOpenId] = useState<string | null>(null);
  const create = async () => {
    const it = await itemsApi.create<LetterData>('letter', { ...DEFAULT, date: new Date().toISOString().slice(0, 10) }, { visibility: 'private' });
    letters.reload(); setOpenId(it.id);
  };
  const open = (letters.data ?? []).find((l) => l.id === openId);
  const list = [...(letters.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ModeShell mode="private">
      <SectionTitle title="The Writing Desk" sub="stationery · envelopes · wax seals" />
      {open ? <Desk key={open.id} letter={open} onClose={() => { setOpenId(null); letters.reload(); }} /> : (
        <>
          <div className="row wrap gap" style={{ justifyContent: 'center' }}><button className="btn" onClick={create}>+ Write a letter</button></div>
          {letters.loading && <Loading what="Filling the inkwell" />}
          {!letters.loading && list.length === 0 && <Empty title="A clean blotter" art="✉">Letters stay private drafts until you decide otherwise. They are never posted to the guestbook.</Empty>}
          <div className="letter-pile">
            {list.map((l, i) => (
              <button key={l.id} className="letter-card" style={{ ['--tilt' as any]: `${(i % 3) - 1}deg` }} onClick={() => setOpenId(l.id)} aria-label={`Letter to ${l.data.to || 'someone'}`}>
                <Envelope d={l.data} />
                <span className="smallcaps">{l.visibility === 'unlisted' ? 'shared by link' : l.data.finished ? 'finished' : 'draft'} · {prettyDate(l.updatedAt)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </ModeShell>
  );
}

function Desk({ letter, onClose }: { letter: Item<LetterData>; onClose: () => void }) {
  const { toast } = useStore();
  const [d, setD] = useState<LetterData>({ ...DEFAULT, ...letter.data });
  const [vis, setVis] = useState(letter.visibility);
  const [saved, setSaved] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0); const first = useRef(true);
  const set = (p: Partial<LetterData>) => setD((x) => ({ ...x, ...p }));
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved(false); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => { await itemsApi.update(letter.id, { data: d, replace: true }); setSaved(true); }, 600);
  }, [d, letter.id]);
  const flush = async () => { window.clearTimeout(timer.current); await itemsApi.update(letter.id, { data: d, replace: true }); };
  const share = async (on: boolean) => {
    await flush();
    await itemsApi.update(letter.id, { visibility: on ? 'unlisted' : 'private' });
    setVis(on ? 'unlisted' : 'private');
    toast(on ? 'Anyone with the link can now read this one letter.' : 'This letter is private again.', { essential: true });
  };
  const link = `${location.origin}/letter/${letter.id}`;
  const download = async (which: 'sheet' | 'envelope', kind: 'png' | 'svg') => {
    const svg = (which === 'sheet' ? sheetRef : envRef).current?.querySelector('svg');
    if (!svg) return;
    const [w, h] = which === 'sheet' ? [SHEET_W, SHEET_H] : [700, 440];
    const name = `letter to ${d.to || 'someone'}${which === 'envelope' ? ' (envelope)' : ''}`.replace(/[^\w\- ()]+/g, '');
    try { await (kind === 'png' ? downloadPng(svg, w, h, name) : downloadSvg(svg, w, h, name)); }
    catch (e: any) { toast(e.message); }
  };
  const remove = async () => { if (confirm('Tear up this letter? It will be deleted.')) { window.clearTimeout(timer.current); await itemsApi.remove(letter.id); onClose(); } };
  return (
    <div className="desk">
      <div className="desk-form lace-card">
        <div className="row wrap gap"><button className="btn small ghost" onClick={async () => { await flush(); onClose(); }}>← All letters</button><span className="muted small" aria-live="polite">{saved ? 'saved ♡' : 'saving…'}</span></div>
        <div className="row wrap gap">
          <Field label="To"><input className="input" value={d.to} onChange={(e) => set({ to: e.target.value })} placeholder="my dearest friend" /></Field>
          <Field label="Date"><input className="input" type="date" value={d.date ?? ''} onChange={(e) => set({ date: e.target.value })} /></Field>
        </div>
        <Field label="Your letter" hint="Leave a blank line between paragraphs."><textarea className="input" rows={10} value={d.body} onChange={(e) => set({ body: e.target.value })} /></Field>
        <div className="row wrap gap">
          <Field label="Closing"><input className="input" value={d.closing ?? ''} onChange={(e) => set({ closing: e.target.value })} /></Field>
          <Field label="From"><input className="input" value={d.from} onChange={(e) => set({ from: e.target.value })} /></Field>
        </div>
        <details className="desk-dress" open>
          <summary>Stationery, envelope & seal</summary>
          <div className="row wrap gap">
            <Field label="Stationery"><select className="input" value={d.stationery} onChange={(e) => set({ stationery: e.target.value })}>{Object.entries(STATIONERY).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
            <Field label="Lettering"><select className="input" value={d.font} onChange={(e) => set({ font: e.target.value })}>{Object.entries(FONTS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
            <Field label="Stamp"><select className="input" value={d.stamp} onChange={(e) => set({ stamp: e.target.value })}>{STAMPS.map((s) => <option key={s} value={s}>{ART[s]?.label ?? s}</option>)}</select></Field>
          </div>
          <div className="row wrap gap">
            <label className="mini-color">envelope <input type="color" value={d.envelope} onChange={(e) => set({ envelope: e.target.value })} /></label>
            <label className="mini-color">ribbon <input type="color" value={d.ribbon} onChange={(e) => set({ ribbon: e.target.value })} /></label>
            <label className="mini-color">wax <input type="color" value={d.seal} onChange={(e) => set({ seal: e.target.value })} /></label>
            <Field label="Seal mark"><select className="input" value={d.sealMark} onChange={(e) => set({ sealMark: e.target.value })}>{['♥', '✿', '★', '☾', '✉', ...'ABCDEFGHIJKLMNOPRSTW'].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
          </div>
        </details>
        <label className="check"><input type="checkbox" checked={!!d.finished} onChange={(e) => { set({ finished: e.target.checked }); if (e.target.checked) award('letter-writer'); }} /> finished</label>
        <section className="desk-share">
          <h3 className="smallcaps">sharing · optional</h3>
          {vis === 'unlisted' ? (
            <>
              <p className="small">Shared by link. Only someone with this exact address can read it; it isn't listed anywhere.</p>
              <p className="row wrap gap"><input className="input" readOnly value={link} aria-label="Link to this letter" onFocus={(e) => e.target.select()} />
                <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copied ♡'))}>Copy</button>
                <Link className="btn small ghost" to={`/letter/${letter.id}`}>Preview</Link>
                <button className="btn small" onClick={() => share(false)}>Stop sharing</button></p>
            </>
          ) : <p className="small">This letter is private. <button className="linkish" onClick={() => share(true)}>Share by link…</button></p>}
        </section>
        <div className="row wrap gap">
          <button className="btn small" onClick={() => download('sheet', 'png')}>Download letter (PNG)</button>
          <button className="btn small ghost" onClick={() => download('sheet', 'svg')}>…SVG</button>
          <button className="btn small ghost" onClick={() => download('envelope', 'png')}>Download envelope</button>
          <button className="btn small danger" onClick={remove}>Tear up</button>
        </div>
      </div>
      <div className="desk-preview">
        <div ref={envRef}><Envelope d={d} /></div>
        <div ref={sheetRef}><LetterSheet d={d} /></div>
      </div>
    </div>
  );
}

/** What someone holding the link sees: an envelope that opens when they break the seal. */
export function LetterViewPage() {
  const { id } = useParams();
  const [letter, setLetter] = useState<Item<LetterData> | null | undefined>();
  const [open, setOpen] = useState(false);
  useEffect(() => { itemsApi.get<LetterData>(id!).then((l) => setLetter(l.kind === 'letter' ? l : null), () => setLetter(null)); }, [id]);
  return (
    <div className="page letter-view-page">
      <header className="page-header"><TopNav /></header>
      <main className="page-main narrow" id="main">
        {letter === undefined && <Loading what="Fetching the post" />}
        {letter === null && <div className="paper-sheet center"><p className="script big">No letter here</p><p>It may have been kept private again, or the address isn't quite right.</p><Link className="btn" to="/">To the village</Link></div>}
        {letter && (
          <div className="letter-view">
            {!open ? (
              <button className="envelope-button" onClick={() => setOpen(true)} aria-label="Break the seal and open the letter"><Envelope d={{ ...DEFAULT, ...letter.data }} /><span className="smallcaps">tap to break the seal</span></button>
            ) : <div className="letter-opened"><LetterSheet d={{ ...DEFAULT, ...letter.data }} /></div>}
          </div>
        )}
      </main>
    </div>
  );
}
