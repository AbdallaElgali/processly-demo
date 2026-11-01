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

const outcome = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('./runners', () => ({
  runExtraction: vi.fn(async () => outcome.value),
  runCorrection: vi.fn(async () => outcome.value),
  runUpload: vi.fn(async () => ({ ok: true })),
}));

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
import { projectDataStore } from '@/lib/project-data/store';

const corrections = [
  { parameter: 'U_MAX', outcome: 'new_value', correction_id: 'k-1' },
  { parameter: 'I_MAX', outcome: 'confirmed', correction_id: 'k-2' },
  { parameter: 'U_MIN', outcome: 'no_new_value', correction_id: 'k-3' },
];

beforeEach(() => {
  memory.clear();
  reload.mockClear();
  jobStore.dispatch({ type: 'hydrate', jobs: [] });
  projectDataStore.reset();
  jobRuntime.setUserId('u1');
});

async function runBatch(result: Record<string, unknown>) {
  outcome.value = result;
  const job = createJob('p-corr', { kind: 'extraction', mode: 'ITERATIVE', previousSpecs: { U_MAX: [] } });
  await jobRuntime.enqueue(job);
  await vi.waitFor(() => expect(jobStore.getJob(job.id)?.status).toBe('completed'));
}

describe('after a correction run completes', () => {
  it('reloads the project and records the outcomes with a correct summary', async () => {
    await runBatch({ ok: true, corrections, parameterErrors: { SOC_MAX: 'No document mentions it.' } });
    expect(reload).toHaveBeenCalledWith('p-corr');
    const report = projectDataStore.get('p-corr').correctionReport;
    expect(report?.summary).toBe('1 corrected, 1 confirmed, 1 nothing new, 1 failed');
    expect(report?.errors).toEqual({ SOC_MAX: 'No document mentions it.' });
    expect(report?.outcomes.map((o) => o.parameter)).toEqual(['U_MAX', 'I_MAX', 'U_MIN']);
  });

  it('a run with an error for one parameter still reports the others', async () => {
    await runBatch({ ok: true, corrections: [corrections[0]], parameterErrors: { I_MAX: 'Could not read it.' } });
    const report = projectDataStore.get('p-corr').correctionReport;
    expect(report?.outcomes).toHaveLength(1);
    expect(report?.errors.I_MAX).toBe('Could not read it.');
  });

  it('a blind extraction records no correction report', async () => {
    outcome.value = { ok: true };
    const job = createJob('p-blind', { kind: 'extraction', mode: 'BLIND', previousSpecs: null });
    await jobRuntime.enqueue(job);
    await vi.waitFor(() => expect(jobStore.getJob(job.id)?.status).toBe('completed'));
    expect(projectDataStore.get('p-blind').correctionReport).toBeNull();
  });
});
