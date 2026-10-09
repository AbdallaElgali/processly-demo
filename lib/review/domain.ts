/**
 * Battery-domain display helpers (CLAUDE.md 7, RFC 4.2).
 *
 * The backend has no qualifier or C-rate field (plan-A 11), so both are
 * derived here from what the payload does carry: the parameter key and the
 * unit string. Every tag these produce is labelled in the UI as derived.
 */

export type QualifierTag = 'MIN' | 'MAX' | 'NOM' | 'TYP' | 'SAFETY' | 'PULSE' | 'CONTINUOUS' | 'DYN';

/** Primary qualifier first (min/typ/max/nominal), then the secondary ones, in key order. */
const PRIMARY: ReadonlyArray<[RegExp, QualifierTag]> = [
  [/(^|_)MIN(_|$)/, 'MIN'],
  [/(^|_)MAX(_|$)/, 'MAX'],
  [/(^|_)(NOM|NOMINAL)(_|$)/, 'NOM'],
  [/(^|_)TYP(_|$)/, 'TYP'],
];
const SECONDARY: ReadonlyArray<[RegExp, QualifierTag]> = [
  [/(^|_)SAFETY(_|$)/, 'SAFETY'],
  [/(^|_)PULSE(_|$)/, 'PULSE'],
  [/(^|_)CONTINUOUS(_|$)/, 'CONTINUOUS'],
  [/(^|_)DYN(_|$)/, 'DYN'],
];

/**
 * `U_MIN_SAFETY` -> ['MIN', 'SAFETY']; `C_NOMINAL_AH` -> ['NOM'];
 * `EOL_SOH_NOM` -> ['NOM']. A key with none of these gets [].
 */
export function qualifierTags(parameterKey: string): QualifierTag[] {
  const key = parameterKey.toUpperCase();
  const tags: QualifierTag[] = [];
  for (const [re, tag] of PRIMARY) if (re.test(key)) tags.push(tag);
  for (const [re, tag] of SECONDARY) if (re.test(key)) tags.push(tag);
  return tags;
}

/** `I_MAX_DCH_*`: stored negative by design (CLAUDE.md 7). Never "fixed". */
export function isDischargeCurrent(parameterKey: string): boolean {
  return /^I_MAX_DCH(_|$)/i.test(parameterKey);
}

export type CurrentBasis = 'c-rate' | 'absolute' | null;

/**
 * C-rate and absolute current are different things (CLAUDE.md 7). A unit of
 * `C` (or a value written like `2C`, `0.5C`, `C/5`) is a C-rate; `A`, `mA`,
 * `kA` are absolute. Anything else is neither, and gets no chip.
 */
export function currentBasis(unit: string | null | undefined, value?: string | null): CurrentBasis {
  const u = (unit ?? '').trim();
  if (/^c$/i.test(u) || /^c-?rate$/i.test(u)) return 'c-rate';
  if (/^(m|k)?a$/i.test(u)) return 'absolute';
  const v = (value ?? '').trim();
  if (/^(\d*\.?\d+\s*C|C\s*\/\s*\d+(\.\d+)?)$/i.test(v)) return 'c-rate';
  return null;
}

/**
 * True when the unit as extracted is not the unit the dictionary expects
 * (e.g. mAh beside Ah). Compared case-sensitively, since mA and MA differ;
 * only surrounding whitespace is ignored.
 */
export function unitDiffers(asExtracted: string | null | undefined, expected: string | null | undefined): boolean {
  const a = (asExtracted ?? '').trim();
  const e = (expected ?? '').trim();
  return a !== '' && e !== '' && a !== e;
}
