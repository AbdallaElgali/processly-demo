import { describe, expect, it } from 'vitest';
import { headlineTiles, detailTiles, projectCounts, acceptanceTile, formatRate } from './headline';
import { response, row, notApproved } from './testData';

const data = response([row({ project_id: 'a' }), notApproved('b')]);

describe('formatRate', () => {
  it('shows a dash for null and never 0', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0)).toBe('0.00');
    expect(formatRate(0.8571)).toBe('0.86');
  });
});

describe('headline tiles', () => {
  it('shows Found by the AI and Right first time with average as main number and pooled underneath', () => {
    const [found, first] = headlineTiles(data.summary);
    expect(found.view).toBe('final_any');
    expect(found.label).toBe('Found by the AI');
    expect(found.average).toBe(0.85);
    expect(found.pooled).toBe(0.8);
    expect(first.view).toBe('blind_first');
    expect(first.label).toBe('Right first time');
    expect(first.average).toBe(0.45);
    expect(first.pooled).toBe(0.4);
  });
  it('shows avg. candidates only where it applies (the "found" view)', () => {
    const [found, first] = headlineTiles(data.summary);
    expect(found.avgCandidates).toBe(2.5);
    expect(first.avgCandidates).toBeNull();
  });
  it('passes null through so the screen shows a dash', () => {
    const s = structuredClone(data.summary);
    s.per_project_average.views.final_any.f1 = null;
    s.pooled.views.final_any.f1 = null;
    const [found] = headlineTiles(s);
    expect(found.average).toBeNull();
    expect(formatRate(found.average)).toBe('—');
    expect(formatRate(found.pooled)).toBe('—');
  });
  it('has acceptance rate with both labelled values and the project counts', () => {
    expect(acceptanceTile(data.summary)).toEqual({ average: 0.55, pooled: 0.45 });
    expect(projectCounts(data.summary)).toEqual({ approved: 1, notApproved: 1, total: 2 });
  });
});

describe('detail tiles follow the selected view', () => {
  it('differs between views', () => {
    const a = detailTiles(data.summary, 'blind_first');
    const b = detailTiles(data.summary, 'final_any');
    expect(a.f1).not.toEqual(b.f1);
    expect(a.correct).toBe(1);
    expect(b.correct).toBe(4);
    expect(b.wrong).toBe(3);
    expect(b.missed).toBe(7);
    expect(b.avgCandidates).toBe(2.5);
    expect(b.f1).toEqual({ average: 0.85, pooled: 0.8 });
  });
});
