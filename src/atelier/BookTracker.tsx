import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SYNC_FIELDS, canon, suggestMapping, verifyMapping, type ColumnMap, type Direction, type SheetGrid, type SyncConfig, type SyncPlan } from '../../shared/bookSync';
import { useStore } from '../lib/store';
import { useFeature } from '../lib/features';
import { downloadBackup } from '../lib/backup';
import {
  addToSheet, google, loadState, preview, resolveClear, resolveConflict, saveState, shelvesOf, syncNow, unlinkBook,
  type GoogleStatus, type Tab, type TrackerState,
} from '../lib/trackerSync';
import { timeAgo } from '../lib/util';
import { AtelierShell } from './Atelier';

// The Book Tracker Connection: links the Library with the owner's Google Sheets book tracker.
// Read-only until a clean first import has proved the column choices; two-way only on request,
// and only after a backup copy of the sheet exists in Google Drive.

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: 'sync', label: 'Both ways' },
  { id: 'import', label: 'Sheet → Ribbonmere only' },
  { id: 'ignore', label: 'Stays in the sheet' },
];
const show = (v: unknown) => { const s = canon(v); return s === '' ? '— empty —' : s.length > 80 ? `${s.slice(0, 80)}…` : s; };
const REASONS: Record<string, string> = {
  'not-configured': 'Google is not set up for this site yet.', state: 'The sign-in link had expired or came from another browser. Please try again.',
  token: "Google didn't hand over access. Please try again.", scope: "The Google permission wasn't granted.", access_denied: 'You chose not to connect. Nothing changed.',
};

