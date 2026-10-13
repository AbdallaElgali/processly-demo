/**
 * Cell styling from the workbook (AM16 "basic cell styling where the parser
 * exposes it"): fill, font weight/style/colour/size, and alignment.
 *
 * SheetJS community edition parses the style tables (`wb.Styles`) but keeps
 * only the fill on each cell, so the link from a cell to its style record is
 * read here from the `s="N"` attribute in the sheet XML. Borders are not
 * parsed by SheetJS CE and are not drawn; the grid shows gridlines instead.
 *
 * Colours here are document content (the workbook's own colours), not theme
 * tokens: the grid is the document and is drawn as the workbook defines it.
 */

export interface CellStyle {
  fill?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Font size in points. */
  size?: number;
  hAlign?: 'left' | 'center' | 'right' | 'justify';
  vAlign?: 'top' | 'center' | 'bottom';
  wrap?: boolean;
}

interface XlsxColor {
  rgb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
  auto?: number;
}

interface XlsxFont {
  bold?: number | boolean;
  italic?: number | boolean;
  underline?: number | boolean | string;
  sz?: number | string;
  color?: XlsxColor;
}

interface XlsxFill {
  patternType?: string;
  fgColor?: XlsxColor;
  bgColor?: XlsxColor;
}

interface XlsxXf {
  fontId?: number;
  fillId?: number;
  applyAlignment?: boolean;
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean | string | number };
}

export interface XlsxStyles {
  Fonts?: XlsxFont[];
  Fills?: XlsxFill[];
  CellXf?: XlsxXf[];
}

export type ThemeColors = { rgb?: string }[];

// Excel's default indexed palette (legacy colour indices 0-63; 64 and 65 are "automatic").
// prettier-ignore
const INDEXED = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Applies an Excel tint (-1..1) to an RRGGBB colour, in HLS as Excel does. */
export function applyTint(rgb: string, tint: number): string {
  if (!tint) return rgb;
  const n = parseInt(rgb, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  l = clamp01(l);
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let rr = l;
  let gg = l;
  let bb = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rr = hue(p, q, h + 1 / 3);
    gg = hue(p, q, h);
    bb = hue(p, q, h - 1 / 3);
  }
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return (hex(rr) + hex(gg) + hex(bb)).toUpperCase();
}

/** Resolves a workbook colour to `#RRGGBB`, or undefined for "automatic". */
export function resolveColor(c: XlsxColor | undefined, theme: ThemeColors): string | undefined {
  if (!c || c.auto) return undefined;
  let rgb: string | undefined;
  // SheetJS stores ARGB as 8 digits and RGB as 6; it already resolves tinted theme fills into `rgb`.
  if (c.rgb && /^[0-9A-Fa-f]{6,8}$/.test(c.rgb)) rgb = c.rgb.slice(-6);
  else if (typeof c.theme === 'number' && theme[c.theme]?.rgb) rgb = applyTint(theme[c.theme].rgb as string, c.tint ?? 0);
  else if (typeof c.indexed === 'number' && INDEXED[c.indexed]) rgb = INDEXED[c.indexed];
  return rgb ? `#${rgb.toUpperCase()}` : undefined;
}

const truthy = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true' || v === 'single' || v === 'double';

/** One `CellStyle` per cell-format record (`CellXf`), so cells share style objects by index. */
export function buildStyleTable(styles: XlsxStyles | undefined, theme: ThemeColors): (CellStyle | null)[] {
  const xfs = styles?.CellXf ?? [];
  return xfs.map((xf) => {
    const out: CellStyle = {};
    const font = xf.fontId !== undefined ? styles?.Fonts?.[xf.fontId] : undefined;
    const fill = xf.fillId !== undefined ? styles?.Fills?.[xf.fillId] : undefined;
    if (fill && fill.patternType && fill.patternType !== 'none' && fill.patternType !== 'gray125') {
      // A solid fill is in fgColor; other patterns are approximated by their foreground colour.
      const f = resolveColor(fill.fgColor, theme) ?? resolveColor(fill.bgColor, theme);
      if (f) out.fill = f;
    }
    if (font) {
      if (truthy(font.bold)) out.bold = true;
      if (truthy(font.italic)) out.italic = true;
      if (truthy(font.underline)) out.underline = true;
      const color = resolveColor(font.color, theme);
      // Black is the default text colour; leaving it unset keeps the document token.
      if (color && color !== '#000000') out.color = color;
      const size = Number(font.sz);
      if (Number.isFinite(size) && size > 0) out.size = size;
    }
    const a = xf.alignment;
    if (a) {
      if (a.horizontal === 'left' || a.horizontal === 'center' || a.horizontal === 'right' || a.horizontal === 'justify') out.hAlign = a.horizontal;
      else if (a.horizontal === 'centerContinuous') out.hAlign = 'center';
      if (a.vertical === 'top' || a.vertical === 'bottom') out.vAlign = a.vertical;
      else if (a.vertical === 'center') out.vAlign = 'center';
      if (truthy(a.wrapText)) out.wrap = true;
    }
    return Object.keys(out).length ? out : null;
  });
}

/**
 * `{ "A1": 3, "B7": 12 }` from one sheet's XML: each cell's style index.
 * Includes empty cells that only carry a fill, which SheetJS drops.
 */
export function readCellStyleIndex(sheetXml: string): Map<string, number> {
  const out = new Map<string, number>();
  const re = /<c\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sheetXml))) {
    const attrs = m[1];
    const r = /\br="([A-Z]+\d+)"/.exec(attrs);
    const s = /\bs="(\d+)"/.exec(attrs);
    if (r && s) out.set(r[1], Number(s[1]));
  }
  return out;
}

/**
 * Sheet name → path of its XML part, from `xl/workbook.xml` and its rels.
 * Returns an empty map when either part is missing (e.g. a non-OOXML file).
 */
export function sheetXmlPaths(workbookXml: string, relsXml: string): Map<string, string> {
  const rels = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  const out = new Map<string, string>();
  for (const m of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = /\bname="([^"]*)"/.exec(m[1])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1] ?? /\bid="([^"]+)"/.exec(m[1])?.[1];
    const path = rid ? rels.get(rid) : undefined;
    if (name !== undefined && path) out.set(decodeXmlAttr(name), path);
  }
  return out;
}

function decodeXmlAttr(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}
