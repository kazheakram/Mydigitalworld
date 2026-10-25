import { useEffect, useRef, useState } from 'react';
import type { Item, SceneObject } from '../../shared/types';
import { items as itemsApi } from '../lib/api';
import { useStore } from '../lib/store';
import { award } from '../lib/progress';
import { downloadPng, downloadSvg } from '../lib/exportImage';
import { uid } from '../lib/util';
import { useItems } from '../rooms/common';
import { SceneEditor, useHistory } from '../atelier/SceneEditor';
import { Scene } from '../world/Scene';
import { tok } from '../art/palette';
import { Empty, Field, Loading, Modal } from '../ui/kit';
import { ModeShell, SectionTitle } from './Shell';

// The Scrapbook studio: books of pages arranged with the same editor as the village and rooms —
// photos (with frames), stickers from the artwork library, handwritten captions and links.
// Every page can be downloaded as a picture.

export const PAGE_W = 1000; export const PAGE_H = 750;
export interface ScrapPage { id: string; paper: string; objects: SceneObject[] }
export interface ScrapbookData { title: string; coverColor?: string; pages: ScrapPage[] }
export const PAPERS = [{ id: 'cream', name: 'Cream card' }, { id: 'kraft', name: 'Kraft paper' }, { id: 'gingham', name: 'Pink gingham' }, { id: 'lined', name: 'Lined notebook' }, { id: 'midnight', name: 'Midnight velvet' }];
const newPage = (): ScrapPage => ({ id: uid('pg-'), paper: 'cream', objects: [] });

export function Paper({ paper, id = 'sp' }: { paper: string; id?: string }) {
  const fill = { cream: '#fbf3e6', kraft: '#d8bd98', gingham: '#fdf0f2', lined: '#fffdf8', midnight: '#2f2236' }[paper] ?? '#fbf3e6';
  return (
    <g aria-hidden>
      <defs>
        <pattern id={`${id}-gingham`} width={40} height={40} patternUnits="userSpaceOnUse"><rect width={20} height={40} fill={tok('pink')} opacity={0.28} /><rect width={40} height={20} fill={tok('pink')} opacity={0.28} /></pattern>
        <pattern id={`${id}-lined`} width={40} height={34} patternUnits="userSpaceOnUse"><path d="M0 33 H40" stroke="#b8c7de" strokeWidth={1.2} /></pattern>
        <pattern id={`${id}-kraft`} width={8} height={8} patternUnits="userSpaceOnUse"><circle cx={2} cy={3} r={0.7} fill="#a98a64" opacity={0.5} /><circle cx={6} cy={7} r={0.6} fill="#fff" opacity={0.3} /></pattern>
      </defs>
      <rect width={PAGE_W} height={PAGE_H} fill={fill} />
      {paper === 'gingham' && <rect width={PAGE_W} height={PAGE_H} fill={`url(#${id}-gingham)`} />}
      {paper === 'lined' && <><rect width={PAGE_W} height={PAGE_H} fill={`url(#${id}-lined)`} /><path d={`M80 0 V${PAGE_H}`} stroke="#e8a1b0" strokeWidth={2} /></>}
      {paper === 'kraft' && <rect width={PAGE_W} height={PAGE_H} fill={`url(#${id}-kraft)`} />}
      {paper === 'midnight' && Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 337) % PAGE_W} cy={(i * 191) % PAGE_H} r={i % 4 ? 1.2 : 2} fill="#ffe9b8" opacity={0.7} />)}
    </g>
  );
}

