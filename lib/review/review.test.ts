import { describe, expect, it } from 'vitest';
import type { InputField, Specification } from '@/types';
import { inputFieldToParameterInput } from '@/lib/parameter-adapter';
import { rowState, reviewOrder } from './rowState';
import {
  REASON_CATEGORY_WORKERS_FAILED,
  REASON_NOT_SEARCHED_CAP_REACHED,
  REASON_NOT_SEARCHED_NO_TAG,
  REASON_SEARCHED_ABSENT,
  matchReasonCode,
} from './reasonCodes';
import { formatDisplayValue } from './format';
import { currentBasis, isDischargeCurrent, qualifierTags, unitDiffers } from './domain';

const spec = (over: Partial<Specification> = {}): Specification => ({
  id: 's1',
  candidateId: 's1',
  value: '4.2',
  confidence: 95,
  unit: 'V',
  source: null,
  calculated: false,
  rule_passed: true,
  rule_violations: [],
  requires_review: false,
  ...over,
});

const field = (over: Partial<InputField> = {}, specs: Specification[] = [spec()]): InputField => ({
  id: 'U_MAX',
  dbId: 'pp-1',
  label: 'U_MAX',
  specifications: specs,
  selectedSpecId: specs[0]?.id,
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
  ...over,
});

describe('matchReasonCode (AM6)', () => {
  it('matches each of the four backend strings exactly as written', () => {
    expect(matchReasonCode(REASON_NOT_SEARCHED_NO_TAG)?.code).toBe('not_searched_no_tag');
    expect(matchReasonCode(REASON_NOT_SEARCHED_CAP_REACHED)?.code).toBe('not_searched_cap');
    expect(matchReasonCode(REASON_SEARCHED_ABSENT)?.code).toBe('searched_absent');
    expect(matchReasonCode(REASON_CATEGORY_WORKERS_FAILED)?.code).toBe('workers_failed');
  });

  it('tells the two "not searched" codes apart', () => {
    expect(matchReasonCode('not searched: cap reached (312 tagged)')?.code).toBe('not_searched_cap');
    expect(matchReasonCode('not searched: no document frame, reworded')?.code).toBe('not_searched_no_tag');
  });

  it('is a prefix match only, so a rationale mentioning a code is not one', () => {
    expect(matchReasonCode('The value was searched, absent from table 3 but found on page 4')).toBeNull();
    expect(matchReasonCode('Read from the datasheet table on page 2.')).toBeNull();
  });

  it('tolerates case and leading whitespace, and handles null', () => {
    expect(matchReasonCode('  Searched, absent: …')?.code).toBe('searched_absent');
    expect(matchReasonCode(null)).toBeNull();
    expect(matchReasonCode('')).toBeNull();
  });
});

describe('rowState precedence (AM1)', () => {
  it('human flag beats everything, and keeps the rest as secondary facts', () => {
    const s = rowState(field({ isFlagged: true, reviewAction: 'MODIFIED' }, [spec({ rule_violations: ['> max'] })]));
    expect(s.primary).toBe('human_flag');
    expect(s.secondary).toEqual(expect.arrayContaining(['bounds', 'modified']));
  });

  it('auto-flag "Bounds" comes from rule_violations only', () => {
    expect(rowState(field({}, [spec({ rule_violations: ['above U_MAX bound'] })])).primary).toBe('bounds');
  });

  it('requires_review alone is never "Bounds"', () => {
    const s = rowState(field({}, [spec({ requires_review: true })]));
    expect(s.primary).toBe('needs_review');
    expect(s.supervisorReview).toBe(true);
  });

  it('an empty reason-code row is "empty" with its reason, ignoring requires_review', () => {
    const s = rowState(field({}, [spec({ value: '', confidence: 0, requires_review: true, extractionLogic: REASON_SEARCHED_ABSENT })]));
    expect(s.primary).toBe('empty');
    expect(s.reason?.code).toBe('searched_absent');
    expect(s.secondary).not.toContain('needs_review');
  });

  it('an empty row whose text is not a reason code is still "empty", with no reason', () => {
    const s = rowState(field({}, [spec({ value: '', extractionLogic: 'something else' })]));
    expect(s.primary).toBe('empty');
    expect(s.reason).toBeNull();
  });

  it('no candidates at all is "No run yet"', () => {
    expect(rowState(field({}, [])).primary).toBe('no_run');
  });

  it('bounds beats empty and modified', () => {
    const s = rowState(field({ reviewAction: 'MODIFIED' }, [spec({ value: '', rule_violations: ['x'] })]));
    expect(s.primary).toBe('bounds');
  });

  it('human-modified beats low confidence; low confidence becomes no secondary of its own', () => {
    const s = rowState(field({ reviewAction: 'MODIFIED' }, [spec({ confidence: 40 })]));
    expect(s.primary).toBe('modified');
  });

  it('low confidence is "needs review"; high confidence is "high"', () => {
    expect(rowState(field({}, [spec({ confidence: 84.9 })])).primary).toBe('needs_review');
    expect(rowState(field({}, [spec({ confidence: 85 })])).primary).toBe('high');
  });

  it('a human-entered value without confidence is not "low confidence"', () => {
    const s = rowState(field({}, [spec({ candidateId: null, confidence: null })]));
    expect(s.primary).toBe('high');
    expect(s.lowConfidence).toBe(false);
  });

  it('ACCEPTED shows as a secondary fact', () => {
    expect(rowState(field({ reviewAction: 'ACCEPTED' })).secondary).toContain('accepted');
  });

  it('sorts flagged, then bounds, then needs-review, before high', () => {
    const order = (['high', 'needs_review', 'human_flag', 'empty', 'bounds'] as const)
      .slice()
      .sort((a, b) => reviewOrder(a) - reviewOrder(b));
    expect(order).toEqual(['human_flag', 'bounds', 'needs_review', 'empty', 'high']);
  });
});