export function BookTrackerPage() {
  const { world, updateWorld, toast } = useStore();
  const feature = useFeature('bookSync');
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [state, setState] = useState<TrackerState | null>(null);
  const [tabs, setTabs] = useState<Tab[] | null>(null);
  const [grid, setGrid] = useState<SheetGrid | null>(null);
  const [draft, setDraft] = useState<SyncConfig | null>(null);
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const libraries = world.rooms.filter((r) => r.template === 'library');

  const reload = async () => {
    try {
      const [st, s] = await Promise.all([google.status(), loadState()]);
      setStatus(st); setState(s);
      if (!draft && s.config) setDraft(s.config);
    } catch (e: any) { setProblem(e.message); }
  };
  useEffect(() => { void reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const g = params.get('google');
    if (!g) return;
    if (g === 'connected') toast('Google is connected ♡ Ribbonmere can only see the spreadsheet you choose.', { essential: true });
    else setProblem(REASONS[params.get('reason') ?? ''] ?? `Google said: ${params.get('reason')}`);
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setProblem(null);
    try { await fn(); } catch (e: any) { setProblem(e.message ?? String(e)); } finally { setBusy(null); await reload(); }
  };

  // ── choosing the spreadsheet ──
  const chooseSheet = (spreadsheet: string) => run('Opening the spreadsheet…', async () => {
    const t = await google.select(spreadsheet);
    setTabs(t.tabs); setGrid(null); setPlan(null);
    if (draft?.spreadsheetId !== t.id) setDraft(null);
    toast(`Found "${t.name}" with ${t.tabs.length} tabs.`);
  });
  const openPicker = () => run('Opening Google Drive…', async () => {
    const cfg = await google.pickerToken();
    const win = window.open('/api/google/picker', 'rm-picker', 'width=760,height=620');
    if (!win) throw new Error('Your browser blocked the pop-up. Allow pop-ups for this site, or paste the link instead.');
    const picked = await new Promise<{ id: string } | null>((resolve) => {
      const onMsg = (e: MessageEvent) => {
        if (e.origin !== location.origin || e.source !== win) return;
        if (e.data?.type === 'rm-picker-ready') win.postMessage({ type: 'rm-picker-config', ...cfg }, location.origin);
        if (e.data?.type === 'rm-picker-picked') { done(); resolve({ id: String(e.data.id) }); }
        if (e.data?.type === 'rm-picker-cancel' || e.data?.type === 'rm-picker-error') { done(); resolve(null); }
      };
      const timer = setInterval(() => { if (win.closed) { done(); resolve(null); } }, 800);
      const done = () => { window.removeEventListener('message', onMsg); clearInterval(timer); };
      window.addEventListener('message', onMsg);
    });
    if (picked) await chooseSheet(picked.id);
  });
  const loadTabs = () => run('Reading the tabs…', async () => setTabs((await google.tabs()).tabs));
  const chooseTab = (gid: number) => run('Reading the sheet (nothing is changed)…', async () => {
    const g = await google.read(gid);
    setGrid(g); setPlan(null);
    const roomId = draft?.roomId ?? libraries[0]?.id ?? 'library';
    const m = suggestMapping(g, shelvesOf(world, roomId));
    if (m.error) throw new Error(`${m.error} Choose the tab that holds your book list.`);
    const same = draft && draft.gid === gid && draft.spreadsheetId === status?.sheet?.id;
    setDraft(same ? draft : { spreadsheetId: status!.sheet!.id, spreadsheetName: status!.sheet!.name, gid, sheetTitle: g.title, headerRow: m.headerRow, columns: m.columns, roomId, visibility: 'private' });
  });
  const loadGrid = () => draft && chooseTab(draft.gid);

  const samples = useMemo(() => {
    if (!grid || !draft) return new Map<number, string>();
    const title = draft.columns.find((c) => c.field === 'title')?.col ?? 1;
    const row = grid.rows.slice(draft.headerRow + 1).find((r) => canon(r[title]?.v) !== '');
    return new Map(draft.columns.map((c) => [c.col, row?.[c.col]?.f && /^=IMAGE/i.test(row[c.col].f!) ? '🖼 picture' : row?.[c.col]?.v ?? '']));
  }, [grid, draft]);
  const check = useMemo(() => (draft && grid ? verifyMapping(draft, grid) : null), [draft, grid]);

  const setCol = (col: number, patch: Partial<ColumnMap>) => setDraft((d) => d && ({ ...d, columns: d.columns.map((c) => (c.col === col ? { ...c, ...patch } : c)) }));
  const saveConfig = () => draft && run('Saving the column choices…', async () => {
    const changed = JSON.stringify(state?.config) !== JSON.stringify(draft);
    // New column choices must prove themselves again before Ribbonmere writes to the sheet.
    if (changed && state?.twoWay) await google.allowWrites(false);
    await saveState({ config: draft, ...(changed && state?.firstImportAt ? { verified: false, twoWay: false } : {}) });
    toast('Column choices saved ♡');
  });
  const doPreview = (force = false) => draft && run('Reading the sheet and comparing (nothing is changed)…', async () => {
    const { plan: p } = await preview(world, { config: draft, force });
    setPlan(p);
    if (p.error) setProblem(p.error);
  });
  const backupRibbonmere = () => run('Preparing a Ribbonmere backup…', async () => {
    await downloadBackup(false, 'before-book-tracker');
    await saveState({ ribbonmereBackupAt: new Date().toISOString() });
  });
  const firstImport = () => draft && run('Importing your books…', async () => {
    await saveState({ config: draft });
    const r = await syncNow(world, updateWorld, { first: true });
    setPlan(null);
    toast(`Imported ♡ ${r.state.lastSync?.summary}.`, { essential: true });
  });
  const sync = (force = false) => run('Syncing…', async () => {
    const r = await syncNow(world, updateWorld, { force });
    toast(`Synced: ${r.state.lastSync?.summary}.`);
  });
  const setTwoWay = (on: boolean) => run(on ? 'Switching on two-way sync…' : 'Back to read-only…', async () => {
    await google.allowWrites(on);
    await saveState({ twoWay: on });
    toast(on ? 'Two-way sync is on. Changes you make here will be written into your sheet, one cell at a time.' : 'Read-only again: Ribbonmere will not change your sheet.');
  });
  const disconnect = () => {
    if (!confirm('Disconnect Google? Your books stay in the Library exactly as they are, and your spreadsheet is not changed. Ribbonmere will forget its access.')) return;
    void run('Disconnecting…', async () => {
      const r = await google.disconnect();
      await saveState({ twoWay: false });
      toast(r.revoked ? 'Disconnected, and Google access was removed ♡' : 'Disconnected. (Google could not be reached to remove access — you can remove "Ribbonmere" at myaccount.google.com/permissions.)', { essential: true });
    });
  };

  if (!status || !state) {
    return <AtelierShell><section className="lace-card tracker"><h2 className="script">Book Tracker Connection</h2>{problem ? <p className="tracker-problem" role="alert">{problem}</p> : <p className="muted">Looking for your book tracker…</p>}</section></AtelierShell>;
  }

  const mode = !status.connected ? 'Not connected' : !state.firstImportAt ? 'Connected · not imported yet' : state.twoWay && status.allowWrites ? 'Two-way' : 'Read-only';
  const canTwoWay = !!state.firstImportAt && state.verified && !state.lastError;
  const sheetMatches = status.sheet && state.config?.spreadsheetId === status.sheet.id;

  return (
    <AtelierShell>
      <div className="tracker">
        <section className="lace-card tracker-head">
          <div className="row wrap gap between">
            <div>
              <h2 className="script">Book Tracker Connection</h2>
              <p className="muted">Keep your Library and your Google Sheets book tracker in step. Optional, reversible, and your sheet's layout, formulas and formatting are never changed.</p>
            </div>
            <span className={`tracker-pill ${status.connected ? 'on' : ''}`} role="status">{mode}{feature.mode === 'off' ? ' · resting' : ''}</span>
          </div>
          {busy && <p className="muted" role="status">🎀 {busy}</p>}
          {problem && <p className="tracker-problem" role="alert">{problem}</p>}
          {!status.configured && (
            <div className="tracker-note">
              <p><strong>Google isn't set up for this site yet.</strong> It takes about ten minutes, is free, and is explained step by step in the Owner's Guide (“Connecting your Google Sheets book tracker”).</p>
              <p className="muted">When Google asks for the <em>authorised redirect URI</em>, use: <code>{status.redirectUri}</code></p>
            </div>
          )}
          {status.configured && !status.connected && (
            <div className="row wrap gap">
              <button className="btn" disabled={!!busy} onClick={() => run('Asking Google…', async () => { location.href = (await google.connect()).url; })}>Connect Google</button>
              <span className="muted">Ribbonmere asks for the smallest permission Google offers: access only to the spreadsheet you pick.</span>
            </div>
          )}
          {status.connected && (
            <dl className="tracker-facts">
              <div><dt>Spreadsheet</dt><dd>{status.sheet?.name ?? 'not chosen yet'}</dd></div>
              <div><dt>Tab</dt><dd>{sheetMatches ? state.config!.sheetTitle : '—'}</dd></div>
              <div><dt>Direction</dt><dd>{state.twoWay && status.allowWrites ? 'Both ways' : 'Sheet → Ribbonmere (read-only)'}</dd></div>
              <div><dt>When</dt><dd>{state.schedule === 'auto' ? 'Automatically while Ribbonmere is open (at most every 15 minutes)' : 'Only when you press Sync now'}</dd></div>
              <div><dt>Last successful sync</dt><dd>{state.lastSync ? `${timeAgo(state.lastSync.at)} — ${state.lastSync.summary}` : 'never'}</dd></div>
              <div><dt>Drive backup copy</dt><dd>{status.backup ? <>{status.backup.url ? <a href={status.backup.url} target="_blank" rel="noreferrer">{status.backup.name}</a> : status.backup.name}</> : 'none yet'}</dd></div>
            </dl>
          )}
        </section>

        {status.connected && (
          <section className="lace-card">
            <h3 className="script">1 · Your spreadsheet</h3>
            <div className="row wrap gap">
              {status.pickerReady && <button className="btn" disabled={!!busy} onClick={openPicker}>{status.sheet ? 'Choose a different spreadsheet' : 'Pick from Google Drive'}</button>}
              <form className="row wrap gap" onSubmit={(e) => { e.preventDefault(); if (link.trim()) void chooseSheet(link.trim()); }}>
                <label className="sr-only" htmlFor="tracker-link">Spreadsheet link</label>
                <input id="tracker-link" className="input" placeholder="…or paste the spreadsheet's link" value={link} onChange={(e) => setLink(e.target.value)} />
                <button className="btn ghost" disabled={!!busy || !link.trim()}>Use this link</button>
              </form>
            </div>
            <p className="muted small">{status.pickerReady ? 'Google only lets Ribbonmere open files you choose in the picker; a pasted link works once a file has been picked.' : 'The Google Picker is not set up (GOOGLE_API_KEY and GOOGLE_APP_ID), so paste the link instead.'}</p>
            {status.sheet && (
              <div className="row wrap gap">
                {!tabs && <button className="btn small ghost" disabled={!!busy} onClick={loadTabs}>Show the tabs of “{status.sheet.name}”</button>}
                {tabs && (
                  <label className="row gap">Tab with your books
                    <select className="input" value={draft?.gid ?? ''} onChange={(e) => chooseTab(Number(e.target.value))}>
                      <option value="" disabled>choose…</option>
                      {tabs.map((t) => <option key={t.gid} value={t.gid}>{t.title}</option>)}
                    </select>
                  </label>
                )}
                {draft && !grid && sheetMatches && <button className="btn small ghost" disabled={!!busy} onClick={loadGrid}>Re-read “{draft.sheetTitle}”</button>}
              </div>
            )}
          </section>
        )}

        {status.connected && draft && grid && (
          <section className="lace-card">
            <h3 className="script">2 · Columns</h3>
            <p className="muted">Found the header on row {draft.headerRow + 1}. Choose what each column means. Columns calculated by a formula can only be read; anything set to <em>Stays in the sheet</em> is never read or written.</p>
            <div className="tracker-table-wrap">
              <table className="tracker-table">
                <thead><tr><th scope="col">Column</th><th scope="col">First book</th><th scope="col">In Ribbonmere</th><th scope="col">Sync</th></tr></thead>
                <tbody>
                  {draft.columns.filter((c) => c.header).map((c) => (
                    <tr key={c.col} className={c.direction === 'ignore' ? 'off' : ''}>
                      <th scope="row">{c.header}{c.formula && <span className="tracker-badge" title="Calculated by a formula">formula</span>}</th>
                      <td className="muted">{samples.get(c.col) || '—'}</td>
                      <td>
                        <select className="input" aria-label={`Ribbonmere field for ${c.header}`} value={c.field ?? ''} onChange={(e) => setCol(c.col, { field: (e.target.value || null) as any, direction: e.target.value ? (c.formula || e.target.value === 'cover' ? 'import' : c.direction === 'ignore' ? 'sync' : c.direction) : 'ignore' })}>
                          <option value="">— not in Ribbonmere —</option>
                          {SYNC_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="input" aria-label={`How ${c.header} syncs`} value={c.direction} disabled={!c.field} onChange={(e) => setCol(c.col, { direction: e.target.value as Direction })}>
                          {DIRECTIONS.filter((d) => d.id !== 'sync' || (!c.formula && c.field !== 'cover')).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {draft.columns.filter((c) => c.values && c.direction !== 'ignore').map((c) => (
              <div key={c.col} className="tracker-values">
                <h4 className="smallcaps">{c.header}: sheet value → Ribbonmere</h4>
                {Object.entries(c.values!).map(([sv, rv]) => (
                  <label key={sv} className="row gap">
                    <span className="tracker-chip">{sv}</span> →
                    <select className="input" value={rv} onChange={(e) => setCol(c.col, { values: { ...c.values!, [sv]: e.target.value } })}>
                      {[...new Set([rv, ...(c.field === 'format' ? ['Paper', 'E-book', 'Audiobook'] : shelvesOf(world, draft.roomId))])].map((o) => <option key={o} value={o}>{o}{c.field === 'shelf' && !shelvesOf(world, draft.roomId).includes(o) ? ' (new shelf)' : ''}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            ))}
            <div className="row wrap gap">
              <label className="row gap">Library
                <select className="input" value={draft.roomId} onChange={(e) => setDraft({ ...draft, roomId: e.target.value })}>
                  {libraries.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="row gap">New books are
                <select className="input" value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as 'private' | 'public' })}>
                  <option value="private">private (only you)</option>
                  <option value="public">public</option>
                </select>
              </label>
            </div>
            {check && !check.ok && <ul className="tracker-problem">{check.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <div className="row wrap gap">
              <button className="btn" disabled={!!busy || !check?.ok} onClick={saveConfig}>Save column choices</button>
              <button className="btn ghost" disabled={!!busy || !check?.ok} onClick={() => doPreview()}>Preview {state.firstImportAt ? 'the next sync' : 'the import'}</button>
            </div>
            <p className="muted small">Secret messages, shelf order, cloth colours and bookshop notes always stay in Ribbonmere only.</p>
          </section>
        )}

        {plan && !plan.error && (
          <section className="lace-card tracker-preview" aria-label="Preview">
            <h3 className="script">{state.firstImportAt ? 'What the next sync would do' : '3 · Preview of the first import'}</h3>
            <p>Nothing has changed yet. Found <strong>{plan.sheetBooks}</strong> books in the sheet.</p>
            <ul className="tracker-summary">
              <li><strong>{plan.creates.length}</strong> new book{plan.creates.length === 1 ? '' : 's'} for the Library</li>
              <li><strong>{plan.updates.filter((u) => u.changes.length).length}</strong> existing book{plan.updates.length === 1 ? '' : 's'} updated from the sheet</li>
              {state.twoWay && <li><strong>{plan.writes.length}</strong> cell{plan.writes.length === 1 ? '' : 's'} to write into the sheet</li>}
              <li><strong>{plan.conflicts.length}</strong> question{plan.conflicts.length === 1 ? '' : 's'} where the two differ (nothing is overwritten)</li>
              {plan.missing.length > 0 && <li><strong>{plan.missing.length}</strong> linked book{plan.missing.length === 1 ? '' : 's'} not found in the sheet — kept, never deleted</li>}
              {plan.newShelves.length > 0 && <li>New shelves: {plan.newShelves.join(', ')}</li>}
            </ul>
            {plan.duplicates.length > 0 && (
              <div className="tracker-note">
                <p><strong>These look like the same book on more than one row</strong> (a re-read?). Both are imported unless you skip the later one:</p>
                {plan.duplicates.map((d) => {
                  const later = plan.creates.filter((c) => c.duplicateOf && d.rows.includes(c.row));
                  return later.map((c) => (
                    <label key={c.key} className="check"><input type="checkbox" checked={!!draft?.skipKeys?.includes(c.key)} onChange={(e) => setDraft((x) => x && ({ ...x, skipKeys: e.target.checked ? [...(x.skipKeys ?? []), c.key] : (x.skipKeys ?? []).filter((k) => k !== c.key) }))} /> Skip row {c.row}: “{d.title}” (also on row {c.duplicateOf})</label>
                  ));
                })}
              </div>
            )}
            {plan.warnings.length > 0 && <details><summary>{plan.warnings.length} note{plan.warnings.length === 1 ? '' : 's'}</summary><ul>{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul></details>}
            {plan.creates.length > 0 && (
              <div className="tracker-table-wrap">
                <table className="tracker-table">
                  <caption className="smallcaps">The first few new books</caption>
                  <thead><tr><th scope="col">Row</th><th scope="col">Title</th><th scope="col">Author</th><th scope="col">Shelf</th><th scope="col">Hearts</th><th scope="col">Finished</th></tr></thead>
                  <tbody>{plan.creates.slice(0, 8).map((c) => <tr key={c.key}><td>{c.row}</td><td>{c.title}</td><td>{c.data.author}</td><td>{c.data.shelf}</td><td>{c.data.rating ? '♥'.repeat(c.data.rating) : ''}</td><td>{c.data.finishedOn}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {!state.firstImportAt ? (
              <ol className="restore-steps">
                <li><button className="btn ghost" disabled={!!busy} onClick={backupRibbonmere}>Download a Ribbonmere backup first</button> {state.ribbonmereBackupAt && <span className="muted">✓ saved {timeAgo(state.ribbonmereBackupAt)}</span>}</li>
                <li><button className="btn" disabled={!!busy || !state.ribbonmereBackupAt || plan.creates.length + plan.updates.length === 0} onClick={firstImport}>Import {plan.creates.length} book{plan.creates.length === 1 ? '' : 's'}</button> <span className="muted">Read-only: your sheet is not changed.</span></li>
              </ol>
            ) : <button className="btn" disabled={!!busy} onClick={() => sync()}>Sync now</button>}
          </section>
        )}

        {status.connected && state.firstImportAt && (
          <section className="lace-card">
            <h3 className="script">Sync</h3>
            <div className="row wrap gap">
              <button className="btn" disabled={!!busy || feature.mode === 'off' || !sheetMatches} onClick={() => sync()}>Sync now</button>
              {state.lastError && /Sync anyway/.test(state.lastError.message) && <button className="btn ghost" disabled={!!busy} onClick={() => confirm('Sync anyway? Books that are no longer in the sheet are only flagged, never deleted.') && sync(true)}>Sync anyway</button>}
            </div>
            {state.lastError && <p className="tracker-problem" role="alert">Last try, {timeAgo(state.lastError.at)}: {state.lastError.message}</p>}
            {feature.mode === 'off' && <p className="muted">The Book Tracker is resting, so nothing syncs. Wake it in <Link to="/atelier/features">Features</Link>.</p>}
            <fieldset className="tracker-choice">
              <legend>When</legend>
              <label className="check"><input type="radio" name="when" checked={state.schedule === 'auto'} onChange={() => run('Saving…', () => saveState({ schedule: 'auto' }))} /> Automatically while Ribbonmere is open (at most every 15 minutes)</label>
              <label className="check"><input type="radio" name="when" checked={state.schedule === 'manual'} onChange={() => run('Saving…', () => saveState({ schedule: 'manual' }))} /> Manual — only when I press Sync now</label>
            </fieldset>
            <fieldset className="tracker-choice">
              <legend>Direction</legend>
              <label className="check"><input type="radio" name="dir" checked={!(state.twoWay && status.allowWrites)} onChange={() => setTwoWay(false)} /> Read-only — the sheet is the source; Ribbonmere never changes it</label>
              <label className="check"><input type="radio" name="dir" disabled={!canTwoWay || !status.backup} checked={state.twoWay && status.allowWrites} onChange={() => setTwoWay(true)} /> Two-way — edits on either side are carried over, cell by cell</label>
              {!canTwoWay && <p className="muted small">Two-way unlocks after a clean sync with the current column choices.</p>}
              {canTwoWay && !status.backup && (
                <p><button className="btn small" disabled={!!busy} onClick={() => run('Copying your spreadsheet in Google Drive…', () => google.backup())}>Make a backup copy in Google Drive</button> <span className="muted small">Required before two-way. The copy is a new file in your Drive; the original is not touched.</span></p>
              )}
              {status.backup && <p className="muted small">Backup copy made {timeAgo(status.backup.at)}. <button className="linkish" disabled={!!busy} onClick={() => run('Copying…', () => google.backup())}>Make a fresh one</button></p>}
            </fieldset>
          </section>
        )}

        {(state.conflicts.length > 0 || state.clears.length > 0 || state.missing.length > 0 || (state.twoWay && state.appOnly.length > 0)) && (
          <section className="lace-card" aria-label="Questions for you">
            <h3 className="script">Questions for you</h3>
            {state.conflicts.map((c) => (
              <div key={`${c.bookId}${c.field}`} className="tracker-conflict">
                <p><strong>{c.title}</strong> · {c.label} {c.reason === 'sheetCleared' ? '— emptied in the sheet' : c.reason === 'first' ? '— different in the two places' : '— changed in both places'}</p>
                <div className="tracker-sides">
                  <div><span className="smallcaps">Sheet (row {c.row})</span><p>{show(c.sheet)}</p></div>
                  <div><span className="smallcaps">Ribbonmere</span><p>{show(c.app)}</p></div>
                </div>
                <div className="row wrap gap">
                  <button className="btn small ghost" disabled={!!busy} onClick={() => run('Saving your choice…', () => resolveConflict(c, 'sheet'))}>Use the sheet's</button>
                  <button className="btn small ghost" disabled={!!busy} onClick={() => run('Saving your choice…', () => resolveConflict(c, 'app'))}>Keep Ribbonmere's{state.twoWay ? ' (and write it to the sheet)' : ''}</button>
                </div>
              </div>
            ))}
            {state.clears.map((w) => (
              <div key={`${w.bookId}${w.field}c`} className="tracker-conflict">
                <p>You emptied <strong>{SYNC_FIELDS.find((f) => f.id === w.field)?.label}</strong> on a book in Ribbonmere. The sheet (row {w.row}) still says: “{show(w.expect)}”.</p>
                <div className="row wrap gap">
                  <button className="btn small ghost" disabled={!!busy} onClick={() => run('Emptying that cell…', () => resolveClear(w, state.config!.gid, true))}>Empty it in the sheet too</button>
                  <button className="btn small ghost" disabled={!!busy} onClick={() => run('Saving…', () => resolveClear(w, state.config!.gid, false))}>Bring the sheet's back</button>
                </div>
              </div>
            ))}
            {state.missing.length > 0 && (
              <div className="tracker-conflict">
                <p><strong>Not found in the sheet</strong> — still safe in your Library. If the rows were removed on purpose you can unlink them; if a filter was on, just sync again.</p>
                <ul>{state.missing.map((m) => <li key={m.bookId}>{m.title} <span className="muted">(was row {m.lastRow})</span> <button className="linkish" disabled={!!busy} onClick={() => run('Unlinking…', () => unlinkBook(m.bookId))}>unlink</button></li>)}</ul>
              </div>
            )}
            {state.twoWay && state.appOnly.length > 0 && (
              <div className="tracker-conflict">
                <p><strong>In your Library but not in the sheet:</strong> {state.appOnly.map((a) => a.title).join(', ')}.</p>
                <button className="btn small ghost" disabled={!!busy} onClick={() => confirm(`Add ${state.appOnly.length} book(s) into empty rows at the bottom of your sheet? Formula cells are left alone.`) && run('Adding to the sheet…', async () => { const r = await addToSheet(state.appOnly.map((a) => a.bookId)); toast(`Added ${r.added} book(s) to the sheet.`); })}>Add them to the sheet</button>
              </div>
            )}
          </section>
        )}

        {status.connected && (
          <section className="lace-card">
            <h3 className="script">History</h3>
            {state.log.length ? <ul className="tracker-log">{state.log.slice(0, 12).map((l) => <li key={l.at + l.text}><span className="muted">{timeAgo(l.at)}</span> {l.text}</li>)}</ul> : <p className="muted">Nothing yet.</p>}
            <div className="row wrap gap">
              <button className="btn ghost" disabled={!!busy} onClick={disconnect}>Disconnect Google</button>
              <span className="muted small">Your books stay. Your spreadsheet is not changed.</span>
            </div>
          </section>
        )}
      </div>
    </AtelierShell>
  );
}
