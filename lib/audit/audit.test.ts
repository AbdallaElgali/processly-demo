import { describe, expect, it } from 'vitest';
import type { ParameterLineageEvent, ParameterLineageResponse, ProjectSummary } from '@/types/audit';
import type { ExtractionRun } from '@/api/types/projects';
import type { FeedbackItem } from '@/api/audit/feedback';
import { buildLineage, filterSummary, isCarriedOver, REVIEWER_FLAG_LABEL, sameValue, summaryTotals } from './lineage';
import { collectAllPages, feedbackTotals } from './feedback';

const run = (id: string, n: number): ExtractionRun => ({
  id, project_id: 'p', user_id: 'u', run_number: n, parameters_count: 1, extraction_type: n === 1 ? 'MAIN_MULTI_AGENT' : 'SINGLE_PARAM',
  model_name: null, reasoning_effort: null, temperature: null, created_at: null,
});
const event = (over: Partial<ParameterLineageEvent>): ParameterLineageEvent => ({
  candidateId: 'c1', extractionRunId: 'r1', value: '4.2', unit: 'V', extractionLogic: null, confidence: 0.9,
  createdAt: '2026-10-09T10:00:00Z', flag: null, isWinner: false, ...over,
});
const lineage = (events: ParameterLineageEvent[]): ParameterLineageResponse => ({
  parameterKey: 'U_MAX', finalValue: '4.2', reviewAction: 'PENDING', isAiAccepted: true, events,
});

describe('reviewer flags (backend type AI_CORRETION, B23)', () => {
  const flag = (reason: string | null) => ({ flagId: 'f', flagReason: reason, status: 'OPEN', flagType: 'AI_CORRETION', createdAt: '2026-10-10T09:00:00Z', resolvedByCandidateId: null });
  it('labels every stored flag as a reviewer flag', () => {
    expect(REVIEWER_FLAG_LABEL).toBe('Reviewer flag');
  });
  it('tells a carried-over flag from the reason it repeats', () => {
    expect(isCarriedOver(flag('check'), flag('check'))).toBe(true);
    expect(isCarriedOver(flag(' check '), flag('check'))).toBe(true);
    expect(isCarriedOver(flag('again'), flag('check'))).toBe(false);
    expect(isCarriedOver(flag(null), flag(null))).toBe(false);
    expect(isCarriedOver(flag('check'), null)).toBe(false);
    expect(isCarriedOver(null, flag('check'))).toBe(false);
  });
});

describe('sameValue', () => {
  it('compares numbers as numbers and null only with null', () => {
    expect(sameValue('2.30', '2.3')).toBe(true);
    expect(sameValue('2.3', '2.4')).toBe(false);
    expect(sameValue(null, null)).toBe(true);
    expect(sameValue(null, '0')).toBe(false);
    expect(sameValue('abc', ' abc ')).toBe(true);
  });
});

describe('buildLineage', () => {
  const runs = [run('r1', 1), run('r2', 2)];
  const chain = lineage([
    // given out of order on purpose
    event({
      candidateId: 'c2', extractionRunId: 'r2', value: '3.9', createdAt: '2026-10-10T09:00:00Z', isWinner: true,
      flag: { flagId: 'f2', flagReason: 'again', status: 'OPEN', flagType: 'AI_CORRETION', createdAt: '2026-10-10T09:00:01Z', resolvedByCandidateId: null },
    }),
    event({
      candidateId: 'c1', extractionRunId: 'r1', value: '4.2',
      flag: { flagId: 'f1', flagReason: 'check', status: 'RESOLVED', flagType: 'AI_CORRETION', createdAt: '2026-10-10T08:59:00Z', resolvedByCandidateId: 'c2' },
    }),
  ]);

  it('orders candidates oldest first and numbers them', () => {
    const v = buildLineage(chain, runs);
    expect(v.rows.map((r) => [r.ordinal, r.event.candidateId])).toEqual([[1, 'c1'], [2, 'c2']]);
    expect(v.runCount).toBe(2);
  });

  it('takes run numbers and types from the runs list', () => {
    const v = buildLineage(chain, runs);
    expect(v.rows.map((r) => r.runNumber)).toEqual([1, 2]);
    expect(v.rows[1].runType).toBe('SINGLE_PARAM');
    expect(buildLineage(chain, null).rows[0].runNumber).toBeNull();
  });

  it('marks a flag carried over only when it repeats the reason it resolved', () => {
    expect(buildLineage(chain, runs).rows.map((r) => r.flagCarriedOver)).toEqual([false, false]);
    const same = lineage([
      event({ candidateId: 'c1', flag: { flagId: 'f1', flagReason: 'check', status: 'RESOLVED', flagType: 'AI_CORRETION', createdAt: '2026-10-10T08:59:00Z', resolvedByCandidateId: 'c2' } }),
      event({ candidateId: 'c2', createdAt: '2026-10-10T09:00:00Z', flag: { flagId: 'f2', flagReason: 'check', status: 'OPEN', flagType: 'AI_CORRETION', createdAt: '2026-10-10T09:00:01Z', resolvedByCandidateId: null } }),
    ]);
    expect(buildLineage(same, runs).rows.map((r) => r.flagCarriedOver)).toEqual([false, true]);
  });

  it('marks what changed against the previous candidate', () => {
    const v = buildLineage(chain, runs);
    expect(v.rows[0].valueChange).toBe('first');
    expect(v.rows[1].valueChange).toBe('changed');
    expect(v.rows[1].previous?.candidateId).toBe('c1');
    const same = buildLineage(lineage([event({ candidateId: 'a' }), event({ candidateId: 'b', value: '4.20', createdAt: '2026-10-09T11:00:00Z', unit: 'mV' })]), runs);
    expect(same.rows[1].valueChange).toBe('same');
    expect(same.rows[1].unitChanged).toBe(true);
  });

  it('shows the flag chain in both directions', () => {
    const v = buildLineage(chain, runs);
    expect(v.rows[0].resolvedBy).toEqual({ ordinal: 2, runNumber: 2 });
    expect(v.rows[1].resolvesFlag?.fromOrdinal).toBe(1);
    expect(v.rows[0].resolvesFlag).toBeNull();
    expect(v.rows[1].resolvedBy).toBeNull();
  });

  it('copes with no events', () => {
    expect(buildLineage(lineage([]), runs).rows).toEqual([]);
  });
});

