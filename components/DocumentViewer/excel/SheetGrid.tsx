'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { CellPos } from '@/lib/excel/address';
import { cellRef, colLetter } from '@/lib/excel/address';
import { COL_HEADER_PX, MAX_SPILL_COLS, OVERSCAN_COLS, OVERSCAN_ROWS, ROW_HEADER_PX } from '@/lib/excel/config';
import { anchorOf, axisSize, buildAxis, indexAt, moveSelection, regionRect, spillColumns, visibleRange, type Axis, type Direction } from '@/lib/excel/grid';
import type { CellStyle } from '@/lib/excel/styles';
import { cellKey, regionAt, type Region, type SheetModel } from '@/lib/excel/workbook';

/** A jump to a source location, handled once per nonce. */
export interface GridJump {
  nonce: number;
  /** What to bring into view: the matched cell if there is one, else the region. */
  focus: Region;
  /** The whole source region, centred when it fits. */
  region: Region | null;
}

export interface GridHighlight {
  region: Region | null;
  matches: CellPos[];
}

const KEYS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const FONT = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const PT = 96 / 72;
const DEFAULT_PT = 11;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The sheet itself (AM16): column letters and row numbers that stay put while
 * the cells scroll, the workbook's column widths and row heights, gridlines,
 * merged cells in both directions, number-formatted text, fills, fonts and
 * alignment. Only the cells near the viewport are rendered.
 *
 * The cells are the document, so they use the mode-invariant `document.*`
 * tokens and the workbook's own colours; the surrounding chrome does not live
 * here.
 */
