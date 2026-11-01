import { describe, expect, it } from 'vitest';
import { tableRows, sortRows, leftOut } from './table';
import { row, notApproved, views } from './testData';

const rows = [
  row({ project_id: 'a', alias: 'A', approval_version: 2, views: views({ final_any: 0.3, blind_first: 0.9 }), acceptance_rate: 0.2 }),
  row({ project_id: 'b', alias: 'B', views: views({ final_any: null, blind_first: 0.1 }), acceptance_rate: null }),
  row({ project_id: 'c', alias: 'C', views: views({ final_any: 0.8, blind_first: 0.5 }), acceptance_rate: 0.9 }),
  notApproved('d'),
];

describe('table rows', () => {
  it('shows all projects; selected-view columns change with the view, the two fixed F1 columns do not', () => {
    const a = tableRows(rows, 'final_any');
    const b = tableRows(rows, 'blind_first');
    expect(a).toHaveLength(4);
    expect(a[0].f1).toBe(0.3);
    expect(b[0].f1).toBe(0.9);
    expect(a[0].foundF1).toBe(b[0].foundF1);
    expect(a[0].firstF1).toBe(0.9);
    expect(a[0].correct).toBe(4);
    expect(b[0].correct).toBe(1);
    expect(a[0].wrong).toBe(3);
    expect(a[0].missed).toBe(7);
  });
  it('not-approved rows carry no numbers and are flagged', () => {
    const d = tableRows(rows, 'final_any')[3];
    expect(d.notApproved).toBe(true);
    expect([d.f1, d.precision, d.recall, d.foundF1, d.firstF1, d.acceptance, d.correct, d.wrong, d.missed, d.leftOut]).toEqual(Array(10).fill(null));
    expect(d.version).toBeNull();
  });
});

describe('sorting', () => {
  const t = tableRows(rows, 'final_any');
  it('sorts numeric columns ascending and descending with null always last', () => {
    expect(sortRows(t, 'f1', 'asc').map((r) => r.projectId)).toEqual(['a', 'c', 'b', 'd']);
    expect(sortRows(t, 'f1', 'desc').map((r) => r.projectId)).toEqual(['c', 'a', 'b', 'd']);
    expect(sortRows(t, 'acceptance', 'desc').map((r) => r.projectId)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('sorts the approval version and does not mutate the input', () => {
    const before = t.map((r) => r.projectId);
    expect(sortRows(t, 'version', 'desc')[0].projectId).toBe('a');
    expect(t.map((r) => r.projectId)).toEqual(before);
  });
  it('keeps the original order for equal values (approved first, then not approved)', () => {
    expect(sortRows(t, 'leftOut', 'asc').map((r) => r.projectId)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('left out', () => {
  it('sums the four parts and explains each in the tooltip', () => {
    const l = leftOut({ coverage_gap: 1, never_asked: 2, unranked: 3, parameter_removed: 4 });
    expect(l.sum).toBe(10);
    expect(l.tooltip).toBe('Added later: 1 · Never sent to the AI: 2 · Too old to score: 3 · Removed: 4');
  });
  it('is null when there is no breakdown', () => {
    expect(leftOut(null)).toEqual({ sum: null, tooltip: '' });
  });
});
