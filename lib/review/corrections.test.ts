import { describe, expect, it } from 'vitest';
import type { InputField, Specification } from '@/types';
import type { ProjectParameter } from '@/api/projects';
import { dbParamToInputField } from '@/lib/parameter-adapter';
import {
  availableRowActions,
  canRevertCorrection,
  correctionBadge,
  REVERT_CONFLICT_TEXT,
  summarizeOutcomes,
  supersededCandidateId,
  type LatestCorrection,
} from './corrections';
import { candidateFacts, whyThisValue } from './why';

const spec = (over: Partial<Specification> = {}): Specification => ({
  id: 'c-new',
  candidateId: 'c-new',
  value: '4.2',
  confidence: 90,
  unit: 'V',
  source: null,
  calculated: false,
  rule_passed: true,
  rule_violations: [],
  requires_review: false,
  ...over,
});

const correction = (over: Partial<LatestCorrection> = {}): LatestCorrection => ({
  correction_id: 'k-1',
  outcome: 'new_value',
  previous_candidate_id: 'c-old',
  new_candidate_id: 'c-new',
  previous_value: '4.3',
  previous_unit: 'V',
  previous_is_human_modified: false,
  reverted_at: null,
  created_at: '2026-11-01T18:30:00+00:00',
  ...over,
});

const field = (
  over: Partial<InputField> = {},
  specs: Specification[] = [spec(), spec({ id: 'c-old', candidateId: 'c-old', value: '4.3' })],
): InputField => ({
  id: 'U_MAX',
  dbId: 'pp-1',
  label: 'U max',
  specifications: specs,
  selectedSpecId: 'c-new',
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
  latestCorrection: correction(),
  ...over,
});

describe('Revert is shown only under the contract rule', () => {
  it('new_value, not reverted, selection is the new candidate', () => {
    expect(canRevertCorrection(field())).toBe(true);
  });
  it('not for confirmed or no_new_value', () => {
    expect(canRevertCorrection(field({ latestCorrection: correction({ outcome: 'confirmed' }) }))).toBe(false);
    expect(canRevertCorrection(field({ latestCorrection: correction({ outcome: 'no_new_value', new_candidate_id: null }) }))).toBe(false);
  });
  it('not once reverted', () => {
    expect(canRevertCorrection(field({ latestCorrection: correction({ reverted_at: '2026-11-01T19:00:00+00:00' }) }))).toBe(false);
  });
  it('not when another candidate is selected now', () => {
    expect(canRevertCorrection(field({ selectedSpecId: 'c-old' }))).toBe(false);
  });
  it('not without a correction', () => {
    expect(canRevertCorrection(field({ latestCorrection: null }))).toBe(false);
  });
});

describe('outcome badges', () => {
  it('new_value: corrected, with the previous value and unit', () => {
    expect(correctionBadge(field())).toMatchObject({ kind: 'corrected', text: 'Corrected · was 4.3 V', revertable: true });
  });
  it('confirmed', () => {
    expect(correctionBadge(field({ latestCorrection: correction({ outcome: 'confirmed' }) }))).toMatchObject({
      kind: 'confirmed',
      text: 'AI confirmed the same value',
      revertable: false,
    });
  });
  it('no_new_value', () => {
    expect(correctionBadge(field({ latestCorrection: correction({ outcome: 'no_new_value' }) }))).toMatchObject({
      kind: 'none',
      text: 'No new value found',
    });
  });
  it('a reverted correction shows no badge', () => {
    expect(correctionBadge(field({ latestCorrection: correction({ reverted_at: '2026-11-01T19:00:00+00:00' }) }))).toBeNull();
  });
  it('an error for this parameter shows the backend message and wins over the old badge', () => {
    expect(correctionBadge(field(), 'No document mentions it.')).toMatchObject({
      kind: 'error',
      text: expect.stringContaining('No document mentions it.'),
    });
  });
  it('no correction, no error: no badge', () => {
    expect(correctionBadge(field({ latestCorrection: null }))).toBeNull();
  });
});

describe('batch summary', () => {
  it('counts each outcome and leaves out zeros', () => {
    const outcomes = [
      { parameter: 'A', outcome: 'new_value' },
      { parameter: 'B', outcome: 'new_value' },
      { parameter: 'C', outcome: 'new_value' },
      { parameter: 'D', outcome: 'confirmed' },
      { parameter: 'E', outcome: 'no_new_value' },
    ] as never;
    expect(summarizeOutcomes(outcomes, 0)).toBe('3 corrected, 1 confirmed, 1 nothing new');
    expect(summarizeOutcomes([{ parameter: 'A', outcome: 'confirmed' }] as never, 2)).toBe('1 confirmed, 2 failed');
    expect(summarizeOutcomes([], 0)).toBeNull();
  });
});

describe('409 text', () => {
  it('is the plain sentence from the brief', () => {
    expect(REVERT_CONFLICT_TEXT).toBe("This value was changed after the correction, so it can't be reverted automatically.");
  });
});

