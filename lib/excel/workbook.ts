import * as XLSX from 'xlsx';
import type { CellPos } from './address';
import {
  DEFAULT_COL_PX,
  DEFAULT_ROW_PX,
  EXTRA_COLS,
  EXTRA_ROWS,
  MAX_DIGIT_WIDTH_PX,
  MIN_COLS,
  MIN_ROWS,
} from './config';
import { buildStyleTable, readCellStyleIndex, sheetXmlPaths, type CellStyle, type ThemeColors, type XlsxStyles } from './styles';

/** A merged region, 0-based and inclusive at both ends. */
export interface Region {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface SheetCell {
  /** What Excel shows: the workbook's number format applied (SheetJS `w`). */
  text: string;
  /** The stored value, for value matching; null for text and errors. */
  num: number | null;
  /** Formula text without the leading `=`, when the workbook stores one. */
  formula?: string;
  isNumber: boolean;
}

export interface SheetModel {
  name: string;
  kind: 'sheet' | 'chart';
  /** 0 visible, 1 hidden, 2 very hidden (Excel's own values). */
  hidden: 0 | 1 | 2;
  /** Rows and columns drawn: the used range plus some empty margin. */
  rowCount: number;
  colCount: number;
  /** Where the data is (A1 if the sheet is empty). */
  used: Region;
  colWidths: number[];
  rowHeights: number[];
  hiddenCols: Set<number>;
  hiddenRows: Set<number>;
  cells: Map<number, SheetCell>;
  /** Style index per cell, including empty cells that carry only a fill. */
  styleOf: Map<number, number>;
  merges: Region[];
  /** Top-left cell of a merge → the merge. */
  mergeAt: Map<number, Region>;
  /** Every cell inside a merge (top-left included) → the merge. */
  mergeOf: Map<number, Region>;
}

export interface WorkbookModel {
  sheets: SheetModel[];
  styles: (CellStyle | null)[];
}

/** One key per cell; columns never exceed Excel's 16 384. */
export const cellKey = (r: number, c: number) => r * 16384 + c;
export const keyPos = (k: number): CellPos => ({ r: Math.floor(k / 16384), c: k % 16384 });

/** Excel's own conversion from a width in characters to pixels. */
export function charWidthToPx(width: number): number {
  return Math.trunc(((256 * width + Math.trunc(128 / MAX_DIGIT_WIDTH_PX)) / 256) * MAX_DIGIT_WIDTH_PX);
}

const PT_TO_PX = 96 / 72;

/**
 * The options that make SheetJS read a workbook as data only (.xlsx and
 * .xlsm alike): no VBA project, no HTML. Formula text is read so the value
 * bar can show it; nothing is ever evaluated, the displayed values are the
 * ones Excel cached in the file.
 */
export const READ_OPTIONS: XLSX.ParsingOptions = {
  type: 'array',
  bookVBA: false,
  cellHTML: false,
  cellFormula: true,
  cellNF: true,
  cellStyles: true,
  cellDates: false,
  bookFiles: true,
};

function fileText(files: Record<string, { content?: unknown }> | undefined, path: string): string {
  const content = files?.[path]?.content ?? files?.[`/${path}`]?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content instanceof Uint8Array) return new TextDecoder().decode(content);
  if (Array.isArray(content)) return new TextDecoder().decode(Uint8Array.from(content as number[]));
  return '';
}

function sheetCell(c: XLSX.CellObject): SheetCell | null {
  if (c.t === 'z') return null;
  const isNumber = c.t === 'n';
  const text = c.w ?? (c.t === 'b' ? (c.v ? 'TRUE' : 'FALSE') : c.v === undefined || c.v === null ? '' : String(c.v));
  if (!text && !c.f) return null;
  return {
    text,
    num: isNumber && typeof c.v === 'number' ? c.v : null,
    formula: c.f ? String(c.f) : undefined,
    isNumber,
  };
}

