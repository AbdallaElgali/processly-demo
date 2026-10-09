/** Excel viewer constants (AM16). Sizes are CSS pixels at 100 % zoom. */

/** Excel's default column width (8.43 characters of an 11 pt font). */
export const DEFAULT_COL_PX = 64;
/** Excel's default row height (15 pt). */
export const DEFAULT_ROW_PX = 20;
/** Maximum digit width used to turn the workbook's character widths into pixels. */
export const MAX_DIGIT_WIDTH_PX = 7;
export const ROW_HEADER_PX = 44;
export const COL_HEADER_PX = 22;

/** Empty rows and columns drawn past the used range, so a small sheet still reads as a sheet. */
export const MIN_ROWS = 60;
export const MIN_COLS = 26;
export const EXTRA_ROWS = 20;
export const EXTRA_COLS = 4;

/** Rows and columns rendered beyond the visible area on each side. */
export const OVERSCAN_ROWS = 6;
export const OVERSCAN_COLS = 3;

/** Text spills into empty cells to its right, as in Excel, up to this many columns. */
export const MAX_SPILL_COLS = 12;

/** Cells inside a source region that match the value are marked, up to this many. */
export const MAX_VALUE_MATCHES = 50;

/** Parsed workbooks kept in memory, so a viewer that remounts does not re-parse. */
export const PARSE_CACHE_SIZE = 5;

export const ZOOM_STEPS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2] as const;
