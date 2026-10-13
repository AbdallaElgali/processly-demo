/**
 * A1 references. Everything in `lib/excel` is 0-based ({ r: 0, c: 0 } is A1);
 * only the strings shown to the user are 1-based.
 */

export interface CellPos {
  r: number;
  c: number;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function colLetter(c: number): string {
  let s = '';
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** A → 0, AA → 26. Returns -1 for anything that is not letters. */
export function colIndex(letters: string): number {
  if (!/^[A-Za-z]+$/.test(letters)) return -1;
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function cellRef({ r, c }: CellPos): string {
  return `${colLetter(c)}${r + 1}`;
}

/**
 * Parses what a user may type into the name box: `C12`, `c12`, `$C$12`.
 * Returns null for anything else (ranges and sheet-qualified references are
 * not supported).
 */
export function parseRef(input: string): CellPos | null {
  const m = /^\s*\$?([A-Za-z]{1,3})\$?(\d{1,7})\s*$/.exec(input);
  if (!m) return null;
  const c = colIndex(m[1]);
  const r = Number(m[2]) - 1;
  if (c < 0 || r < 0) return null;
  return { r, c };
}
