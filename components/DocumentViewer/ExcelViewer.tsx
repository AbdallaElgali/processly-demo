'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { projectDataStore, type ExcelSheetView } from '@/lib/project-data/store';
import { cellRef, type CellPos } from '@/lib/excel/address';
import { loadWorkbook } from '@/lib/excel/cache';
import { anchorOf, clampPos } from '@/lib/excel/grid';
import { resolveExcelTarget, type ExcelTarget } from '@/lib/excel/highlight';
import { cellKey, regionAt, type WorkbookModel } from '@/lib/excel/workbook';
import type { ViewerHighlight } from './types';
import { SheetGrid, type GridJump } from './excel/SheetGrid';
import { FormulaBar } from './excel/FormulaBar';
import { SheetBar, type SourceStatus } from './excel/SheetBar';

interface ExcelViewerProps {
  fileUrl: string;
  projectId: string;
  documentId: string;
  highlight: ViewerHighlight | null;
  /** Fetch the file again; without it, Retry only parses the same bytes again. */
  onReload?: () => void;
}

type Load = { key: string; status: 'loading' } | { key: string; status: 'ready'; wb: WorkbookModel } | { key: string; status: 'error'; error: string };

/**
 * The spreadsheet viewer (AM16, step 9b). Reads .xlsx and .xlsm as data only
 * (no macros, no recalculation), and draws them like Excel: name box and
 * value bar on top, the sheet in the middle, sheet tabs and zoom at the
 * bottom. Sheet, scroll position and selected cell are kept per document
 * (and per sheet) in the project-data store, like the PDF viewer's page.
 */
export function ExcelViewer({ fileUrl, projectId, documentId, highlight, onReload }: ExcelViewerProps) {
  const [attempt, setAttempt] = useState(0);
  const key = `${fileUrl}#${attempt}`;
  const [load, setLoad] = useState<Load>({ key, status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadWorkbook(fileUrl).then(
      (wb) => alive && setLoad({ key, status: 'ready', wb }),
      (e: unknown) => alive && setLoad({ key, status: 'error', error: e instanceof Error ? e.message : 'The workbook could not be parsed.' }),
    );
    return () => {
      alive = false;
    };
  }, [fileUrl, key]);

  const current: Load = load.key === key ? load : { key, status: 'loading' };

  if (current.status === 'loading') {
    return (
      <Stack sx={{ height: '100%', bgcolor: 'document.canvas' }} aria-busy="true" aria-label="Loading spreadsheet">
        <Skeleton variant="rectangular" height={38} sx={{ bgcolor: 'surface.panel' }} />
        <Skeleton variant="rectangular" sx={{ flex: 1, bgcolor: 'document.page', m: 0 }} />
        <Skeleton variant="rectangular" height={34} sx={{ bgcolor: 'surface.panel' }} />
      </Stack>
    );
  }
  if (current.status === 'error') {
    return (
      <Box sx={{ height: '100%', bgcolor: 'surface.canvas' }}>
        <ErrorState title="This spreadsheet could not be read" description={current.error} onRetry={() => (onReload ? onReload() : setAttempt((a) => a + 1))} />
      </Box>
    );
  }
  return <WorkbookView wb={current.wb} projectId={projectId} documentId={documentId} highlight={highlight} />;
}

interface View {
  sheet: number;
  sel: CellPos;
  /** The highlight nonce last acted on (persisted, so a remount does not jump again). */
  nonce: number | null;
  jump: GridJump | null;
  /** The sheet's saved scroll position, read when the sheet is entered. */
  initialScroll: { top: number; left: number } | null;
  /** Counter for local jumps (name box, "go to source"); negative nonces, never persisted. */
  seq: number;
}

function firstVisibleSheet(wb: WorkbookModel): number {
  const i = wb.sheets.findIndex((s) => !s.hidden && s.kind === 'sheet');
  return i >= 0 ? i : 0;
}

function savedSheet(projectId: string, documentId: string, name: string): ExcelSheetView | undefined {
  return projectDataStore.getDocumentView(projectId, documentId)?.sheets?.[name];
}

