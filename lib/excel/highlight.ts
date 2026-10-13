import type { SpecificationSource } from '@/types';
import { cellRef, type CellPos } from './address';
import { MAX_VALUE_MATCHES } from './config';
import { cellKey, expandToMerges, type Region, type SheetModel, type WorkbookModel } from './workbook';

/**
 * Where an Excel source points (AM16, calibrated in step 9b).
 *
 * The backend's Excel anchors come from Docling's spreadsheet backend
 * (`BDA/src/preprocessor/analyzer/analyzer.py` → `docling/backend/msexcel_backend.py`):
 * - `pageNumber` is the sheet's 1-based position in the workbook, chart
 *   sheets and hidden sheets included (openpyxl's `workbook.sheetnames`).
 * - the bounding box is the whole **table** Docling found, not a cell:
 *   `[col, row, col + ncols, row + nrows]`, 0-based, end exclusive, which
 *   `formatBoundingBox` turns into `{ x: col, y: row, width: ncols, height: nrows }`.
 * - `cellCoordinates` is not set for Excel by the current hydrator (its Excel
 *   branch sits behind `if True:`), but a 1-based `{ row, column }` is honoured
 *   if it ever arrives.
 *
 * Because the backend names a table, the cell is found by matching the
 * candidate's value against the cells inside it; the UI says so.
 */
export interface ExcelTarget {
  sheetIndex: number;
  /** null when the source names a sheet but no range. */
  region: Region | null;
  /** Cells inside the region whose value equals the candidate's value. */
  matches: CellPos[];
  /** True when more matches existed than MAX_VALUE_MATCHES. */
  truncated: boolean;
  /** How the sheet was chosen, for the calibration record and the status text. */
  sheetBy: 'page' | 'name' | 'none';
}

export function resolveSheet(source: SpecificationSource, wb: WorkbookModel): { index: number; by: ExcelTarget['sheetBy'] } {
  const n = wb.sheets.length;
  const p = source.pageNumber;
  // The hydrator sets pageNumber from the anchor, so it is the reliable field;
  // tableName is written by the model and is only a fallback.
  if (typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= n) return { index: p - 1, by: 'page' };
  const name = source.tableName?.trim().toLowerCase();
  if (name) {
    const i = wb.sheets.findIndex((s) => s.name.trim().toLowerCase() === name);
    if (i >= 0) return { index: i, by: 'name' };
  }
  return { index: -1, by: 'none' };
}

export function sourceRegion(source: SpecificationSource, sheet: SheetModel): Region | null {
  const clampR = (r: number) => Math.max(0, Math.min(r, sheet.rowCount - 1));
  const clampC = (c: number) => Math.max(0, Math.min(c, sheet.colCount - 1));
  const cc = source.cellCoordinates;
  if (cc && cc.row > 0 && cc.column > 0) {
    const r = clampR(cc.row - 1);
    const c = clampC(cc.column - 1);
    return expandToMerges(sheet, { r1: r, c1: c, r2: r, c2: c });
  }
  const b = source.boundingBox;
  if (b && [b.x, b.y, b.width, b.height].every((v) => Number.isFinite(v)) && b.x >= 0 && b.y >= 0) {
    const r1 = Math.floor(b.y);
    const c1 = Math.floor(b.x);
    const r2 = Math.floor(b.y + Math.max(1, b.height)) - 1;
    const c2 = Math.floor(b.x + Math.max(1, b.width)) - 1;
    if (sheet.rowCount === 0 || sheet.colCount === 0) return null;
    return expandToMerges(sheet, { r1: clampR(r1), c1: clampC(c1), r2: clampR(r2), c2: clampC(c2) });
  }
  return null;
}

/** Parses a candidate value ("4.2", "-150", "1,5") into a number, or null. */
export function parseCandidateNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = value.trim().replace(/\s/g, '');
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The number a cell shows, e.g. 80 for "80 %", 3.6 for "3,60 V". */
function shownNumber(text: string): number | null {
  const m = /[-+]?\d+(?:[.,]\d+)?/.exec(text.replace(/\s/g, ''));
  return m ? Number(m[0].replace(',', '.')) : null;
}

/**
 * Cells inside `region` that hold the value. Signs are ignored, because
 * discharge currents are stored negative (CLAUDE.md §7) while a datasheet
 * usually prints them positive. No unit scaling: mAh against Ah is not a match.
 */
export function matchValue(sheet: SheetModel, region: Region, value: string | null | undefined): { matches: CellPos[]; truncated: boolean } {
  const target = parseCandidateNumber(value);
  const matches: CellPos[] = [];
  let truncated = false;
  const text = typeof value === 'string' ? value.trim() : '';
  for (let r = region.r1; r <= region.r2; r++) {
    for (let c = region.c1; c <= region.c2; c++) {
      const cell = sheet.cells.get(cellKey(r, c));
      if (!cell) continue;
      let hit = false;
      if (target !== null) {
        const t = Math.abs(target);
        if (cell.num !== null && close(Math.abs(cell.num), t)) hit = true;
        else {
          const shown = shownNumber(cell.text);
          if (shown !== null && close(Math.abs(shown), t)) hit = true;
        }
      } else if (text) {
        hit = cell.text.trim().toLowerCase() === text.toLowerCase();
      }
      if (!hit) continue;
      if (matches.length >= MAX_VALUE_MATCHES) {
        truncated = true;
        return { matches, truncated };
      }
      matches.push({ r, c });
    }
  }
  return { matches, truncated };
}

export function resolveExcelTarget(
  source: SpecificationSource,
  wb: WorkbookModel,
  value?: string | null,
): ExcelTarget | null {
  const { index, by } = resolveSheet(source, wb);
  if (index < 0) return null;
  const sheet = wb.sheets[index];
  const region = sheet.kind === 'sheet' ? sourceRegion(source, sheet) : null;
  const { matches, truncated } = region ? matchValue(sheet, region, value) : { matches: [], truncated: false };
  return { sheetIndex: index, region, matches, truncated, sheetBy: by };
}

/** "B10:D15" (or "C12") for a backend Excel box, without needing the workbook. */
export function boxRangeLabel(b: SpecificationSource['boundingBox']): string | null {
  if (!b || ![b.x, b.y, b.width, b.height].every((v) => Number.isFinite(v)) || b.x < 0 || b.y < 0) return null;
  const a = { r: Math.floor(b.y), c: Math.floor(b.x) };
  const z = { r: Math.floor(b.y + Math.max(1, b.height)) - 1, c: Math.floor(b.x + Math.max(1, b.width)) - 1 };
  return a.r === z.r && a.c === z.c ? cellRef(a) : `${cellRef(a)}:${cellRef(z)}`;
}
