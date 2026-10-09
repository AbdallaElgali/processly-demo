import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { SpecificationSource } from '@/types';
import { formatBoundingBox } from '@/lib/parameter-adapter';
import { cellRef, colIndex, colLetter, parseRef } from './address';
import { applyTint, buildStyleTable, readCellStyleIndex, resolveColor, sheetXmlPaths } from './styles';
import { cellKey, charWidthToPx, expandToMerges, parseWorkbook, regionAt } from './workbook';
import { buildAxis, indexAt, moveSelection, spillColumns, visibleRange } from './grid';
import { boxRangeLabel, matchValue, parseCandidateNumber, resolveExcelTarget, resolveSheet } from './highlight';
import { DEFAULT_COL_PX, DEFAULT_ROW_PX, MIN_COLS, MIN_ROWS } from './config';

/** A workbook written by SheetJS itself, read back through the viewer's parser. */
function book(sheets: Record<string, { aoa: unknown[][]; merges?: string[]; cols?: XLSX.ColInfo[]; rows?: XLSX.RowInfo[] }>, hidden: number[] = []) {
  const wb = XLSX.utils.book_new();
  for (const [name, s] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    if (s.merges) ws['!merges'] = s.merges.map((m) => XLSX.utils.decode_range(m));
    if (s.cols) ws['!cols'] = s.cols;
    if (s.rows) ws['!rows'] = s.rows;
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  if (hidden.length) {
    wb.Workbook = { Sheets: wb.SheetNames.map((_, i) => ({ Hidden: hidden.includes(i) ? 1 : 0 })) } as XLSX.WBProps;
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return parseWorkbook(out);
}

const src = (p: Partial<SpecificationSource>): SpecificationSource => ({
  documentId: 'd',
  textSnippet: null,
  reason: null,
  pageNumber: null,
  boundingBox: null,
  tableName: null,
  cellCoordinates: null,
  ...p,
});

describe('A1 references', () => {
  it('converts columns both ways', () => {
    expect([0, 25, 26, 51, 701, 702, 16383].map(colLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA', 'XFD']);
    expect(['A', 'z', 'AA', 'XFD'].map(colIndex)).toEqual([0, 25, 26, 16383]);
    expect(colIndex('A1')).toBe(-1);
  });

  it('parses what a user types in the name box', () => {
    expect(parseRef('C12')).toEqual({ r: 11, c: 2 });
    expect(parseRef(' $c$12 ')).toEqual({ r: 11, c: 2 });
    expect(parseRef('A0')).toBeNull();
    expect(parseRef('C')).toBeNull();
    expect(parseRef('A1:B2')).toBeNull();
    expect(cellRef({ r: 11, c: 2 })).toBe('C12');
  });
});

describe('parseWorkbook', () => {
  it('keeps formatted text, merges in both directions, sizes and hidden sheets', () => {
    const wb = book(
      {
        One: { aoa: [['Head', null, null], [1.5, 'x'], [null, null, 3]], merges: ['A1:C1', 'B2:B3'], cols: [{ wch: 20 }, { hidden: true }], rows: [{ hpt: 30 }, { hidden: true }] },
        Two: { aoa: [['only']] },
      },
      [1],
    );
    expect(wb.sheets.map((s) => [s.name, s.hidden, s.kind])).toEqual([['One', 0, 'sheet'], ['Two', 1, 'sheet']]);
    const s = wb.sheets[0];
    expect(s.cells.get(cellKey(1, 0))).toMatchObject({ text: '1.5', num: 1.5, isNumber: true });
    expect(s.merges).toEqual([{ r1: 0, c1: 0, r2: 0, c2: 2 }, { r1: 1, c1: 1, r2: 2, c2: 1 }]);
    expect(regionAt(s, { r: 2, c: 1 })).toEqual({ r1: 1, c1: 1, r2: 2, c2: 1 });
    expect(s.mergeAt.has(cellKey(0, 0))).toBe(true);
    expect(s.colWidths[0]).toBeGreaterThan(DEFAULT_COL_PX);
    expect(s.colWidths[2]).toBe(DEFAULT_COL_PX);
    expect(s.hiddenCols.has(1)).toBe(true);
    expect(s.rowHeights[0]).toBe(40); // 30 pt
    expect(s.rowHeights[2]).toBe(DEFAULT_ROW_PX);
    expect(s.hiddenRows.has(1)).toBe(true);
    expect(s.rowCount).toBeGreaterThanOrEqual(MIN_ROWS);
    expect(s.colCount).toBeGreaterThanOrEqual(MIN_COLS);
  });

  it('refuses a file that is not a zip package instead of reading it as text', () => {
    expect(() => parseWorkbook(new TextEncoder().encode('not a workbook'))).toThrow(/not a valid/);
  });

  it('converts character widths to pixels the way Excel does', () => {
    // The file stores the width with padding: 8.43 shown characters are 9.140625.
    expect(charWidthToPx(9.140625)).toBe(64);
    expect(charWidthToPx(0)).toBe(0);
  });
});

describe('styles', () => {
  it('reads each cell\'s style index from the sheet XML, empty styled cells included', () => {
    const xml = '<sheetData><row r="1"><c r="A1" s="3" t="s"><v>0</v></c><c r="B1" s="5"/><c r="C1"><v>1</v></c></row></sheetData><cols><col min="1"/></cols>';
    expect([...readCellStyleIndex(xml)]).toEqual([['A1', 3], ['B1', 5]]);
  });

  it('maps sheet names to their XML parts through the workbook rels', () => {
    const wbXml = '<sheets><sheet name="A &amp; B" sheetId="1" r:id="rId2"/><sheet name="Chart" sheetId="2" r:id="rId1"/></sheets>';
    const rels = '<Relationship Id="rId1" Type="x" Target="chartsheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="/xl/worksheets/sheet1.xml"/>';
    expect([...sheetXmlPaths(wbXml, rels)]).toEqual([['A & B', 'xl/worksheets/sheet1.xml'], ['Chart', 'xl/chartsheets/sheet1.xml']]);
  });

  it('resolves rgb, theme with tint, indexed and automatic colours', () => {
    const theme = [{ rgb: 'FFFFFF' }, { rgb: '000000' }];
    expect(resolveColor({ rgb: 'FF0070C0' }, theme)).toBe('#0070C0');
    expect(resolveColor({ theme: 0 }, theme)).toBe('#FFFFFF');
    expect(resolveColor({ theme: 1, tint: 0.5 }, theme)).toBe('#808080');
    expect(resolveColor({ indexed: 22 }, theme)).toBe('#C0C0C0');
    expect(resolveColor({ indexed: 64 }, theme)).toBeUndefined();
    expect(resolveColor({ auto: 1 }, theme)).toBeUndefined();
    expect(applyTint('FFFFFF', -0.5)).toBe('808080');
  });

  it('builds fill, font and alignment per cell format', () => {
    const table = buildStyleTable(
      {
        Fonts: [{ sz: 11, color: { rgb: '000000' } }, { bold: 1, italic: 1, sz: 9, color: { rgb: 'FF0000' } }],
        Fills: [{ patternType: 'none' }, { patternType: 'gray125' }, { patternType: 'solid', fgColor: { rgb: 'FFFF00' } }],
        CellXf: [{ fontId: 0, fillId: 0 }, { fontId: 1, fillId: 2, alignment: { horizontal: 'center', vertical: 'top', wrapText: true } }, { fontId: 0, fillId: 1 }],
      },
      [],
    );
    expect(table[0]).toEqual({ size: 11 });
    expect(table[1]).toEqual({ fill: '#FFFF00', bold: true, italic: true, color: '#FF0000', size: 9, hAlign: 'center', vAlign: 'top', wrap: true });
    expect(table[2]).toEqual({ size: 11 });
  });
});

describe('grid geometry', () => {
  const axis = buildAxis([10, 20, 30, 40], 1);
  it('finds the index at a position and the visible range', () => {
    expect([0, 9, 10, 29, 30, 99, 500].map((p) => indexAt(axis, p))).toEqual([0, 0, 1, 1, 2, 3, 3]);
    expect(visibleRange(axis, 15, 20, 0)).toEqual([1, 2]);
    expect(visibleRange(axis, 15, 20, 5)).toEqual([0, 3]);
  });

  it('scales sizes', () => {
    expect(Array.from(buildAxis([10, 20], 1.5).offsets)).toEqual([0, 15, 45]);
  });
});

describe('selection and merges', () => {
  const wb = book({ S: { aoa: [['a', null, 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']], merges: ['A1:B2'] } });
  const s = wb.sheets[0];

  it('moves like Excel: a merge is one stop and is left past its far edge', () => {
    expect(moveSelection(s, { r: 0, c: 0 }, 'right')).toEqual({ r: 0, c: 2 });
    expect(moveSelection(s, { r: 0, c: 0 }, 'down')).toEqual({ r: 2, c: 0 });
    expect(moveSelection(s, { r: 0, c: 2 }, 'left')).toEqual({ r: 0, c: 0 });
    expect(moveSelection(s, { r: 2, c: 1 }, 'up')).toEqual({ r: 0, c: 0 });
    expect(moveSelection(s, { r: 0, c: 0 }, 'up')).toEqual({ r: 0, c: 0 });
  });

  it('grows a region over every merge it touches', () => {
    expect(expandToMerges(s, { r1: 1, c1: 1, r2: 1, c2: 2 })).toEqual({ r1: 0, c1: 0, r2: 1, c2: 2 });
  });

  it('spills text only over empty, unmerged neighbours', () => {
    const w = book({ S: { aoa: [['long text', null, null, 'x'], ['t', null], ['u', null, null]], merges: ['C3:D3'] } });
    expect(spillColumns(w.sheets[0], 0, 0, 10)).toBe(2);
    expect(spillColumns(w.sheets[0], 2, 0, 10)).toBe(1);
    expect(spillColumns(w.sheets[0], 0, 0, 1)).toBe(1);
  });
});

describe('Excel source highlights', () => {
  const wb = book({
    First: { aoa: [['x']] },
    Data: { aoa: [[], ['Name', 'Min', 'Max'], ['U', 2.5, 4.2], ['I_dch', -150, '150 A']], merges: ['B2:C2'] },
  });

  it('picks the sheet by page number first, then by name', () => {
    expect(resolveSheet(src({ pageNumber: 2 }), wb)).toEqual({ index: 1, by: 'page' });
    expect(resolveSheet(src({ pageNumber: 9, tableName: 'data' }), wb)).toEqual({ index: 1, by: 'name' });
    expect(resolveSheet(src({}), wb)).toEqual({ index: -1, by: 'none' });
  });

  it('reads the Docling table box as 0-based, end-exclusive cells', () => {
    // Docling's bbox for a table at B2:C4 is (col 1, row 1, col 3, row 4).
    const bbox = formatBoundingBox({ x0: 1, y0: 1, x1: 3, y1: 4 });
    const t = resolveExcelTarget(src({ pageNumber: 2, boundingBox: bbox }), wb, '4.2');
    expect(t?.region).toEqual({ r1: 1, c1: 1, r2: 3, c2: 2 });
    expect(t?.matches).toEqual([{ r: 2, c: 2 }]);
  });

  it('honours 1-based cell coordinates, expanded over a merge', () => {
    const t = resolveExcelTarget(src({ pageNumber: 2, cellCoordinates: { row: 2, column: 3 } }), wb);
    expect(t?.region).toEqual({ r1: 1, c1: 1, r2: 1, c2: 2 });
  });

  it('matches values ignoring sign and through the shown text, never across units', () => {
    const s = wb.sheets[1];
    const all = { r1: 0, c1: 0, r2: 3, c2: 2 };
    expect(matchValue(s, all, '-150').matches).toEqual([{ r: 3, c: 1 }, { r: 3, c: 2 }]);
    expect(matchValue(s, all, '0.15').matches).toEqual([]);
    expect(matchValue(s, all, 'u').matches).toEqual([{ r: 2, c: 0 }]);
    expect(parseCandidateNumber('1,5')).toBe(1.5);
    expect(parseCandidateNumber('4.2 V')).toBeNull();
  });

  it('labels a backend box as a cell range without the workbook', () => {
    expect(boxRangeLabel(formatBoundingBox({ x0: 1, y0: 9, x1: 4, y1: 15 }))).toBe('B10:D15');
    expect(boxRangeLabel(formatBoundingBox({ x0: 2, y0: 11, x1: 3, y1: 12 }))).toBe('C12');
    expect(boxRangeLabel(null)).toBeNull();
  });

  it('gives a sheet without a region when the source has no box', () => {
    expect(resolveExcelTarget(src({ pageNumber: 1 }), wb)).toMatchObject({ sheetIndex: 0, region: null, matches: [] });
  });
});