export function ScrapbookPage() {
  const books = useItems<ScrapbookData>('scrapbook');
  const [openId, setOpenId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState('');
  const create = async () => {
    const it = await itemsApi.create<ScrapbookData>('scrapbook', { title: title.trim() || 'A new scrapbook', coverColor: '#e8a1b0', pages: [newPage()] });
    setNaming(false); setTitle(''); books.reload(); setOpenId(it.id);
  };
  const open = (books.data ?? []).find((b) => b.id === openId);
  return (
    <ModeShell mode="private">
      <SectionTitle title="Scrapbook Studio" sub="photos · papers · stickers · little captions" />
      {open ? <ScrapbookEditor key={open.id} book={open} onClose={() => { setOpenId(null); books.reload(); }} onDeleted={() => { setOpenId(null); books.reload(); }} /> : (
        <>
          <div className="row wrap gap" style={{ justifyContent: 'center' }}><button className="btn" onClick={() => setNaming(true)}>+ A new scrapbook</button></div>
          {books.loading && <Loading what="Finding the glue" />}
          {!books.loading && !books.data?.length && <Empty title="No scrapbooks yet" art="✂">Start one for a summer, a trip, a person or a season.</Empty>}
          <div className="scrapbook-shelf">
            {(books.data ?? []).map((b, i) => (
              <button key={b.id} className="scrapbook-cover" style={{ background: b.data.coverColor ?? '#e8a1b0', ['--tilt' as any]: `${(i % 3) - 1}deg` }} onClick={() => setOpenId(b.id)} aria-label={`Open ${b.data.title}`}>
                <span className="scrapbook-label"><strong className="script">{b.data.title}</strong><small>{b.data.pages.length} page{b.data.pages.length === 1 ? '' : 's'}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      <Modal open={naming} onClose={() => setNaming(false)} title="A new scrapbook">
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer by the sea…" onKeyDown={(e) => e.key === 'Enter' && create()} /></Field>
        <div className="form-actions"><button className="btn ghost" onClick={() => setNaming(false)}>Cancel</button><button className="btn" onClick={create}>Begin</button></div>
      </Modal>
    </ModeShell>
  );
}

function ScrapbookEditor({ book, onClose, onDeleted }: { book: Item<ScrapbookData>; onClose: () => void; onDeleted: () => void }) {
  const { toast } = useStore();
  const [data, setData] = useState<ScrapbookData>(book.data);
  const [pageIdx, setPageIdx] = useState(0);
  const page = data.pages[pageIdx] ?? data.pages[0];
  const hist = useHistory<SceneObject[]>(page?.objects ?? []);
  const [saved, setSaved] = useState(true);
  const exportRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  // Switching pages starts a fresh undo history for that page.
  useEffect(() => { hist.reset(data.pages[pageIdx]?.objects ?? []); }, [pageIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the book in step with the editor, and save a moment after each change.
  useEffect(() => {
    if (!page || hist.value === page.objects) return;
    setData((d) => ({ ...d, pages: d.pages.map((p, i) => (i === pageIdx ? { ...p, objects: hist.value } : p)) }));
  }, [hist.value]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await itemsApi.update(book.id, { data, replace: true });
      setSaved(true);
      if (data.pages.reduce((n, p) => n + p.objects.length, 0) >= 3) award('scrapbooker');
    }, 700);
  }, [data, book.id]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flush = async () => { window.clearTimeout(timer.current); await itemsApi.update(book.id, { data, replace: true }); setSaved(true); };

  const setPaper = (paper: string) => setData((d) => ({ ...d, pages: d.pages.map((p, i) => (i === pageIdx ? { ...p, paper } : p)) }));
  const addPage = () => { setData((d) => ({ ...d, pages: [...d.pages, newPage()] })); setPageIdx(data.pages.length); };
  const removePage = () => {
    if (data.pages.length < 2 || !confirm('Remove this page from the scrapbook?')) return;
    setData((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pageIdx) })); setPageIdx(Math.max(0, pageIdx - 1));
  };
  const exportAs = async (kind: 'png' | 'svg') => {
    const svg = exportRef.current?.querySelector('svg');
    if (!svg) return;
    const name = `${data.title.replace(/[^\w\- ]+/g, '').trim() || 'scrapbook'} - page ${pageIdx + 1}`;
    try { await (kind === 'png' ? downloadPng(svg, PAGE_W, PAGE_H, name) : downloadSvg(svg, PAGE_W, PAGE_H, name)); }
    catch (e: any) { toast(e.message); }
  };
  const remove = async () => {
    if (!confirm(`Delete “${data.title}” and all its pages? Images stay in your media library.`)) return;
    await itemsApi.remove(book.id); onDeleted();
  };
  return (
    <div className="scrapbook-editor">
      <div className="row wrap gap scrapbook-tools">
        <button className="btn small ghost" onClick={async () => { await flush(); onClose(); }}>← All scrapbooks</button>
        <input className="input" aria-label="Scrapbook title" value={data.title} onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))} />
        <label className="mini-color">cover <input type="color" value={data.coverColor ?? '#e8a1b0'} onChange={(e) => setData((d) => ({ ...d, coverColor: e.target.value }))} /></label>
        <span className="muted small" aria-live="polite">{saved ? 'saved ♡' : 'saving…'}</span>
      </div>
      <div className="row wrap gap scrapbook-pages" role="tablist" aria-label="Pages">
        {data.pages.map((p, i) => <button key={p.id} role="tab" aria-selected={i === pageIdx} className={`chip ${i === pageIdx ? 'on' : ''}`} onClick={() => setPageIdx(i)}>page {i + 1}</button>)}
        <button className="btn small ghost" onClick={addPage}>+ page</button>
        {data.pages.length > 1 && <button className="btn small ghost" onClick={removePage}>remove this page</button>}
        <label className="row gap"><span className="smallcaps">paper</span>
          <select className="input" aria-label="Paper" value={page.paper} onChange={(e) => setPaper(e.target.value)}>{PAPERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <button className="btn small" onClick={() => exportAs('png')}>Download page as PNG</button>
        <button className="btn small ghost" onClick={() => exportAs('svg')}>…as SVG</button>
        <button className="btn small danger" onClick={remove}>Delete scrapbook</button>
      </div>
      <SceneEditor kind="room" width={PAGE_W} height={PAGE_H} objects={hist.value} onChange={hist.commit} background={<Paper paper={page.paper} id={`ed-${page.id}`} />}
        toolbarExtra={<span className="tool-group"><button className="icon-btn" onClick={hist.undo} disabled={!hist.canUndo} aria-label="Undo">↶</button><button className="icon-btn" onClick={hist.redo} disabled={!hist.canRedo} aria-label="Redo">↷</button></span>} />
      <p className="muted small">Tip: stickers are in the artwork shelf (bows, hearts, stamps, butterflies, pearls); add photos from your media library and pick a frame; use text for captions.</p>
      {/* A clean copy of the page (no editing handles) used for downloads. */}
      <div ref={exportRef} className="export-stage" aria-hidden>
        <Scene width={PAGE_W} height={PAGE_H} objects={hist.value} ariaLabel="page" background={<Paper paper={page.paper} id={`ex-${page.id}`} />} showLabels="always" />
      </div>
    </div>
  );
}
