import { describe, expect, it } from 'vitest';
import { initialJobsState, jobsReducer } from './reducer';
import {
  COMPLETED_VISIBLE_MS, MAX_TRAY_ENTRIES, canRetry, dedupeJobs, finishedJobIds, jobsToSweep, trayEntries,
} from './tray';
import type { Job, JobPayload, JobStatus } from './types';

const job = (id: string, status: JobStatus, over: Partial<Job> = {}): Job => ({
  id, projectId: 'p1', kind: 'extraction', status, createdAt: 1, phase: 'queued', events: [], warnings: [],
  progress: { categoriesDone: [], categoriesFailed: [] }, seen: false,
  payload: { kind: 'extraction', mode: 'BLIND', previousSpecs: null } as JobPayload, ...over,
});
const upload = (id: string, status: JobStatus, over: Partial<Job> = {}): Job =>
  job(id, status, { kind: 'upload', payload: { kind: 'upload', fileRefs: [] }, ...over });

const NOW = 1_000_000;

describe('completed jobs clear themselves', () => {
  it('a completed job is in the tray for a short time, then not', () => {
    const j = job('a', 'completed', { endedAt: NOW - 1000, seen: true });
    expect(trayEntries([j], NOW).entries.map((e) => e.id)).toEqual(['a']);
    expect(trayEntries([j], NOW + COMPLETED_VISIBLE_MS).entries).toEqual([]);
  });

  it('a seen, completed job is swept from the store after the window', () => {
    const j = job('a', 'completed', { endedAt: NOW - COMPLETED_VISIBLE_MS, seen: true });
    expect(jobsToSweep([j], NOW)).toEqual(['a']);
    expect(jobsToSweep([job('b', 'completed', { endedAt: NOW - 1000, seen: true })], NOW)).toEqual([]);
  });

  it('a completed job whose results are still unseen is kept (its project badge needs it)', () => {
    expect(jobsToSweep([job('a', 'completed', { endedAt: 0, seen: false })], NOW)).toEqual([]);
  });

  it('a cancelled job is swept after the window', () => {
    expect(jobsToSweep([job('a', 'cancelled', { endedAt: 0 })], NOW)).toEqual(['a']);
  });

  it('a completed upload with rejected files stays until dismissed', () => {
    const j = upload('a', 'completed', { endedAt: 0, seen: true, uploadWarnings: ['x.pdf: not a PDF'] });
    expect(jobsToSweep([j], NOW)).toEqual([]);
    expect(trayEntries([j], NOW).entries.map((e) => e.id)).toEqual(['a']);
  });
});

describe('failed jobs stay until dismissed', () => {
  it('are never swept and always in the tray, however old', () => {
    const f = job('f', 'failed', { endedAt: 0 });
    const i = job('i', 'interrupted', { endedAt: 0 });
    expect(jobsToSweep([f, i], NOW * 100)).toEqual([]);
    expect(trayEntries([f, i], NOW * 100).entries.map((e) => e.id).sort()).toEqual(['f', 'i']);
  });

  it('dismiss removes exactly that job and nothing else', () => {
    const state = { jobs: [job('f1', 'failed'), job('f2', 'failed')] };
    expect(jobsReducer(state, { type: 'dismiss', jobId: 'f1' }).jobs.map((j) => j.id)).toEqual(['f2']);
  });

  it('"clear all finished" removes every finished job and keeps running and queued ones', () => {
    const jobs = [job('r', 'running'), job('q', 'queued'), job('f', 'failed'), job('i', 'interrupted'), job('c', 'completed'), job('x', 'cancelled')];
    const ids = finishedJobIds(jobs);
    expect([...ids].sort()).toEqual(['c', 'f', 'i', 'x']);
    const next = jobsReducer({ jobs }, { type: 'dismissMany', jobIds: ids });
    expect(next.jobs.map((j) => j.id)).toEqual(['r', 'q']);
  });

  it('dismissMany with nothing to remove keeps the same state object', () => {
    const state = { jobs: [job('r', 'running')] };
    expect(jobsReducer(state, { type: 'dismissMany', jobIds: ['nope'] })).toBe(state);
  });
});

describe('no duplicate entries', () => {
  it('the tray shows one entry per job id', () => {
    const dup = [upload('u1', 'failed'), upload('u1', 'failed'), upload('u1', 'queued')];
    expect(trayEntries(dup, NOW).entries.filter((e) => e.id === 'u1')).toHaveLength(1);
  });

  it('dedupeJobs keeps the most advanced copy of a job', () => {
    const out = dedupeJobs([job('a', 'queued'), job('a', 'running'), job('a', 'queued')]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('running');
  });

  it('hydrating a shared record with a repeated id leaves one job', () => {
    const next = jobsReducer(initialJobsState, { type: 'hydrate', jobs: [job('a', 'failed'), job('a', 'failed')] });
    expect(next.jobs).toHaveLength(1);
  });
});

describe('the tray list is capped', () => {
  it('shows at most MAX_TRAY_ENTRIES and counts the rest', () => {
    const jobs = Array.from({ length: MAX_TRAY_ENTRIES + 4 }, (_, i) => job(`f${i}`, 'failed', { endedAt: i }));
    const { entries, more } = trayEntries(jobs, NOW);
    expect(entries).toHaveLength(MAX_TRAY_ENTRIES);
    expect(more).toBe(4);
  });

  it('running and queued work is listed before finished work', () => {
    const jobs = [job('f', 'failed', { endedAt: 5 }), job('q', 'queued'), job('r', 'running')];
    expect(trayEntries(jobs, NOW).entries.map((e) => e.id)).toEqual(['r', 'q', 'f']);
  });
});

describe('no retry for uploads', () => {
  it('an interrupted or failed upload cannot be run again', () => {
    expect(canRetry(upload('a', 'interrupted'))).toBe(false);
    expect(canRetry(upload('a', 'failed'))).toBe(false);
  });
  it('an interrupted extraction or correction still can', () => {
    expect(canRetry(job('a', 'interrupted'))).toBe(true);
    expect(canRetry(job('a', 'interrupted', { kind: 'correction' }))).toBe(true);
  });
  it('a job that is not interrupted cannot', () => {
    expect(canRetry(job('a', 'running'))).toBe(false);
    expect(canRetry(job('a', 'completed'))).toBe(false);
  });
});