/** Where a jump lands: the first cell matching the value, else the region's top-left. */
function jumpFor(target: ExcelTarget, wb: WorkbookModel, nonce: number): { sel: CellPos | null; jump: GridJump | null } {
  const sheet = wb.sheets[target.sheetIndex];
  if (!target.region) return { sel: null, jump: null };
  const sel = anchorOf(sheet, target.matches[0] ?? { r: target.region.r1, c: target.region.c1 });
  return { sel, jump: { nonce, focus: regionAt(sheet, sel), region: target.region } };
}

function WorkbookView({ wb, projectId, documentId, highlight }: { wb: WorkbookModel; projectId: string; documentId: string; highlight: ViewerHighlight | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() => projectDataStore.getDocumentView(projectId, documentId)?.scale ?? 1);
  const [fullscreen, setFullscreen] = useState(false);

  const [view, setView] = useState<View>(() => {
    const saved = projectDataStore.getDocumentView(projectId, documentId);
    const byName = saved?.sheet ? wb.sheets.findIndex((s) => s.name === saved.sheet) : -1;
    const sheet = byName >= 0 ? byName : firstVisibleSheet(wb);
    const sv = saved?.sheets?.[wb.sheets[sheet].name];
    return {
      sheet,
      sel: sv ? { r: sv.r, c: sv.c } : { r: 0, c: 0 },
      nonce: saved?.handledNonce ?? null,
      jump: null,
      initialScroll: sv ? { top: sv.top, left: sv.left } : null,
      seq: 0,
    };
  });

  const target = useMemo(() => (highlight ? resolveExcelTarget(highlight.source, wb, highlight.value) : null), [highlight, wb]);

  // A new jump from the parameter table: switch to its sheet and select the
  // matched cell. Adjusted during render, once per nonce (no effect needed).
  if (highlight && highlight.nonce !== view.nonce) {
    if (target) {
      const { sel, jump } = jumpFor(target, wb, highlight.nonce);
      const name = wb.sheets[target.sheetIndex].name;
      const fallback = savedSheet(projectId, documentId, name);
      setView({
        ...view,
        sheet: target.sheetIndex,
        sel: sel ?? (fallback ? { r: fallback.r, c: fallback.c } : { r: 0, c: 0 }),
        nonce: highlight.nonce,
        jump,
        initialScroll: fallback ? { top: fallback.top, left: fallback.left } : null,
      });
    } else {
      setView({ ...view, nonce: highlight.nonce });
    }
  }

  const sheet = wb.sheets[view.sheet];
  const sel = sheet.kind === 'sheet' ? clampPos(sheet, view.sel) : { r: 0, c: 0 };

  // ---- persistence (non-reactive store, written as the user moves) ----------
  const saveSheet = useCallback(
    (name: string, patch: Partial<ExcelSheetView>) => {
      const cur = projectDataStore.getDocumentView(projectId, documentId);
      const prev = cur?.sheets?.[name] ?? { top: 0, left: 0, r: 0, c: 0 };
      projectDataStore.setDocumentView(projectId, documentId, { sheets: { ...cur?.sheets, [name]: { ...prev, ...patch } } });
    },
    [projectId, documentId],
  );

  useEffect(() => {
    projectDataStore.setDocumentView(projectId, documentId, { sheet: sheet.name });
  }, [projectId, documentId, sheet.name]);

  const onSelect = useCallback((pos: CellPos) => setView((v) => ({ ...v, sel: pos })), []);

  const onScrollChange = useCallback((top: number, left: number) => saveSheet(sheet.name, { top, left }), [saveSheet, sheet.name]);

  const onJumpHandled = useCallback(
    (nonce: number) => {
      if (nonce >= 0) projectDataStore.setDocumentView(projectId, documentId, { handledNonce: nonce });
      // Done: a remount of this sheet later restores the saved place instead of jumping again.
      setView((v) => (v.jump?.nonce === nonce ? { ...v, jump: null } : v));
    },
    [projectId, documentId],
  );

  // Selected cell and scroll are saved with the sheet they belong to, so a
  // jump's selection is remembered too.
  useEffect(() => {
    if (sheet.kind === 'sheet') saveSheet(sheet.name, { r: sel.r, c: sel.c });
  }, [saveSheet, sheet.name, sheet.kind, sel.r, sel.c]);

  const selectSheet = (i: number) => {
    if (i === view.sheet) return;
    const sv = savedSheet(projectId, documentId, wb.sheets[i].name);
    setView((v) => ({
      ...v,
      sheet: i,
      sel: sv ? { r: sv.r, c: sv.c } : { r: 0, c: 0 },
      jump: null,
      initialScroll: sv ? { top: sv.top, left: sv.left } : null,
    }));
  };

  const focusGrid = () => rootRef.current?.querySelector<HTMLElement>('[data-sheet-body]')?.focus();

  const jumpToCell = (pos: CellPos) => {
    if (sheet.kind !== 'sheet') return;
    const p = anchorOf(sheet, clampPos(sheet, pos));
    setView((v) => ({ ...v, sel: p, seq: v.seq + 1, jump: { nonce: -(v.seq + 1), focus: regionAt(sheet, p), region: null } }));
    requestAnimationFrame(focusGrid);
  };

  const goToSource = () => {
    if (!target || !highlight) return;
    const { sel: s, jump } = jumpFor(target, wb, -(view.seq + 1));
    setView((v) => ({ ...v, sheet: target.sheetIndex, sel: s ?? { r: 0, c: 0 }, seq: v.seq + 1, jump, initialScroll: null }));
  };

  const changeScale = (s: number) => {
    setScale(s);
    projectDataStore.setDocumentView(projectId, documentId, { scale: s });
  };

  // ---- full screen ----------------------------------------------------------
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  };

  // ---- what the highlight covers --------------------------------------------
  const onThisSheet = !!target && target.sheetIndex === view.sheet;
  let status: SourceStatus | null = null;
  if (highlight && !target) {
    status = { text: `The source names sheet ${highlight.source.pageNumber ?? '?'}, which this workbook does not have` };
  } else if (highlight && target && !onThisSheet) {
    status = { text: '', goTo: { label: `Source is on “${wb.sheets[target.sheetIndex].name}”`, onClick: goToSource } };
  } else if (highlight && target && !target.region) {
    status = { text: 'Source: this sheet (no cell range recorded)' };
  } else if (highlight && target?.region) {
    const range = `${cellRef({ r: target.region.r1, c: target.region.c1 })}:${cellRef({ r: target.region.r2, c: target.region.c2 })}`;
    const n = `${target.matches.length}${target.truncated ? '+' : ''}`;
    const one = target.matches.length === 1 && !target.truncated;
    status = {
      text: `${range} · ${target.matches.length === 0 ? 'no match' : `${n} ${one ? 'match' : 'matches'}`}`,
      detail: `The source names the table ${range}. ${
        target.matches.length === 0 ? 'No cell in it matches the value.' : `${n} ${one ? 'cell in it matches' : 'cells in it match'} the value and ${one ? 'is' : 'are'} marked.`
      }`,
    };
  }

  const merge = sheet.kind === 'sheet' ? sheet.mergeAt.get(cellKey(sel.r, sel.c)) : undefined;

  return (
    <Box ref={rootRef} sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'surface.panel' }}>
      <FormulaBar
        selection={sel}
        cell={sheet.kind === 'sheet' ? sheet.cells.get(cellKey(sel.r, sel.c)) : undefined}
        merged={merge ? `${cellRef({ r: merge.r1, c: merge.c1 })}:${cellRef({ r: merge.r2, c: merge.c2 })}` : null}
        onJump={jumpToCell}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        disabled={sheet.kind !== 'sheet'}
      />
      {sheet.kind === 'chart' ? (
        <Box sx={{ flex: 1, minHeight: 0, bgcolor: 'surface.canvas', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={InsertChartOutlinedIcon} title="Chart sheet" description="This sheet holds a chart. The viewer shows the workbook's data, not its charts." />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <SheetGrid
            key={view.sheet}
            sheet={sheet}
            styles={wb.styles}
            scale={scale}
            selection={sel}
            onSelect={onSelect}
            highlight={onThisSheet && target ? { region: target.region, matches: target.matches } : null}
            jump={view.jump}
            onJumpHandled={onJumpHandled}
            initialScroll={view.initialScroll}
            onScrollChange={onScrollChange}
            label={`Sheet ${sheet.name}`}
          />
        </Box>
      )}
      <SheetBar
        sheets={wb.sheets}
        active={view.sheet}
        onSelect={selectSheet}
        sourceSheet={target ? target.sheetIndex : null}
        status={status}
        scale={scale}
        onScale={changeScale}
      />
    </Box>
  );
}