function SheetGridImpl({
  sheet,
  styles,
  scale,
  selection,
  onSelect,
  highlight,
  jump,
  onJumpHandled,
  initialScroll,
  onScrollChange,
  label,
}: {
  sheet: SheetModel;
  styles: (CellStyle | null)[];
  scale: number;
  selection: CellPos;
  onSelect: (pos: CellPos) => void;
  highlight: GridHighlight | null;
  jump: GridJump | null;
  onJumpHandled: (nonce: number) => void;
  initialScroll: { top: number; left: number } | null;
  onScrollChange: (top: number, left: number) => void;
  label: string;
}) {
  const theme = useTheme();
  const doc = theme.vars!.palette.document;
  const bodyRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [scroll, setScroll] = useState({ top: initialScroll?.top ?? 0, left: initialScroll?.left ?? 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  const rows: Axis = useMemo(() => buildAxis(sheet.rowHeights, scale), [sheet, scale]);
  const cols: Axis = useMemo(() => buildAxis(sheet.colWidths, scale), [sheet, scale]);
  const totalW = axisSize(cols);
  const totalH = axisSize(rows);

  // ---- viewport size ------------------------------------------------------
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- scrolling ----------------------------------------------------------
  const onScroll = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = bodyRef.current;
      if (!el) return;
      setScroll({ top: el.scrollTop, left: el.scrollLeft });
      onScrollChange(el.scrollTop, el.scrollLeft);
    });
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  // Zooming keeps the same cells in view.
  const prevScale = useRef(scale);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || prevScale.current === scale) return;
    const k = scale / prevScale.current;
    prevScale.current = scale;
    el.scrollTop = el.scrollTop * k;
    el.scrollLeft = el.scrollLeft * k;
  }, [scale]);

  // Restore this sheet's place once, on mount, unless a jump is about to move it.
  const restored = useRef(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || restored.current) return;
    restored.current = true;
    if (initialScroll && !jump) {
      el.scrollTop = initialScroll.top;
      el.scrollLeft = initialScroll.left;
    }
  }, [initialScroll, jump]);

  const scrollToRegion = useCallback(
    (g: Region, center: boolean, smooth: boolean) => {
      const el = bodyRef.current;
      if (!el) return;
      const rect = regionRect(rows, cols, g);
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      let top = el.scrollTop;
      let left = el.scrollLeft;
      if (center) {
        top = rect.height < vh ? rect.top - (vh - rect.height) / 2 : rect.top - 8;
        left = rect.width < vw ? rect.left - (vw - rect.width) / 2 : rect.left - 8;
      } else {
        if (rect.top < top) top = rect.top;
        else if (rect.top + rect.height > top + vh) top = rect.top + rect.height - vh;
        if (rect.left < left) left = rect.left;
        else if (rect.left + rect.width > left + vw) left = rect.left + rect.width - vw;
      }
      el.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    },
    [rows, cols],
  );

  // ---- jump to a source (once per nonce) -----------------------------------
  const lastJump = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!jump || lastJump.current === jump.nonce || size.w === 0) return;
    lastJump.current = jump.nonce;
    // Centre the whole table when it fits, otherwise the matched cell.
    const r = jump.region ? regionRect(rows, cols, jump.region) : null;
    const fits = r && bodyRef.current && r.width <= bodyRef.current.clientWidth && r.height <= bodyRef.current.clientHeight;
    scrollToRegion(fits && jump.region ? jump.region : jump.focus, true, false);
    onJumpHandled(jump.nonce);
  }, [jump, size.w, rows, cols, scrollToRegion, onJumpHandled]);

  // ---- selection ------------------------------------------------------------
  const select = (pos: CellPos, reveal: boolean) => {
    const anchor = anchorOf(sheet, pos);
    onSelect(anchor);
    if (reveal) scrollToRegion(regionAt(sheet, anchor), false, false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = KEYS[e.key];
    if (!dir || e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    select(moveSelection(sheet, selection, dir), true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = bodyRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = e.clientX - box.left + el.scrollLeft;
    const y = e.clientY - box.top + el.scrollTop;
    if (x > totalW || y > totalH || x > el.clientWidth + el.scrollLeft || y > el.clientHeight + el.scrollTop) return;
    select({ r: indexAt(rows, y), c: indexAt(cols, x) }, false);
  };

  // ---- what is on screen ----------------------------------------------------
  // Snapped to blocks, so most scroll frames reuse the memoised cell layer
  // instead of rebuilding it (the window only changes every few frames).
  const [vr0, vr1] = visibleRange(rows, scroll.top, size.h || 800, OVERSCAN_ROWS);
  const [vc0, vc1] = visibleRange(cols, scroll.left, size.w || 1200, OVERSCAN_COLS);
  const r0 = snapDown(vr0, ROW_BLOCK);
  const r1 = Math.min(sheet.rowCount - 1, snapUp(vr1, ROW_BLOCK));
  const c0 = snapDown(vc0, COL_BLOCK);
  const c1 = Math.min(sheet.colCount - 1, snapUp(vc1, COL_BLOCK));

  const cellLayer = useMemo(
    () => renderCells(sheet, styles, rows, cols, scale, r0, r1, c0, c1, doc),
    [sheet, styles, rows, cols, scale, r0, r1, c0, c1, doc],
  );

  const gridLines = useMemo(() => {
    const out: ReactNode[] = [];
    const top = rows.offsets[r0];
    const height = rows.offsets[r1 + 1] - top;
    const left = cols.offsets[c0];
    const width = cols.offsets[c1 + 1] - left;
    for (let c = c0 + 1; c <= c1 + 1; c++) {
      out.push(<div key={`v${c}`} style={{ position: 'absolute', left: cols.offsets[c] - 1, top, width: 1, height, background: doc.gridLine }} />);
    }
    for (let r = r0 + 1; r <= r1 + 1; r++) {
      out.push(<div key={`h${r}`} style={{ position: 'absolute', top: rows.offsets[r] - 1, left, height: 1, width, background: doc.gridLine }} />);
    }
    return out;
  }, [rows, cols, r0, r1, c0, c1, doc.gridLine]);

  const selRegion = regionAt(sheet, selection);
  const selRect = regionRect(rows, cols, selRegion);
  const hlRect = highlight?.region ? regionRect(rows, cols, highlight.region) : null;

  const activeRows = { r1: selRegion.r1, r2: selRegion.r2 };
  const activeCols = { c1: selRegion.c1, c2: selRegion.c2 };
  const hl = highlight?.region ?? null;

  const headerCell = (active: boolean, inHighlight: boolean, hidden: boolean): CSSProperties => ({
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
    userSelect: 'none',
    color: inHighlight && !active ? doc.highlightStroke : doc.headerText,
    fontWeight: active || inHighlight ? 700 : 400,
    fontStyle: hidden ? 'italic' : undefined,
    background: active ? doc.headerActive : inHighlight ? doc.highlightFill : doc.headerCell,
  });

  return (
    <Box
      sx={{
        position: 'relative', flex: 1, minHeight: 0, bgcolor: 'document.page', overflow: 'hidden', fontFamily: FONT,
        '& .bda-xl-hl': { animation: 'bda-xl-hl-in 180ms cubic-bezier(0.2, 0, 0, 1)' },
        '@keyframes bda-xl-hl-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        '@media (prefers-reduced-motion: reduce)': { '& .bda-xl-hl': { animation: 'none' } },
      }}
    >
      {/* corner */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0, width: ROW_HEADER_PX, height: COL_HEADER_PX, zIndex: 3,
          background: doc.headerCell, borderRight: `1px solid ${doc.gridLine}`, borderBottom: `1px solid ${doc.gridLine}`, boxSizing: 'border-box',
        }}
      />
      {/* column letters */}
      <div aria-hidden style={{ position: 'absolute', left: ROW_HEADER_PX, right: 0, top: 0, height: COL_HEADER_PX, overflow: 'hidden', zIndex: 2, borderBottom: `1px solid ${doc.gridLine}`, boxSizing: 'border-box', background: doc.headerCell }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: COL_HEADER_PX - 1, width: totalW, transform: `translateX(${-scroll.left}px)` }}>
          {range(c0, c1).map((c) => {
            const hidden = sheet.hiddenCols.has(c);
            return (
              <div
                key={c}
                title={hidden ? `Column ${colLetter(c)} is hidden in the workbook and shown here` : undefined}
                style={{
                  ...headerCell(c >= activeCols.c1 && c <= activeCols.c2, !!hl && c >= hl.c1 && c <= hl.c2, hidden),
                  left: cols.offsets[c], width: cols.offsets[c + 1] - cols.offsets[c], top: 0, height: COL_HEADER_PX - 1,
                  borderRight: `1px solid ${doc.gridLine}`,
                  borderTop: hidden ? `3px solid ${doc.hiddenMark}` : undefined,
                }}
              >
                {colLetter(c)}
              </div>
            );
          })}
        </div>
      </div>
      {/* row numbers */}
      <div aria-hidden style={{ position: 'absolute', left: 0, top: COL_HEADER_PX, bottom: 0, width: ROW_HEADER_PX, overflow: 'hidden', zIndex: 2, borderRight: `1px solid ${doc.gridLine}`, boxSizing: 'border-box', background: doc.headerCell }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: ROW_HEADER_PX - 1, height: totalH, transform: `translateY(${-scroll.top}px)` }}>
          {range(r0, r1).map((r) => {
            const hidden = sheet.hiddenRows.has(r);
            return (
              <div
                key={r}
                title={hidden ? `Row ${r + 1} is hidden in the workbook and shown here` : undefined}
                style={{
                  ...headerCell(r >= activeRows.r1 && r <= activeRows.r2, !!hl && r >= hl.r1 && r <= hl.r2, hidden),
                  top: rows.offsets[r], height: rows.offsets[r + 1] - rows.offsets[r], left: 0, width: ROW_HEADER_PX - 1,
                  borderBottom: `1px solid ${doc.gridLine}`,
                  borderLeft: hidden ? `3px solid ${doc.hiddenMark}` : undefined,
                }}
              >
                {r + 1}
              </div>
            );
          })}
        </div>
      </div>
      {/* cells */}
      <Box
        ref={bodyRef}
        data-sheet-body
        role="region"
        aria-label={`${label}. Arrow keys move the selected cell.`}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        sx={{ position: 'absolute', left: ROW_HEADER_PX, top: COL_HEADER_PX, right: 0, bottom: 0, overflow: 'auto', outlineOffset: -2, cursor: 'cell' }}
      >
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          {gridLines}
          {cellLayer}
          {hlRect && (
            <div
              aria-hidden
              key={jump?.nonce}
              className="bda-xl-hl"
              style={{
                position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box',
                left: hlRect.left - 1, top: hlRect.top - 1, width: hlRect.width + 1, height: hlRect.height + 1,
                border: `2px solid ${doc.highlightStroke}`, background: doc.highlightFill, zIndex: 2,
              }}
            />
          )}
          {highlight?.matches.map((m) => {
            const rect = regionRect(rows, cols, regionAt(sheet, m));
            return (
              <div
                aria-hidden
                key={`m${m.r}:${m.c}`}
                style={{
                  position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box',
                  left: rect.left - 1, top: rect.top - 1, width: rect.width + 1, height: rect.height + 1,
                  background: doc.matchFill, border: `1px solid ${doc.highlightStroke}`, zIndex: 2,
                }}
              />
            );
          })}
          <div
            aria-hidden
            style={{
              position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box',
              left: selRect.left - 2, top: selRect.top - 2, width: selRect.width + 3, height: selRect.height + 3,
              border: `2px solid ${doc.selectionStroke}`, zIndex: 3,
            }}
          />
        </div>
      </Box>
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} aria-live="polite">
        {cellRef(selection)} {sheet.cells.get(cellKey(selection.r, selection.c))?.text || 'empty'}
      </Box>
    </Box>
  );
}

