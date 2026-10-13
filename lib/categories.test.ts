import { describe, expect, it } from 'vitest';
import {
  OTHER_CATEGORY,
  compareCategories,
  groupFields,
  resolveCategory,
} from './categories';
import type { InputField } from '@/types';
import type { ProjectParameter } from '@/api/projects';
import { dbParamToInputField } from '@/lib/parameter-adapter';

const field = (id: string, specCount: number, category?: string | null): InputField => ({
  category,
  id,
  dbId: id,
  label: id,
  specifications: Array.from({ length: specCount }, (_, i) => ({
    id: `${id}-${i}`,
    candidateId: `${id}-${i}`,
    value: '1',
    confidence: 90,
    unit: 'V',
    source: null,
    calculated: false,
    rule_passed: true,
    rule_violations: [],
    requires_review: false,
  })),
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
});

describe('resolveCategory (AM9)', () => {
  it('matches the three real spellings to the same known entry', () => {
    const variants = ['End_Of_Life', 'END_OF_LIFE', 'end of life'];
    for (const raw of variants) {
      const resolved = resolveCategory(raw);
      expect(resolved.key).toBe('END_OF_LIFE');
      expect(resolved.label).toBe('End of life');
    }
  });

  it('humanizes an unknown category rather than dropping it', () => {
    const resolved = resolveCategory('SAFETY_LIMITS');
    expect(resolved.label).toBe('Safety Limits');
    expect(resolved.order).toBeGreaterThan(0);
  });

  it('treats null/empty as Other', () => {
    expect(resolveCategory(null)).toEqual(OTHER_CATEGORY);
    expect(resolveCategory('')).toEqual(OTHER_CATEGORY);
  });
});

describe('compareCategories', () => {
  it('orders known categories first, then unknown alphabetically, then Other', () => {
    const order = [
      resolveCategory('Current'),
      resolveCategory('Voltage'),
      resolveCategory('Zeta'),
      resolveCategory('Alpha'),
      OTHER_CATEGORY,
    ].sort(compareCategories).map((c) => c.label);

    expect(order).toEqual(['Voltage', 'Current', 'Alpha', 'Zeta', 'Other']);
  });
});

describe('groupFields (AM3, AM9; category read from the parameter since 3.5)', () => {
  const labels = (groups: ReturnType<typeof groupFields>) => groups.map((g) => g.category.label);

  it('returns every known category in the fixed order, even when empty', () => {
    const groups = groupFields([]);
    expect(labels(groups)).toEqual(['Voltage', 'Current', 'Temperature', 'Capacity', 'End of life']);
    expect(groups.every((g) => g.fields.length === 0 && g.found === 0)).toBe(true);
  });

  it('puts End of Life parameters in the End of life group for all three spellings', () => {
    for (const spelling of ['End_Of_Life', 'END_OF_LIFE', 'end of life']) {
      const groups = groupFields([field('EOL_FCE', 1, spelling)]);
      const eol = groups.find((g) => g.category.key === 'END_OF_LIFE');
      expect(eol?.fields.map((f) => f.id)).toEqual(['EOL_FCE']);
      // No stray unknown group for the raw spelling.
      expect(groups).toHaveLength(5);
    }
  });

  it('counts found per group from the selected value, and keeps empty known groups', () => {
    const fields = [field('U_MIN', 1, 'Voltage'), field('U_MAX', 0, 'Voltage'), field('EOL_FCE', 1, 'End_Of_Life')];
    const groups = groupFields(fields);
    expect(groups.map((g) => [g.category.label, g.fields.length, g.found])).toEqual([
      ['Voltage', 2, 1],
      ['Current', 0, 0],
      ['Temperature', 0, 0],
      ['Capacity', 0, 0],
      ['End of life', 1, 1],
    ]);
  });

  it('appends an unknown category with a humanised label, then Other last', () => {
    const groups = groupFields([
      field('MYSTERY_FIELD', 0),
      field('R_INTERNAL', 1, 'INTERNAL_RESISTANCE'),
      field('U_MIN', 1, 'Voltage'),
    ]);
    expect(labels(groups)).toEqual([
      'Voltage', 'Current', 'Temperature', 'Capacity', 'End of life', 'Internal Resistance', 'Other',
    ]);
    expect(groups.at(-1)?.category).toEqual(OTHER_CATEGORY);
    expect(groups.at(-1)?.fields.map((f) => f.id)).toEqual(['MYSTERY_FIELD']);
  });

  it('puts a null or empty category in Other, never drops the row', () => {
    const groups = groupFields([field('A', 1, null), field('B', 1, '  ')]);
    expect(groups.at(-1)?.category).toEqual(OTHER_CATEGORY);
    expect(groups.at(-1)?.fields.map((f) => f.id)).toEqual(['A', 'B']);
  });

  it('omits Other when every field has a category', () => {
    const groups = groupFields([field('U_MIN', 1, 'Voltage')]);
    expect(labels(groups)).not.toContain('Other');
  });
});

describe('dbParamToInputField carries category (3.5)', () => {
  it('reads category from the payload row', () => {
    const f = dbParamToInputField({ id: 'pp', parameter_key: 'U_MIN', parameter_alias: 'U', category: 'Voltage', parameter_id: 'canon', candidates: [] } as unknown as ProjectParameter);
    expect(f.category).toBe('Voltage');
    expect(f.dbId).toBe('pp'); // keyed on the row id, never parameter_id
  });
});
