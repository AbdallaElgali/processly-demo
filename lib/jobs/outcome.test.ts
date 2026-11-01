import { describe, expect, it } from 'vitest';
import { createJob } from './runtime';
import { interruptedRunText, runSavedSince, stillRunning } from './outcome';
import type { Job } from './types';

const extraction = (previousSpecs: unknown = null): Job => ({
  ...createJob('p1', { kind: 'extraction', mode: previousSpecs ? 'ITERATIVE' : 'BLIND', previousSpecs } as never),
  status: 'running',
  startedAt: Date.parse('2026-11-01T10:00:00Z'),
});

const run = (extraction_type: string, created_at: string | null) => ({ extraction_type, created_at });

describe('runSavedSince: did the server save this job\'s run?', () => {
  it('is true when a matching run was created after the job started', () => {
    expect(runSavedSince([run('MAIN_MULTI_AGENT', '2026-11-01T10:04:00Z')], extraction())).toBe(true);
  });
  it('is false when the only runs are older than the job', () => {
    expect(runSavedSince([run('MAIN_MULTI_AGENT', '2026-11-01T09:00:00Z')], extraction())).toBe(false);
  });
  it('matches the run type to the job kind', () => {
    const runs = [run('SINGLE_PARAM', '2026-11-01T10:04:00Z')];
    expect(runSavedSince(runs, extraction())).toBe(false);
    expect(runSavedSince([run('ITERATIVE', '2026-11-01T10:04:00Z')], extraction([{}]))).toBe(true);
    const correction = { ...extraction(), kind: 'correction' as const, payload: { kind: 'correction' as const, parameterKey: 'U_MIN', previousMetrics: [], userHint: null } };
    expect(runSavedSince(runs, correction)).toBe(true);
  });
  it('reads a timestamp without a zone as UTC (the backend sends naive datetimes)', () => {
    expect(runSavedSince([run('MAIN_MULTI_AGENT', '2026-11-01T10:04:00')], extraction())).toBe(true);
  });
  it('allows a few seconds of clock difference between browser and server', () => {
    expect(runSavedSince([run('MAIN_MULTI_AGENT', '2026-11-01T09:59:50Z')], extraction())).toBe(false);
    expect(runSavedSince([run('MAIN_MULTI_AGENT', '2026-11-01T10:00:00Z')], extraction())).toBe(true);
  });
  it('ignores runs with no timestamp', () => {
    expect(runSavedSince([run('MAIN_MULTI_AGENT', null)], extraction())).toBe(false);
  });
});

describe('stillRunning: do not interrupt a job another tab already finished', () => {
  it('drops candidates the shared record no longer shows as running', () => {
    const a = extraction();
    const b = { ...extraction(), id: 'other' };
    const fresh: Job[] = [{ ...a, status: 'completed' }, b];
    expect(stillRunning([a, b], fresh).map((j) => j.id)).toEqual(['other']);
  });
  it('drops candidates that were dismissed from the record', () => {
    expect(stillRunning([extraction()], [])).toEqual([]);
  });
});

describe('interruptedRunText', () => {
  it('says what happened and what to do, with no developer wording', () => {
    const lost = interruptedRunText({ ...extraction(), status: 'interrupted', runCheck: 'lost' });
    expect(lost).toMatch(/stopped before it finished/i);
    expect(lost).toMatch(/nothing was saved/i);
    expect(lost).toMatch(/analy[sz]e again|run it again/i);
    expect(lost).not.toMatch(/\btab running\b|\bjob\b/i);
  });
  it('does not claim nothing was saved when the server could not be asked', () => {
    const unknown = interruptedRunText({ ...extraction(), status: 'interrupted', runCheck: 'unknown' });
    expect(unknown).not.toMatch(/nothing was saved/i);
    expect(unknown).toMatch(/could not check/i);
  });
});