function buildSheet(
  name: string,
  ws: XLSX.WorkSheet,
  hidden: 0 | 1 | 2,
  styleIndex: Map<string, number>,
): SheetModel {
  const isChart = (ws as { '!type'?: string })['!type'] === 'chart';
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  const merges: Region[] = isChart
    ? []
    : (ws['!merges'] ?? []).map((m) => ({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));

  let lastR = range.e.r;
  let lastC = range.e.c;
  for (const m of merges) {
    lastR = Math.max(lastR, m.r2);
    lastC = Math.max(lastC, m.c2);
  }
  const rowCount = isChart ? 0 : Math.max(MIN_ROWS, lastR + 1 + EXTRA_ROWS);
  const colCount = isChart ? 0 : Math.max(MIN_COLS, lastC + 1 + EXTRA_COLS);

  const colWidths = new Array<number>(colCount).fill(DEFAULT_COL_PX);
  const hiddenCols = new Set<number>();
  (ws['!cols'] ?? []).forEach((col, i) => {
    if (!col || i >= colCount) return;
    // `width` is the file's own value in characters. SheetJS's `wpx` guesses
    // the font's digit width and can be off by a factor of two, so it is not used.
    if (typeof col.width === 'number') colWidths[i] = charWidthToPx(col.width);
    else if (typeof col.wch === 'number') colWidths[i] = charWidthToPx(col.wch);
    if (col.hidden) hiddenCols.add(i);
  });

  const rowHeights = new Array<number>(rowCount).fill(DEFAULT_ROW_PX);
  const hiddenRows = new Set<number>();
  (ws['!rows'] ?? []).forEach((row, i) => {
    if (!row || i >= rowCount) return;
    // `hpt` is points; SheetJS's `hpx` is not reliably converted.
    if (typeof row.hpt === 'number' && row.hpt > 0) rowHeights[i] = Math.round(row.hpt * PT_TO_PX);
    if (row.hidden) hiddenRows.add(i);
  });

  const cells = new Map<number, SheetCell>();
  if (!isChart) {
    for (const ref of Object.keys(ws)) {
      if (ref[0] === '!') continue;
      const pos = XLSX.utils.decode_cell(ref);
      const cell = sheetCell(ws[ref] as XLSX.CellObject);
      if (cell) cells.set(cellKey(pos.r, pos.c), cell);
    }
  }

  const styleOf = new Map<number, number>();
  if (!isChart) {
    for (const [ref, s] of styleIndex) {
      if (s === 0) continue; // the default format
      const pos = XLSX.utils.decode_cell(ref);
      if (pos.r < rowCount && pos.c < colCount) styleOf.set(cellKey(pos.r, pos.c), s);
    }
  }

  const mergeAt = new Map<number, Region>();
  const mergeOf = new Map<number, Region>();
  for (const m of merges) {
    mergeAt.set(cellKey(m.r1, m.c1), m);
    for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) mergeOf.set(cellKey(r, c), m);
  }

  return {
    name,
    kind: isChart ? 'chart' : 'sheet',
    hidden,
    rowCount,
    colCount,
    used: { r1: range.s.r, c1: range.s.c, r2: lastR, c2: lastC },
    colWidths,
    rowHeights,
    hiddenCols,
    hiddenRows,
    cells,
    styleOf,
    merges,
    mergeAt,
    mergeOf,
  };
}

/** Parses a workbook (.xlsx, .xlsm) into the model the grid draws. Data only. */
export function parseWorkbook(data: ArrayBuffer | Uint8Array): WorkbookModel {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // .xlsx and .xlsm are zip packages. SheetJS would read anything else as
  // plain text and show a damaged file as a one-cell sheet, so refuse it.
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new Error('The file is not a valid .xlsx or .xlsm workbook.');
  }
  const wb = XLSX.read(bytes, READ_OPTIONS);
  const files = (wb as unknown as { files?: Record<string, { content?: unknown }> }).files;
  const paths = sheetXmlPaths(fileText(files, 'xl/workbook.xml'), fileText(files, 'xl/_rels/workbook.xml.rels'));
  const theme = ((wb as unknown as { Themes?: { themeElements?: { clrScheme?: ThemeColors } } }).Themes?.themeElements
    ?.clrScheme ?? []) as ThemeColors;
  const styles = buildStyleTable((wb as unknown as { Styles?: XlsxStyles }).Styles, theme);
  const meta = wb.Workbook?.Sheets ?? [];

  const sheets = wb.SheetNames.map((name, i) => {
    const path = paths.get(name);
    const index = path ? readCellStyleIndex(fileText(files, path)) : new Map<string, number>();
    const hidden = (meta[i]?.Hidden ?? 0) as 0 | 1 | 2;
    return buildSheet(name, wb.Sheets[name], hidden, index);
  });
  return { sheets, styles };
}

/** The merge containing a cell, or a one-cell region. */
export function regionAt(sheet: SheetModel, pos: CellPos): Region {
  return sheet.mergeOf.get(cellKey(pos.r, pos.c)) ?? { r1: pos.r, c1: pos.c, r2: pos.r, c2: pos.c };
}

/** Grows a region until no merge sticks out of it, so a highlight never cuts a merged cell. */
export function expandToMerges(sheet: SheetModel, region: Region): Region {
  const out = { ...region };
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of sheet.merges) {
      const overlaps = m.r1 <= out.r2 && m.r2 >= out.r1 && m.c1 <= out.c2 && m.c2 >= out.c1;
      if (!overlaps) continue;
      if (m.r1 < out.r1 || m.c1 < out.c1 || m.r2 > out.r2 || m.c2 > out.c2) {
        out.r1 = Math.min(out.r1, m.r1);
        out.c1 = Math.min(out.c1, m.c1);
        out.r2 = Math.max(out.r2, m.r2);
        out.c2 = Math.max(out.c2, m.c2);
        changed = true;
      }
    }
  }
  return out;
}