export const SheetGrid = memo(SheetGridImpl);

const ROW_BLOCK = 16;
const COL_BLOCK = 8;
const snapDown = (i: number, b: number) => Math.floor(i / b) * b;
const snapUp = (i: number, b: number) => Math.ceil((i + 1) / b) * b - 1;

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

type DocVars = { text: string; page: string };

/**
 * The visible cells: merged regions first (one box each, whatever part of
 * them is on screen), then plain cells. Empty cells without a fill are not
 * drawn at all; the gridlines underneath show through.
 */
function renderCells(
  sheet: SheetModel,
  styles: (CellStyle | null)[],
  rows: Axis,
  cols: Axis,
  scale: number,
  r0: number,
  r1: number,
  c0: number,
  c1: number,
  doc: DocVars,
): ReactNode[] {
  const out: ReactNode[] = [];

  const draw = (key: string, g: Region, r: number, c: number, merged: boolean) => {
    const k = cellKey(r, c);
    const cell = sheet.cells.get(k);
    const s = styles[sheet.styleOf.get(k) ?? -1] ?? null;
    if (!cell && !s?.fill && !merged) return;
    const rect = regionRect(rows, cols, g);
    const text = cell?.text ?? '';
    const align = s?.hAlign ?? (cell?.isNumber ? 'right' : 'left');
    const spill = text && !merged && !s?.wrap && !cell?.isNumber && align === 'left' ? spillColumns(sheet, r, c, MAX_SPILL_COLS) : 0;
    // A fill covers the cell's own gridlines, as in Excel; an unfilled merge keeps its outline.
    const inset = s?.fill ? 0 : 1;
    const box: CSSProperties = {
      position: 'absolute',
      left: rect.left,
      top: rect.top,
      width: Math.max(0, rect.width - inset),
      height: Math.max(0, rect.height - inset),
      background: s?.fill ?? (merged ? doc.page : undefined),
      pointerEvents: 'none',
    };
    if (!text) {
      out.push(<div key={key} style={box} />);
      return;
    }
    const textStyle: CSSProperties = {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      // Spilled text runs over empty neighbours; the fill stays in the cell.
      width: spill ? cols.offsets[c + 1 + spill] - cols.offsets[c] : '100%',
      color: s?.color ?? doc.text,
      fontWeight: s?.bold ? 700 : 400,
      fontStyle: s?.italic ? 'italic' : undefined,
      textDecoration: s?.underline ? 'underline' : undefined,
      fontSize: `${((s?.size ?? DEFAULT_PT) * PT * scale).toFixed(2)}px`,
      lineHeight: 1.15,
      padding: `0 ${Math.round(3 * scale)}px`,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: s?.vAlign === 'top' ? 'flex-start' : s?.vAlign === 'center' ? 'center' : 'flex-end',
      justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      textAlign: align === 'justify' ? 'justify' : align,
      whiteSpace: s?.wrap ? 'pre-wrap' : 'pre',
      overflow: 'hidden',
      overflowWrap: s?.wrap ? 'anywhere' : undefined,
    };
    out.push(
      <div key={key} title={text.length > 12 ? text : undefined} style={{ ...box, zIndex: spill ? 1 : undefined }}>
        <div style={textStyle}>{text}</div>
      </div>,
    );
  };

  for (const m of sheet.merges) {
    if (m.r2 < r0 || m.r1 > r1 || m.c2 < c0 || m.c1 > c1) continue;
    draw(`g${m.r1}:${m.c1}`, m, m.r1, m.c1, true);
  }
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (sheet.mergeOf.has(cellKey(r, c))) continue;
      draw(`${r}:${c}`, { r1: r, c1: c, r2: r, c2: c }, r, c, false);
    }
  }
  return out;
}
