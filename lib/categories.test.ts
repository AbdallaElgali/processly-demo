import { describe, expect, it } from 'vitest';
import {
  OTHER_CATEGORY,
  compareCategories,
  groupFields,
  resolveCategory,
} from './categories';
import type { InputField } from '@/types';
import type { CanonicalParameter } from '@/api/templates';

const field = (id: string, specCount: number): InputField => ({
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

const canonical = (name: string, category: string | null): CanonicalParameter => ({
  id: name,
  name,
  category,
  default_description: null,
  expected_unit: null,
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

describe('groupFields (AM3, AM9)', () => {
  const labels = (groups: ReturnType<typeof groupFields>) => groups.map((g) => g.category.label);

  it('returns every known category in the fixed order, even when empty', () => {
    const groups = groupFields([], []);
    expect(labels(groups)).toEqual(['Voltage', 'Current', 'Temperature', 'Capacity', 'End of life']);
    expect(groups.every((g) => g.fields.length === 0 && g.found === 0)).toBe(true);
  });

  it('puts End of Life parameters in the End of life group for all three spellings', () => {
    for (const spelling of ['End_Of_Life', 'END_OF_LIFE', 'end of life']) {
      const groups = groupFields([field('EOL_FCE', 1)], [canonical('EOL_FCE', spelling)]);
      const eol = groups.find((g) => g.category.key === 'END_OF_LIFE');
      expect(eol?.fields.map((f) => f.id)).toEqual(['EOL_FCE']);
      // No stray unknown group for the raw spelling.
      expect(groups).toHaveLength(5);
    }
  });

  it('counts found per group from the selected value, and keeps empty known groups', () => {
    const fields = [field('U_MIN', 1), field('U_MAX', 0), field('EOL_FCE', 1)];
    const groups = groupFields(fields, [
      canonical('U_MIN', 'Voltage'),
      canonical('U_MAX', 'Voltage'),
      canonical('EOL_FCE', 'End_Of_Life'),
    ]);
    expect(groups.map((g) => [g.category.label, g.fields.length, g.found])).toEqual([
      ['Voltage', 2, 1],
      ['Current', 0, 0],
      ['Temperature', 0, 0],
      ['Capacity', 0, 0],
      ['End of life', 1, 1],
    ]);
  });

  it('appends an unknown category with a humanised label, then Other last', () => {
    const groups = groupFields(
      [field('MYSTERY_FIELD', 0), field('R_INTERNAL', 1), field('U_MIN', 1)],
      [canonical('R_INTERNAL', 'INTERNAL_RESISTANCE'), canonical('U_MIN', 'Voltage')],
    );
    expect(labels(groups)).toEqual([
      'Voltage', 'Current', 'Temperature', 'Capacity', 'End of life', 'Internal Resistance', 'Other',
    ]);
    expect(groups.at(-1)?.category).toEqual(OTHER_CATEGORY);
    expect(groups.at(-1)?.fields.map((f) => f.id)).toEqual(['MYSTERY_FIELD']);
  });

  it('omits Other when every field matched', () => {
    const groups = groupFields([field('U_MIN', 1)], [canonical('U_MIN', 'Voltage')]);
    expect(labels(groups)).not.toContain('Other');
  });
});
