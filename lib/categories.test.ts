import { describe, expect, it } from 'vitest';
import {
  OTHER_CATEGORY,
  compareCategories,
  resolveCategory,
  tallyByCategory,
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

describe('tallyByCategory', () => {
  it('counts totals and filled per category, including an empty known category', () => {
    const fields = [field('U_MIN', 1), field('U_MAX', 0), field('EOL_FCE', 1)];
    const canonicalList = [
      canonical('U_MIN', 'Voltage'),
      canonical('U_MAX', 'Voltage'),
      canonical('EOL_FCE', 'End_Of_Life'),
    ];

    const tallies = tallyByCategory(fields, canonicalList);
    expect(tallies.map((t) => [t.category.label, t.total, t.filled])).toEqual([
      ['Voltage', 2, 1],
      ['End of life', 1, 1],
    ]);
  });

  it('buckets a field with no canonical match into Other instead of dropping it', () => {
    const tallies = tallyByCategory([field('MYSTERY_FIELD', 0)], []);
    expect(tallies).toEqual([{ category: OTHER_CATEGORY, total: 1, filled: 0 }]);
  });
});
