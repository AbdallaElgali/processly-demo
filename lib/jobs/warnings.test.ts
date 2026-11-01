import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  savePendingFiles: vi.fn(async () => undefined),
  loadPendingFiles: vi.fn(async () => []),
  deletePendingFiles: vi.fn(async () => undefined),
  sweepPendingFiles: vi.fn(async () => undefined),
}));
const reload = vi.fn<(projectId: string) => Promise<void>>(async () => undefined);
vi.mock('@/lib/project-data/actions', () => ({ reloadAfterRun: (projectId: string) => reload(projectId) }));
vi.mock('@/api/projects', () => ({ apiGetProjectDetails: vi.fn(), apiGetExtractionRuns: vi.fn() }));

// The shared job record lives in localStorage; give the node environment one.
const memory = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  },
});

import { createJob, jobRuntime } from './runtime';
import { jobStore } from './store';
import type { Job } from './types';

const STARTED = Date.parse('2026-11-01T10:00:00Z');
const running = (): Job => ({
  ...createJob('p-warn', { kind: 'extraction', mode: 'BLIND', previousSpecs: null }),
  status: 'running',
  startedAt: STARTED,
});

beforeEach(() => {
  memory.clear();
  jobStore.dispatch({ type: 'hydrate', jobs: [] });
  reload.mockClear();
  jobRuntime.setUserId(null);
});

describe('a job whose tab is gone is checked with the server before it is called interrupted', () => {
  it('shows a run the server saved as finished, with no warning', async () => {
    const job = running();
    jobStore.dispatch({ type: 'enqueue', job });
    await jobRuntime.settleLostRun(job.id, async () => [{ extraction_type: 'MAIN_MULTI_AGENT', created_at: '2026-11-01T10:05:00Z' }] as never);
    const after = jobStore.getJob(job.id)!;
    expect(after.status).toBe('completed');
    expect(after.savedWhileAway).toBe(true);
    expect(reload).toHaveBeenCalledWith('p-warn');
  });

  it('reports a lost run as interrupted only when the server has no run for it', async () => {
    const job = running();
    jobStore.dispatch({ type: 'enqueue', job });
    await jobRuntime.settleLostRun(job.id, async () => [{ extraction_type: 'MAIN_MULTI_AGENT', created_at: '2026-11-01T08:00:00Z' }] as never);
    expect(jobStore.getJob(job.id)).toMatchObject({ status: 'interrupted', runCheck: 'lost' });
  });

  it('says it could not check when the server cannot be asked', async () => {
    const job = running();
    jobStore.dispatch({ type: 'enqueue', job });
    await jobRuntime.settleLostRun(job.id, async () => { throw new Error('offline'); });
    expect(jobStore.getJob(job.id)).toMatchObject({ status: 'interrupted', runCheck: 'unknown' });
  });
});

describe('a queued job is not started before the user is known', () => {
  it('stays queued (a reload must not turn a waiting job into an interrupted one)', async () => {
    const job = createJob('p-nouser', { kind: 'extraction', mode: 'BLIND', previousSpecs: null });
    await jobRuntime.enqueue(job);
    await jobRuntime.pump();
    await new Promise((r) => setTimeout(r, 0));
    expect(jobStore.getJob(job.id)?.status).toBe('queued');
  });
});

describe('an upload job carries its file names', () => {
  it('stamps the names and sizes of the files onto the job', async () => {
    const job = createJob('p-files', { kind: 'upload', fileRefs: [] });
    await jobRuntime.enqueue(job, [new File(['abc'], 'datasheet.pdf', { type: 'application/pdf' })]);
    const stored = jobStore.getJob(job.id)!;
    expect(stored.payload.kind === 'upload' && stored.payload.fileRefs.map((r) => [r.name, r.size])).toEqual([['datasheet.pdf', 3]]);
  });
});