const row = (over: Partial<ProjectSummary>): ProjectSummary => ({
  parameterKey: 'U_MAX', finalValue: '4.2', reviewAction: 'PENDING', isHumanModified: false, totalCandidates: 1, totalFlags: 0,
  lastAiUpdate: null, isAiAccepted: true, totalExtractionRuns: 1, ...over,
});

describe('summary totals and filters', () => {
  const rows = [
    row({ parameterKey: 'U_MAX' }),
    row({ parameterKey: 'I_MAX_DCH', totalCandidates: 2, totalFlags: 2, isHumanModified: true, isAiAccepted: false }),
    row({ parameterKey: 'T_MIN', totalCandidates: 3, totalFlags: 1 }),
  ];
  it('counts', () => {
    expect(summaryTotals(rows)).toEqual({ parameters: 3, withFlags: 2, totalFlags: 3, reExtracted: 2, humanModified: 1, aiAccepted: 2 });
  });
  it('filters by text, flags and re-extraction together', () => {
    expect(filterSummary(rows, { query: 'max' }).map((r) => r.parameterKey)).toEqual(['U_MAX', 'I_MAX_DCH']);
    expect(filterSummary(rows, { flaggedOnly: true }).length).toBe(2);
    expect(filterSummary(rows, { flaggedOnly: true, reExtractedOnly: true, query: 't_' }).map((r) => r.parameterKey)).toEqual(['T_MIN']);
  });
});

describe('feedback totals (the route has no total and caps pages)', () => {
  it('reads every page until one is short', async () => {
    const data = Array.from({ length: 25 }, (_, i) => i);
    const calls: number[] = [];
    const all = await collectAllPages(async (offset, limit) => {
      calls.push(offset);
      return data.slice(offset, offset + limit);
    }, 10);
    expect(all.length).toBe(25);
    expect(calls).toEqual([0, 10, 20]);
  });
  it('asks once more when the last page is exactly full, and stops on an empty one', async () => {
    const data = Array.from({ length: 20 }, (_, i) => i);
    const all = await collectAllPages(async (o, l) => data.slice(o, o + l), 10);
    expect(all.length).toBe(20);
  });
  it('stops at maxPages when the backend ignores offset', async () => {
    const all = await collectAllPages(async () => [1, 2, 3], 3, 4);
    expect(all.length).toBe(12);
  });
  it('totals add up', () => {
    const f = (status: string, type: string): FeedbackItem => ({ project_id: 'p', user_id: 'u', feedback_type: type, title: 't', description: 'd', status });
    const t = feedbackTotals([f('New', 'bug'), f('new', 'idea'), f('resolved', 'bug'), f('', 'bug')]);
    expect(t.total).toBe(4);
    expect(t.byStatus.reduce((n, s) => n + s.count, 0)).toBe(4);
    expect(t.byType.reduce((n, s) => n + s.count, 0)).toBe(4);
    expect(t.byStatus[0]).toEqual({ status: 'new', count: 2 });
  });
});