describe('row actions: impossible ones are hidden', () => {
  it('offers Edit, Retry and Pick alternative on an idle row with two valued candidates, Revert by rule', () => {
    expect(availableRowActions(field(), { busy: false, correcting: false })).toEqual({ edit: true, retry: true, pick: true, revert: true });
  });
  it('hides Pick with one candidate and Revert without a correction', () => {
    const one = field({ latestCorrection: null }, [spec()]);
    expect(availableRowActions(one, { busy: false, correcting: false })).toEqual({ edit: true, retry: true, pick: false, revert: false });
  });
  it('hides Retry when there is no candidate to flag, or a correction is running', () => {
    const none = field({ latestCorrection: null, specifications: [], selectedSpecId: undefined });
    expect(availableRowActions(none, { busy: false, correcting: false }).retry).toBe(false);
    expect(availableRowActions(field(), { busy: false, correcting: true }).retry).toBe(false);
  });
  it('hides everything while the row is busy', () => {
    expect(availableRowActions(field(), { busy: true, correcting: false })).toEqual({ edit: false, retry: false, pick: false, revert: false });
  });
});

describe('the superseded candidate', () => {
  it('is the previous one while the correction is unreverted', () => {
    expect(supersededCandidateId(field())).toBe('c-old');
    expect(supersededCandidateId(field({ latestCorrection: correction({ reverted_at: 'x' }) }))).toBeNull();
    expect(supersededCandidateId(field({ latestCorrection: correction({ outcome: 'confirmed' }) }))).toBeNull();
  });
});

describe('adapter reads latest_correction and the rule fields', () => {
  it('maps them from the project payload', () => {
    const row = {
      id: 'pp-1',
      parameter_key: 'U_MAX',
      parameter_alias: 'U max',
      final_value: 4.2,
      final_unit: 'V',
      is_human_modified: false,
      selected_candidate_id: 'c-new',
      review_action: 'PENDING',
      latest_correction: correction(),
      candidates: [
        {
          id: 'c-new',
          ai_value: 4.2,
          unit: 'V',
          confidence: 0.77,
          confidence_raw: 0.92,
          original_value: 4200,
          original_unit: 'mV',
          rule_results: [{ code: 'R-RANGE', severity: 'soft', penalty: -0.15, text: 'Outside the usual range.' }],
        },
      ],
    } as unknown as ProjectParameter;
    const f = dbParamToInputField(row);
    expect(f.latestCorrection?.correction_id).toBe('k-1');
    const s = f.specifications[0];
    expect(s.originalValue).toBe('4200');
    expect(s.originalUnit).toBe('mV');
    expect(s.confidenceRaw).toBeCloseTo(92);
    expect(s.ruleResults?.[0].text).toBe('Outside the usual range.');
  });
});

describe('candidate facts for "Why this value"', () => {
  const f = field();
  it('shows "Converted from" only when original value or unit differ', () => {
    expect(candidateFacts(spec({ originalValue: '4200', originalUnit: 'mV' }), f).convertedFrom).toBe('4200 mV');
    expect(candidateFacts(spec({ originalValue: '4.2', originalUnit: 'V' }), f).convertedFrom).toBeNull();
    expect(candidateFacts(spec(), f).convertedFrom).toBeNull();
  });
  it('shows both confidences when present and different, one when equal or raw is missing', () => {
    expect(candidateFacts(spec({ confidence: 77, confidenceRaw: 92 }), f).confidence).toBe('77% after checks (92% before)');
    expect(candidateFacts(spec({ confidence: 90, confidenceRaw: 90 }), f).confidence).toBe('90%');
    expect(candidateFacts(spec({ confidence: 90 }), f).confidence).toBe('90%');
    expect(candidateFacts(spec({ confidence: null }), f).confidence).toBeNull();
  });
  it('turns rule results into plain sentences by severity', () => {
    const rules = candidateFacts(
      spec({
        ruleResults: [
          { code: 'R-RANGE', severity: 'soft', penalty: -0.15, text: 'Outside the usual range.' },
          { code: 'R-UNIT', severity: 'hard', penalty: -0.3, text: 'Unit does not match.' },
          { code: 'R-SIGN', severity: 'info', penalty: 0, text: 'Sign was adjusted.' },
        ],
      }),
      f,
    ).rules;
    expect(rules).toEqual([
      { severity: 'soft', label: 'Warning', text: 'Outside the usual range.' },
      { severity: 'hard', label: 'Failed check', text: 'Unit does not match.' },
      { severity: 'info', label: 'Note', text: 'Sign was adjusted.' },
    ]);
    expect(candidateFacts(spec(), f).rules).toEqual([]);
  });
  it('marks the selected and the superseded candidate', () => {
    expect(candidateFacts(spec(), f).markers).toEqual(['selected']);
    expect(candidateFacts(spec({ id: 'c-old', candidateId: 'c-old' }), f).markers).toEqual(['superseded']);
  });
  it('shows no reasoning text when the AI gave none (nothing is invented)', () => {
    expect(whyThisValue(spec({ extractionLogic: '  ' })).explanation).toBeNull();
  });
});

describe('F: the batch button says what it does', () => {
  it('shows the count, and is disabled with a reason at zero', async () => {
    const { retryFlaggedButton } = await import('./corrections');
    expect(retryFlaggedButton(3)).toMatchObject({ label: 'Retry flagged values (3)', disabled: false });
    expect(retryFlaggedButton(0)).toMatchObject({ label: 'Retry flagged values (0)', disabled: true, tooltip: expect.stringMatching(/flag/i) });
  });
});
