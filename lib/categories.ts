import type { InputField } from '@/types';
import type { CanonicalParameter } from '@/api/templates';

/**
 * Category grouping (D5, CLAUDE.md 8.2).
 *
 * The backend's real category strings, confirmed against
 * GET /extraction-templates/parameters, are Title_Case with underscores
 * (`Voltage`, `Current`, `Temperature`, `Capacity`, `End_Of_Life`) -- not the
 * `UPPER_SNAKE` an earlier version of this plan assumed (AM9). Matching must
 * therefore be case- and separator-insensitive: `End_Of_Life`, `END_OF_LIFE`
 * and `end of life` all have to resolve to the same entry, and labels always
 * come from this map, never from the raw backend string, so display does not
 * change if the backend's casing does.
 */

/** Display order for the categories the backend is known to use. */
export const KNOWN_CATEGORIES: ReadonlyArray<readonly [key: string, label: string]> = [
  ['VOLTAGE', 'Voltage'],
  ['CURRENT', 'Current'],
  ['TEMPERATURE', 'Temperature'],
  ['CAPACITY', 'Capacity'],
  ['END_OF_LIFE', 'End of life'],
];

export const OTHER_CATEGORY_KEY = '__OTHER__';
const OTHER_LABEL = 'Other';

/** Lower-case, with `_` and space treated as the same separator. */
export function normalizeCategoryKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\s]+/g, '_');
}

/** `"end of life"` / `"END_OF_LIFE"` -> `"End Of Life"`, for an unknown category's label. */
export function humanizeCategory(raw: string): string {
  return raw
    .trim()
    .replace(/[_\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const KNOWN_BY_NORMALIZED = new Map(
  KNOWN_CATEGORIES.map(([key, label], index) => [
    normalizeCategoryKey(key),
    { key, label, order: index },
  ]),
);

export interface ResolvedCategory {
  /** Stable key for grouping/lookups -- the known key, or the normalized raw string. */
  key: string;
  label: string;
  /** Known categories first in KNOWN_CATEGORIES order; unknown after; Other last. */
  order: number;
}

const UNKNOWN_ORDER = KNOWN_CATEGORIES.length;
const OTHER_ORDER = UNKNOWN_ORDER + 1;

export const OTHER_CATEGORY: ResolvedCategory = {
  key: OTHER_CATEGORY_KEY,
  label: OTHER_LABEL,
  order: OTHER_ORDER,
};

/** Resolves a raw backend category string (or null/undefined) to a display entry. */
export function resolveCategory(raw: string | null | undefined): ResolvedCategory {
  if (!raw || !raw.trim()) return OTHER_CATEGORY;
  const known = KNOWN_BY_NORMALIZED.get(normalizeCategoryKey(raw));
  if (known) return known;
  // Unknown but present: humanized raw label, appended after every known
  // category rather than dropped (CLAUDE.md 8.2).
  return { key: normalizeCategoryKey(raw), label: humanizeCategory(raw), order: UNKNOWN_ORDER };
}

/** Known categories first (fixed order), then unknown categories alphabetically, then Other. */
export function compareCategories(a: ResolvedCategory, b: ResolvedCategory): number {
  return a.order - b.order || a.label.localeCompare(b.label);
}

export interface CategoryTally {
  category: ResolvedCategory;
  /** Parameters in this project assigned to this category. */
  total: number;
  /** Of those, how many currently have at least one AI candidate. */
  filled: number;
}

/**
 * Per-category totals for the Extract screen's CategoryCards: how many of the
 * project's own parameters fall in each category (joining the canonical
 * dictionary on parameter key, decision D5), and how many of those already
 * have a value. `filled` reflects whatever is in `fields` right now, so it
 * updates live as partial results are merged into the project's fields.
 */
export function tallyByCategory(fields: InputField[], canonical: CanonicalParameter[]): CategoryTally[] {
  const categoryByKey = new Map(canonical.map((p) => [p.name, p.category]));
  const tallies = new Map<string, CategoryTally>();

  for (const field of fields) {
    const resolved = resolveCategory(categoryByKey.get(field.id));
    let tally = tallies.get(resolved.key);
    if (!tally) {
      tally = { category: resolved, total: 0, filled: 0 };
      tallies.set(resolved.key, tally);
    }
    tally.total += 1;
    if (field.specifications.length > 0) tally.filled += 1;
  }

  return [...tallies.values()].sort((a, b) => compareCategories(a.category, b.category));
}
