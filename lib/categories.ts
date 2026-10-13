import type { InputField } from '@/types';

/**
 * Category grouping (CLAUDE.md 8.2; D5 superseded by backend step 3.5).
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

export interface FieldGroup {
  category: ResolvedCategory;
  fields: InputField[];
  /** Parameters in this group whose selected candidate has a value. */
  found: number;
}

function fieldHasValue(field: InputField): boolean {
  const spec = field.specifications.find((s) => s.id === field.selectedSpecId) ?? field.specifications[0];
  return !!spec && String(spec.value ?? '').trim() !== '';
}

/**
 * Groups a project's parameters by category for the Workspace table (D5,
 * CLAUDE.md 8.2, AM9).
 *
 * - Each field's category is the one on its own project parameter (backend
 *   step 3.5, B4). The D5 join against the canonical dictionary is gone.
 * - **Every known category is returned, even with zero fields**, so a missing
 *   End of Life block is visible rather than silently absent.
 * - Unknown categories are appended with a humanised label; fields with
 *   no category go to Other. Both appear only when non-empty.
 * - Order within a group is the input order (the backend already sorts by
 *   category then name); callers re-sort for "needs review first".
 */
export function groupFields(fields: InputField[]): FieldGroup[] {
  const groups = new Map<string, FieldGroup>();

  for (const [key] of KNOWN_CATEGORIES) {
    const category = resolveCategory(key);
    groups.set(category.key, { category, fields: [], found: 0 });
  }

  for (const field of fields) {
    const category = resolveCategory(field.category);
    let group = groups.get(category.key);
    if (!group) {
      group = { category, fields: [], found: 0 };
      groups.set(category.key, group);
    }
    group.fields.push(field);
    if (fieldHasValue(field)) group.found += 1;
  }

  return [...groups.values()]
    .filter((g) => g.fields.length > 0 || g.category.order < KNOWN_CATEGORIES.length)
    .sort((a, b) => compareCategories(a.category, b.category));
}
