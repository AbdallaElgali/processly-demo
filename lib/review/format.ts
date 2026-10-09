/**
 * Display-only number formatting (AM10).
 *
 * `final_value` arrives serialised from a Postgres Decimal, so a stored 2.3 can
 * come back as 2.29999999999999982 (Task B, B11). The table rounds what it
 * SHOWS to at most 6 significant digits with trailing zeros stripped. The
 * underlying string in the field is never replaced, so saving an untouched row
 * sends back exactly what was loaded.
 */
export const DISPLAY_SIGNIFICANT_DIGITS = 6;

export function formatDisplayValue(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const text = String(raw).trim();
  if (text === '') return '';
  const n = Number(text);
  // Not a number (a value an engineer typed as text): show it verbatim.
  if (!Number.isFinite(n)) return text;
  if (n === 0) return '0';
  // toPrecision then Number() strips trailing zeros and avoids "2.300000";
  // String() of the result keeps ordinary notation for everyday magnitudes.
  return String(Number(n.toPrecision(DISPLAY_SIGNIFICANT_DIGITS)));
}
