import type { CanonicalParameter, CanonicalParameterCreate } from '@/api/templates';
import { KNOWN_CATEGORIES, resolveCategory } from '@/lib/categories';

/** Backend name rule (CanonicalParameterCreate.name). */
export const PARAMETER_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,49}$/;
export const PARAMETER_NAME_HINT = 'UPPER_SNAKE_CASE, e.g. U_OCV_REST';

export const NEW_PARAMETER_EXPORT_NOTE = 'New parameters are not written to the .battery export yet.';
export const BUILTIN_NOTE = 'This is a built-in parameter: its description and unit come from code and cannot be changed here.';

export function validateParameterName(name: string): string | null {
  return PARAMETER_NAME_PATTERN.test(name.trim()) ? null : `Use ${PARAMETER_NAME_HINT} (at most 50 characters, starting with a letter).`;
}

/** Exactly the five values the backend accepts, with the app's labels. */
export const CATEGORY_CHOICES: ReadonlyArray<{ value: string; label: string }> = KNOWN_CATEGORIES.map(([key, label]) => ({
  value: key.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('_'),
  label,
}));

export interface NewParameterDraft {
  name: string;
  category: string;
  unit: string;
  description: string;
}

export function buildCreateParameterBody(d: NewParameterDraft): CanonicalParameterCreate {
  return {
    name: d.name.trim(),
    category: d.category,
    expected_unit: d.unit.trim() === '' ? null : d.unit.trim(),
    default_description: d.description.trim(),
  };
}

/** Edit is offered unless the list says the parameter is built in (`is_builtin`, backend S3). */
export function canEditParameter(p: CanonicalParameter): boolean {
  return p.is_builtin !== true;
}

export interface DictionaryGroup {
  key: string;
  label: string;
  parameters: CanonicalParameter[];
}

/** The dictionary by category in the app's order (CLAUDE.md 8.2), names sorted, empty categories left out. */
export function groupDictionary(list: CanonicalParameter[]): DictionaryGroup[] {
  const groups = new Map<string, { order: number; label: string; parameters: CanonicalParameter[] }>();
  for (const p of list) {
    const c = resolveCategory(p.category);
    const g = groups.get(c.key) ?? { order: c.order, label: c.label, parameters: [] };
    g.parameters.push(p);
    groups.set(c.key, g);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order || a[1].label.localeCompare(b[1].label))
    .map(([key, g]) => ({ key, label: g.label, parameters: g.parameters.sort((a, b) => a.name.localeCompare(b.name)) }));
}
