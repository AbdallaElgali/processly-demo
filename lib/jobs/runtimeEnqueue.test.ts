import { beforeEach, describe, expect, it } from 'vitest';
import { createJob, jobRuntime } from './runtime';
import { jobStore } from './store';

/**
 * The runtime is where a job is accepted, so the second-extraction rule is
 * enforced here and not only by the disabled button. No window, no Web Locks
 * and no user in this environment: a started job simply stays "running".
 */
const extraction = (projectId: string) => createJob(projectId, { kind: 'extraction', mode: 'BLIND', previousSpecs: null });

beforeEach(() => {
  jobStore.dispatch({ type: 'hydrate', jobs: [] });
});

describe('JobRuntime.enqueue', () => {
  it('accepts a first extraction and refuses a second one for the same project', async () => {
    const first = await jobRuntime.enqueue(extraction('p-guard'));
    expect(first.allowed).toBe(true);
    const second = await jobRuntime.enqueue(extraction('p-guard'));
    expect(second.allowed).toBe(false);
    expect('reason' in second && second.reason).toMatch(/already has an extraction/i);
    expect(jobStore.getJobs().filter((j) => j.projectId === 'p-guard' && j.kind === 'extraction')).toHaveLength(1);
  });

  it('accepts an extraction for another project', async () => {
    await jobRuntime.enqueue(extraction('p-one'));
    expect((await jobRuntime.enqueue(extraction('p-two'))).allowed).toBe(true);
  });

  it('accepts a new extraction once the earlier one has failed', async () => {
    await jobRuntime.enqueue(extraction('p-retry'));
    const earlier = jobStore.getJobs()[0];
    jobStore.dispatch({ type: 'fail', jobId: earlier.id, at: 1, error: 'x' });
    expect((await jobRuntime.enqueue(extraction('p-retry'))).allowed).toBe(true);
  });

  it('never re-runs an upload: runAgain does nothing for an upload job', async () => {
    const upload = createJob('p-up', { kind: 'upload', fileRefs: [] });
    jobStore.dispatch({ type: 'enqueue', job: { ...upload, status: 'interrupted' } });
    await jobRuntime.runAgain(upload.id);
    expect(jobStore.getJobs().map((j) => j.id)).toEqual([upload.id]);
  });
});
