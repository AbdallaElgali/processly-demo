import { describe, expect, it } from 'vitest';
import { canStart, queuePosition, selectStartable } from './ordering';
import type { Job, JobKind, JobStatus } from './types';

let seq = 0;
const job = (
  over: Partial<Job> & { kind: JobKind; status: JobStatus; projectId: string },
): Job => ({
  id: over.id ?? `job-${(seq += 1)}`,
  createdAt: over.createdAt ?? seq,
  phase: 'queued',
  events: [],
  warnings: [],
  progress: { categoriesDone: [], categoriesFailed: [] },
  seen: false,
  payload:
    over.kind === 'upload'
      ? { kind: 'upload', fileRefs: [] }
      : over.kind === 'extraction'
        ? { kind: 'extraction', mode: 'BLIND', previousSpecs: null }
        : { kind: 'correction', parameterKey: 'U_MIN', previousMetrics: [], userHint: null },
  ...over,
});

describe('concurrency cap', () => {
  it('starts no more than the cap, counting every kind', () => {
    const jobs = [
      job({ kind: 'upload', status: 'queued', projectId: 'a', createdAt: 1 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'b', createdAt: 2 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'c', createdAt: 3 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'd', createdAt: 4 }),
    ];
    expect(selectStartable(jobs, 3)).toHaveLength(3);
  });

  it('counts jobs already running against the cap', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'running', projectId: 'a' }),
      job({ kind: 'upload', status: 'running', projectId: 'b' }),
      job({ kind: 'extraction', status: 'queued', projectId: 'c', createdAt: 10 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'd', createdAt: 11 }),
    ];
    const started = selectStartable(jobs, 3);
    expect(started).toHaveLength(1);
    expect(started[0].projectId).toBe('c');
  });

  it('starts nothing when the cap is already full', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'running', projectId: 'a' }),
      job({ kind: 'extraction', status: 'running', projectId: 'b' }),
      job({ kind: 'extraction', status: 'running', projectId: 'c' }),
      job({ kind: 'extraction', status: 'queued', projectId: 'd' }),
    ];
    expect(selectStartable(jobs, 3)).toEqual([]);
  });
});

describe('priority and FIFO', () => {
  it('starts a queued correction before older uploads and extractions', () => {
    const jobs = [
      job({ kind: 'upload', status: 'queued', projectId: 'a', createdAt: 1 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'b', createdAt: 2 }),
      job({ kind: 'correction', status: 'queued', projectId: 'c', createdAt: 99 }),
    ];
    expect(selectStartable(jobs, 1)[0].kind).toBe('correction');
  });

  it('is FIFO within a priority class', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'queued', projectId: 'b', createdAt: 20 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'a', createdAt: 10 }),
    ];
    expect(selectStartable(jobs, 1)[0].projectId).toBe('a');
  });

  it('is FIFO among corrections too', () => {
    const jobs = [
      job({ kind: 'correction', status: 'queued', projectId: 'b', createdAt: 20 }),
      job({ kind: 'correction', status: 'queued', projectId: 'a', createdAt: 10 }),
    ];
    expect(selectStartable(jobs, 1)[0].projectId).toBe('a');
  });

  it('reports the queue position in real start order, not insertion order', () => {
    const upload = job({ kind: 'upload', status: 'queued', projectId: 'a', createdAt: 1 });
    const correction = job({ kind: 'correction', status: 'queued', projectId: 'b', createdAt: 50 });
    const jobs = [upload, correction];
    // The correction jumps the queue, so it is position 1 despite being newer.
    expect(queuePosition(jobs, correction.id)).toBe(1);
    expect(queuePosition(jobs, upload.id)).toBe(2);
  });

  it('has no position for a job that is not queued', () => {
    const running = job({ kind: 'extraction', status: 'running', projectId: 'a' });
    expect(queuePosition([running], running.id)).toBeNull();
  });
});

describe('one parameter-writing job per project', () => {
  it('does not start a correction while that project extracts', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'running', projectId: 'a' }),
      job({ kind: 'correction', status: 'queued', projectId: 'a' }),
    ];
    expect(selectStartable(jobs, 3)).toEqual([]);
  });

  it('still starts work for a different project', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'running', projectId: 'a' }),
      job({ kind: 'correction', status: 'queued', projectId: 'a', createdAt: 5 }),
      job({ kind: 'correction', status: 'queued', projectId: 'b', createdAt: 6 }),
    ];
    const started = selectStartable(jobs, 3);
    expect(started.map((j) => j.projectId)).toEqual(['b']);
  });

  it('never selects two parameter-writing jobs for one project in one pass', () => {
    const jobs = [
      job({ kind: 'correction', status: 'queued', projectId: 'a', createdAt: 1 }),
      job({ kind: 'correction', status: 'queued', projectId: 'a', createdAt: 2 }),
    ];
    expect(selectStartable(jobs, 3)).toHaveLength(1);
  });

  it('allows an upload alongside an extraction on the same project', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'running', projectId: 'a' }),
      job({ kind: 'upload', status: 'queued', projectId: 'a' }),
    ];
    expect(selectStartable(jobs, 3)).toHaveLength(1);
  });
});

describe('canStart', () => {
  it('refuses a second extraction for the same project', () => {
    const jobs = [job({ kind: 'extraction', status: 'running', projectId: 'a' })];
    expect(canStart(jobs, 'a', 'extraction').allowed).toBe(false);
  });

  it('refuses it while one is merely queued, too', () => {
    const jobs = [job({ kind: 'extraction', status: 'queued', projectId: 'a' })];
    expect(canStart(jobs, 'a', 'extraction').allowed).toBe(false);
  });

  it('allows an extraction for a different project', () => {
    const jobs = [job({ kind: 'extraction', status: 'running', projectId: 'a' })];
    expect(canStart(jobs, 'b', 'extraction').allowed).toBe(true);
  });

  it('allows starting at the cap: the job queues rather than being refused', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'running', projectId: 'a' }),
      job({ kind: 'extraction', status: 'running', projectId: 'b' }),
      job({ kind: 'extraction', status: 'running', projectId: 'c' }),
    ];
    expect(canStart(jobs, 'd', 'extraction').allowed).toBe(true);
  });

  it('does not let a finished job block new work', () => {
    const jobs = [job({ kind: 'extraction', status: 'completed', projectId: 'a' })];
    expect(canStart(jobs, 'a', 'extraction').allowed).toBe(true);
  });
});
