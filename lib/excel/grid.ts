import type { CellPos } from './address';
import { cellKey, regionAt, type Region, type SheetModel } from './workbook';

/**
 * Grid geometry for the virtualised sheet: prefix offsets of the column
 * widths and row heights, and the index range that is on screen.
 */
export interface Axis {
  /** offsets[i] is where index i starts; offsets[n] is the total size. */
  offsets: Float64Array;
}

export function buildAxis(sizes: number[], scale: number): Axis {
  const offsets = new Float64Array(sizes.length + 1);
  for (let i = 0; i < sizes.length; i++) offsets[i + 1] = offsets[i] + Math.round(sizes[i] * scale);
  return { offsets };
}

export const axisSize = (a: Axis) => a.offsets[a.offsets.length - 1];
export const axisCount = (a: Axis) => a.offsets.length - 1;

/** The index whose span contains `pos` (clamped to the axis). */
export function indexAt(a: Axis, pos: number): number {
  const n = axisCount(a);
  if (n === 0) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (a.offsets[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** First and last index (inclusive) intersecting [start, start + size), widened by `overscan`. */
export function visibleRange(a: Axis, start: number, size: number, overscan: number): [number, number] {
  const n = axisCount(a);
  if (n === 0) return [0, -1];
  const first = indexAt(a, Math.max(0, start));
  const last = indexAt(a, Math.max(0, start + size - 1));
  return [Math.max(0, first - overscan), Math.min(n - 1, last + overscan)];
}

export function regionRect(rows: Axis, cols: Axis, g: Region) {
  return {
    top: rows.offsets[g.r1],
    left: cols.offsets[g.c1],
    height: rows.offsets[g.r2 + 1] - rows.offsets[g.r1],
    width: cols.offsets[g.c2 + 1] - cols.offsets[g.c1],
  };
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Arrow-key movement as Excel does it: a merged cell is one stop, and leaving
 * it moves past its far edge. The result is always a merge's top-left cell or
 * a plain cell. `from` may be any cell; its merge is used.
 */
export function moveSelection(sheet: SheetModel, from: CellPos, dir: Direction): CellPos {
  const here = regionAt(sheet, from);
  let r = from.r;
  let c = from.c;
  if (dir === 'up') r = here.r1 - 1;
  else if (dir === 'down') r = here.r2 + 1;
  else if (dir === 'left') c = here.c1 - 1;
  else c = here.c2 + 1;
  if (dir === 'up' || dir === 'down') c = here.c1;
  else r = here.r1;
  if (r < 0 || c < 0 || r >= sheet.rowCount || c >= sheet.colCount) return anchorOf(sheet, from);
  return anchorOf(sheet, { r, c });
}

/** The top-left cell of the merge containing `pos`, or `pos` itself. */
export function anchorOf(sheet: SheetModel, pos: CellPos): CellPos {
  const m = sheet.mergeOf.get(cellKey(pos.r, pos.c));
  return m ? { r: m.r1, c: m.c1 } : pos;
}

/** Clamps a position to the sheet's drawn area. */
export function clampPos(sheet: SheetModel, pos: CellPos): CellPos {
  return {
    r: Math.max(0, Math.min(pos.r, Math.max(0, sheet.rowCount - 1))),
    c: Math.max(0, Math.min(pos.c, Math.max(0, sheet.colCount - 1))),
  };
}

/**
 * How many columns a text cell may spill into on its right, as Excel lets
 * left-aligned text run over empty neighbours. Numbers, wrapped text, and
 * cells in a merge do not spill.
 */
export function spillColumns(sheet: SheetModel, r: number, c: number, max: number): number {
  let n = 0;
  for (let cc = c + 1; cc < sheet.colCount && n < max; cc++) {
    const k = cellKey(r, cc);
    if (sheet.cells.has(k) || sheet.mergeOf.has(k)) break;
    n++;
  }
  return n;
}
