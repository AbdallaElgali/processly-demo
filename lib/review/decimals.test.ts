import { describe, expect, it } from 'vitest';
import { formatDisplayValue } from './format';
import { dbParamToInputField, inputFieldToParameterInput } from '@/lib/parameter-adapter';
import type { ProjectParameter } from '@/api/projects';

// Backend 3.6: values arrive in their shortest form ("3.65", not 3.6499999...),
// as a JSON string (final_value from NUMERIC) or number (candidates via jsonb).
const row = (final_value: unknown, over: Partial<ProjectParameter> = {}): ProjectParameter =>
  ({
    id: 'row-1', parameter_key: 'U_MIN', parameter_alias: 'Min voltage',
    final_value, final_unit: 'V', is_human_modified: true,
    selected_candidate_id: 'c-1', review_action: 'MODIFIED', reviewed_at: null,
    human_flagged: false, active_flag_id: null, flag_reason: null, flagger_id: null,
    confidence: null, source_text_snippet: null, source_page_number: null,
    description_override: null, ai_instructions: null,
    candidates: [{ id: 'c-1', ai_value: final_value, unit: 'V', confidence: 0.9 }],
    ...over,
  }) as unknown as ProjectParameter;

describe('formatDisplayValue with short-form values', () => {
  it.each([
    ['3.65', '3.65'], [3.65, '3.65'],
    ['-500', '-500'], [-500, '-500'],
    ['4.20', '4.2'], [4.2, '4.2'],
    ['500', '500'], ['-2.3', '-2.3'], ['0', '0'], ['4.2094', '4.2094'],
  ])('shows %j as %s', (raw, shown) => {
    expect(formatDisplayValue(raw as string | number)).toBe(shown);
  });
});

describe('the adapter with short-form values', () => {
  it.each([['3.65'], ['-500'], ['4.20'], [3.65], [-500], [4.2]])('keeps %j as the row value', (raw) => {
    const field = dbParamToInputField(row(raw));
    const spec = field.specifications.find((s) => s.id === field.selectedSpecId)!;
    expect(spec.value).toBe(String(raw));
  });

  it.each([
    ['3.65', 3.65], ['-500', -500], ['4.20', 4.2], [3.65, 3.65], [-500, -500],
  ])('saves %j as the number %s, unchanged', (raw, sent) => {
    const input = inputFieldToParameterInput(dbParamToInputField(row(raw)), 'u-1');
    expect(input.final_value).toBe(sent);
  });

  it('reads a candidate ai_value given as a string or a number', () => {
    const field = dbParamToInputField(row(null, {
      is_human_modified: false, review_action: 'PENDING',
      candidates: [
        { id: 'c-1', ai_value: '3.65', unit: 'V', confidence: 0.9 },
        { id: 'c-2', ai_value: -500, unit: 'A', confidence: 0.8 },
      ] as ProjectParameter['candidates'],
    }));
    expect(field.specifications.map((s) => s.value)).toEqual(['3.65', '-500']);
  });
});
