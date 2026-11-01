import { describe, expect, it } from 'vitest';
import { chartPoints, originMixPoints, tickAlias, tooltipInfo } from './charts';
import { row, notApproved, views } from './testData';

const mk = (id: string, alias: string, day: number, f1: number | null, ver = 1) =>
  row({ project_id: id, alias, approval_version: ver, approved_at: `2026-10-${String(day).padStart(2, '0')}T08:00:00+00:00`, views: views({ final_any: f1, blind_first: 0.1 }) });

const many = [
  mk('p1', 'cell-zelle-0001', 1, 0.1), mk('p2', 'cell-zelle-0002', 2, 0.2), mk('p3', 'cell-zelle-0003', 3, null),
  mk('p4', 'cell-zelle-0004', 4, 0.4, 2), mk('p5', 'cell-zelle-0005', 5, 0.5), mk('p6', 'cell-zelle-0006', 6, 0.6), notApproved('np'),
];

describe('chart points', () => {
  it('keeps projects whose alias starts with the same 10 characters separate (keyed by project_id)', () => {
    const pts = chartPoints(many, 'final_any', 'all', true);
    expect(pts.map((p) => p.projectId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(new Set(pts.map((p) => p.alias.slice(0, 10))).size).toBe(1);
    expect(tooltipInfo(pts, 'p2')?.alias).toBe('cell-zelle-0002');
    expect(tickAlias(pts, 'p5')).toBe('cell-zelle-0005');
  });
  it('tooltip returns the hovered project with version, date and value', () => {
    const pts = chartPoints(many, 'final_any', 'all', true);
    expect(tooltipInfo(pts, 'p4')).toEqual({ alias: 'cell-zelle-0004', version: 2, approvedDate: '2026-10-04', f1: 0.4, precision: 0.4, recall: 0.4, compareF1: 0.1 });
    expect(tooltipInfo(pts, 'nope')).toBeNull();
  });
  it('leaves nulls as null, never 0', () => {
    const p3 = chartPoints(many, 'final_any', 'all', true).find((p) => p.projectId === 'p3')!;
    expect(p3.f1).toBeNull();
    expect(p3.precision).toBeNull();
  });
  it('Last 5 keeps the five newest in approved order; All keeps every approved project', () => {
    expect(chartPoints(many, 'final_any', 'last5', true).map((p) => p.projectId)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6']);
    expect(chartPoints(many, 'final_any', 'all', true)).toHaveLength(6);
  });
  it('orders by approved_at even if the input is not ordered, and drops not-approved projects', () => {
    const pts = chartPoints([many[5], many[0], many[6]], 'final_any', 'all', true);
    expect(pts.map((p) => p.projectId)).toEqual(['p1', 'p6']);
  });
  it('the selected view drives the values; the comparison line is Right first time, or null when off', () => {
    const a = chartPoints(many, 'final_any', 'all', true)[0];
    const b = chartPoints(many, 'blind_first', 'all', true)[0];
    expect(a.f1).toBe(0.1);
    expect(b.f1).toBe(0.1);
    expect(chartPoints([mk('x', 'x', 1, 0.9)], 'final_any', 'all', true)[0].f1).toBe(0.9);
    expect(a.compareF1).toBe(0.1);
    expect(chartPoints([mk('x', 'x', 1, 0.9)], 'final_any', 'all', false)[0].compareF1).toBeNull();
  });
});

describe('origin mix', () => {
  it('has AI, AI correction and Entered by hand per approved project, keyed by id, with the same toggle', () => {
    const pts = originMixPoints(many, 'last5');
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual({ projectId: 'p2', alias: 'cell-zelle-0002', ai: 5, aiCorrection: 2, byHand: 3 });
    expect(originMixPoints(many, 'all')).toHaveLength(6);
  });
});
