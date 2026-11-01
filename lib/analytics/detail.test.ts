import { describe, expect, it } from 'vitest';
import { outcomeWord, matchedLabel, parameterRows, filterByOutcome, outcomeOptions, analyticsErrorMessage, matchedText } from './detail';
import { detailParam } from './testData';

describe('outcome words', () => {
  it('uses plain words for all eight outcomes', () => {
    expect(['TP', 'FP', 'FN', 'ignored', 'excluded_coverage_gap', 'excluded_never_asked', 'excluded_unranked', 'excluded_removed'].map((o) => outcomeWord(o as never)))
      .toEqual(['Correct', 'Wrong', 'Missed', 'Both empty', 'Added later', 'Never sent to the AI', 'Too old to score', 'Removed']);
  });
});

describe('matched candidate', () => {
  it('labels the run type', () => {
    expect(matchedLabel('BLIND')).toBe('first extraction');
    expect(matchedLabel('ITERATIVE')).toBe('correction');
    expect(matchedLabel('SINGLE_PARAM')).toBe('single retry');
  });
  it('writes value, unit, run and rank; dash when there is none', () => {
    expect(matchedText(detailParam().matched_candidate)).toBe('4.2 V · first extraction · rank 1');
    expect(matchedText({ value: '2', unit: null, run_type: 'ITERATIVE', rank: null })).toBe('2 · correction');
    expect(matchedText(null)).toBe('—');
  });
});

describe('parameter rows', () => {
  it('gives the four outcomes in words and the value with its unit', () => {
    const [r] = parameterRows([detailParam({ outcomes: { blind_first: 'FP', blind_any: 'TP', final_first: 'excluded_unranked', final_any: 'TP' } })]);
    expect(r.outcomes).toEqual({ blind_first: 'Wrong', blind_any: 'Correct', final_first: 'Too old to score', final_any: 'Correct' });
    expect(r.truth).toBe('4.2 V');
    expect(r.blindFirst).toBe('4.2 V');
    expect(r.counts).toBe('2 / 3');
  });
  it('shows a dash for an empty value', () => {
    const [r] = parameterRows([detailParam({ truth_value: null, truth_unit: null, blind_first: { value: null, unit: null } })]);
    expect(r.truth).toBe('—');
    expect(r.blindFirst).toBe('—');
  });
});

describe('outcome filter', () => {
  const params = [
    detailParam({ alias: 'a', outcomes: { blind_first: 'TP', blind_any: 'TP', final_first: 'TP', final_any: 'TP' } }),
    detailParam({ alias: 'b', outcomes: { blind_first: 'FN', blind_any: 'TP', final_first: 'FN', final_any: 'TP' } }),
    detailParam({ alias: 'c', outcomes: { blind_first: 'FP', blind_any: 'FP', final_first: 'ignored', final_any: 'FN' } }),
  ];
  it('filters by the outcome of the selected view', () => {
    expect(filterByOutcome(params, 'blind_first', 'FN').map((p) => p.alias)).toEqual(['b']);
    expect(filterByOutcome(params, 'final_any', 'FN').map((p) => p.alias)).toEqual(['c']);
    expect(filterByOutcome(params, 'final_any', 'all')).toHaveLength(3);
  });
  it('offers only outcomes present in the selected view, in plain words', () => {
    expect(outcomeOptions(params, 'final_first')).toEqual([{ value: 'TP', label: 'Correct' }, { value: 'FN', label: 'Missed' }, { value: 'ignored', label: 'Both empty' }]);
  });
});

describe('errors', () => {
  it('speaks plainly about 404, 422 and others', () => {
    expect(analyticsErrorMessage(404)).toBe('This project was not found.');
    expect(analyticsErrorMessage(422)).toBe('This is not a valid project id.');
    expect(analyticsErrorMessage(500)).toBe('The metrics could not be loaded (error 500).');
  });
});