describe('formatDisplayValue (AM10)', () => {
  it('rounds a Decimal-serialised float to 6 significant digits', () => {
    expect(formatDisplayValue('2.29999999999999982236431605997495353221893310546875')).toBe('2.3');
    expect(formatDisplayValue(4.199999999)).toBe('4.2');
  });

  it('strips trailing zeros and keeps signs', () => {
    expect(formatDisplayValue('2.300000')).toBe('2.3');
    expect(formatDisplayValue('-150.000')).toBe('-150');
    expect(formatDisplayValue('0.0000')).toBe('0');
  });

  it('keeps at most 6 significant digits on large and small values', () => {
    expect(formatDisplayValue('123456789')).toBe('123457000');
    expect(formatDisplayValue('0.000123456789')).toBe('0.000123457');
  });

  it('shows text values verbatim and empty as empty', () => {
    expect(formatDisplayValue('n/a')).toBe('n/a');
    expect(formatDisplayValue('')).toBe('');
    expect(formatDisplayValue(null)).toBe('');
  });

  it('never changes what Save sends for an untouched row', () => {
    // A value rounding would visibly change: displayed 1.23457, saved as loaded.
    const raw = '1.23456789';
    expect(formatDisplayValue(raw)).toBe('1.23457');
    const out = inputFieldToParameterInput(field({}, [spec({ value: raw })]), null);
    expect(out.final_value).toBe(1.23456789);
    expect(out.is_human_modified).toBe(false);
  });
});

describe('domain helpers (CLAUDE.md 7)', () => {
  it('derives qualifier tags from the parameter key', () => {
    expect(qualifierTags('U_MIN')).toEqual(['MIN']);
    expect(qualifierTags('U_MAX_SAFETY')).toEqual(['MAX', 'SAFETY']);
    expect(qualifierTags('I_MAX_DCH_PULSE')).toEqual(['MAX', 'PULSE']);
    expect(qualifierTags('U_MIN_DYN')).toEqual(['MIN', 'DYN']);
    expect(qualifierTags('C_NOMINAL_AH')).toEqual(['NOM']);
    expect(qualifierTags('EOL_SOH_NOM')).toEqual(['NOM']);
    expect(qualifierTags('I_MAX_CHA_CONTINUOUS')).toEqual(['MAX', 'CONTINUOUS']);
    expect(qualifierTags('EOL_FCE')).toEqual([]);
    // Substrings inside a word are not qualifiers.
    expect(qualifierTags('MINIMUMX_MAXIMAL')).toEqual([]);
  });

  it('recognises discharge currents', () => {
    expect(isDischargeCurrent('I_MAX_DCH_PULSE')).toBe(true);
    expect(isDischargeCurrent('I_MAX_DCH_CONTINUOUS')).toBe(true);
    expect(isDischargeCurrent('I_MAX_CHA_PULSE')).toBe(false);
  });

  it('separates C-rate from absolute current', () => {
    expect(currentBasis('C')).toBe('c-rate');
    expect(currentBasis('', '2C')).toBe('c-rate');
    expect(currentBasis(null, '0.5C')).toBe('c-rate');
    expect(currentBasis(null, 'C/5')).toBe('c-rate');
    expect(currentBasis('A')).toBe('absolute');
    expect(currentBasis('mA')).toBe('absolute');
    expect(currentBasis('V')).toBeNull();
    expect(currentBasis('Ah')).toBeNull();
  });

  it('flags a unit that differs from the expected one, case-sensitively', () => {
    expect(unitDiffers('mAh', 'Ah')).toBe(true);
    expect(unitDiffers('Ah', 'Ah')).toBe(false);
    expect(unitDiffers(' Ah ', 'Ah')).toBe(false);
    expect(unitDiffers('', 'Ah')).toBe(false);
    expect(unitDiffers('mA', 'MA')).toBe(true);
  });
});
