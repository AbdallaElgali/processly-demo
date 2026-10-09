import { describe, expect, it } from 'vitest';
import { initialJobsState, jobsReducer } from './reducer';
import { phaseForEvent, WARNING_STATUSES } from './sse-types';
import type { Job, JobsState } from './types';

const baseJob = (over: Partial<Job> = {}): Job => ({
  id: 'j1',
  projectId: 'p1',
  kind: 'extraction',
  status: 'queued',
  createdAt: 1,
  phase: 'queued',
  events: [],
  warnings: [],
  progress: { categoriesDone: [], categoriesFailed: [] },
  seen: false,
  payload: { kind: 'extraction', mode: 'BLIND', previousSpecs: null },
  ...over,
});

const withJob = (job: Job): JobsState => jobsReducer(initialJobsState, { type: 'enqueue', job });
const only = (state: JobsState) => state.jobs[0];

describe('lifecycle', () => {
  it('enqueues and ignores a duplicate id', () => {
    const job = baseJob();
    const once = withJob(job);
    const twice = jobsReducer(once, { type: 'enqueue', job });
    expect(twice.jobs).toHaveLength(1);
    expect(twice).toBe(once); // same reference: no needless re-render
  });

  it('starts a queued job and records the owning tab', () => {
    const state = jobsReducer(withJob(baseJob()), {
      type: 'start', jobId: 'j1', tabId: 'tab-a', at: 100,
    });
    expect(only(state).status).toBe('running');
    expect(only(state).ownerTabId).toBe('tab-a');
    expect(only(state).startedAt).toBe(100);
  });

  it('opens an upload in the uploading phase and a stream job in routing', () => {
    const upload = jobsReducer(
      withJob(baseJob({ kind: 'upload', payload: { kind: 'upload', fileRefs: [] } })),
      { type: 'start', jobId: 'j1', tabId: 't', at: 1 },
    );
    expect(only(upload).phase).toBe('uploading');

    const extraction = jobsReducer(withJob(baseJob()), {
      type: 'start', jobId: 'j1', tabId: 't', at: 1,
    });
    expect(only(extraction).phase).toBe('routing');
  });

  it('will not start a job that is not queued', () => {
    const running = jobsReducer(withJob(baseJob({ status: 'running' })), {
      type: 'start', jobId: 'j1', tabId: 'tab-b', at: 5,
    });
    expect(only(running).ownerTabId).toBeUndefined();
  });

  it('marks a completed job unseen when its project is not open', () => {
    const state = jobsReducer(withJob(baseJob({ status: 'running' })), {
      type: 'complete', jobId: 'j1', at: 9, seen: false,
    });
    expect(only(state).status).toBe('completed');
    expect(only(state).seen).toBe(false);
    expect(only(state).phase).toBe('done');
  });

  it('carries per-file upload warnings onto the completed job', () => {
    const state = jobsReducer(withJob(baseJob({ status: 'running', kind: 'upload' })), {
      type: 'complete', jobId: 'j1', at: 9, seen: true, warnings: ['bad.pdf: corrupt file'],
    });
    expect(only(state).uploadWarnings).toEqual(['bad.pdf: corrupt file']);
  });

  it('marks a project seen without touching other projects', () => {
    let state = withJob(baseJob({ id: 'a', projectId: 'p1', status: 'completed' }));
    state = jobsReducer(state, { type: 'enqueue', job: baseJob({ id: 'b', projectId: 'p2', status: 'completed' }) });
    state = jobsReducer(state, { type: 'markSeen', projectId: 'p1' });
    expect(state.jobs.find((j) => j.id === 'a')!.seen).toBe(true);
    expect(state.jobs.find((j) => j.id === 'b')!.seen).toBe(false);
  });
});

describe('interruption', () => {
  it('interrupts a running job', () => {
    const state = jobsReducer(withJob(baseJob({ status: 'running' })), {
      type: 'interrupt', jobId: 'j1', at: 20,
    });
    expect(only(state).status).toBe('interrupted');
    expect(only(state).error).toMatch(/closed or refreshed/i);
  });

  it('never rewrites a job that already finished', () => {
    // A late liveness sweep must not resurrect a completed job as interrupted.
    const completed = withJob(baseJob({ status: 'completed' }));
    const after = jobsReducer(completed, { type: 'interrupt', jobId: 'j1', at: 30 });
    expect(only(after).status).toBe('completed');
    expect(after).toBe(completed);
  });

  it('cancels queued and running jobs but not finished ones', () => {
    const queued = jobsReducer(withJob(baseJob()), { type: 'cancel', jobId: 'j1', at: 1 });
    expect(only(queued).status).toBe('cancelled');

    const failed = withJob(baseJob({ status: 'failed' }));
    expect(only(jobsReducer(failed, { type: 'cancel', jobId: 'j1', at: 1 })).status).toBe('failed');
  });
});

describe('SSE events', () => {
  const running = () =>
    jobsReducer(withJob(baseJob()), { type: 'start', jobId: 'j1', tabId: 't', at: 0 });

  const feed = (statuses: Array<Record<string, unknown>>) =>
    statuses.reduce(
      (state, event) => jobsReducer(state, { type: 'event', jobId: 'j1', event: event as never }),
      running(),
    );

  it('walks the pipeline phases in order', () => {
    expect(only(feed([{ status: 'routing_complete' }])).phase).toBe('routed');
    expect(only(feed([{ status: 'routing_complete' }, { status: 'workers_complete' }])).phase)
      .toBe('supervising');
    expect(only(feed([{ status: 'complete' }])).phase).toBe('done');
    expect(only(feed([{ status: 'error' }])).phase).toBe('failed');
  });

  it('keeps warnings out of the error path', () => {
    const state = feed([
      { status: 'routing_truncated', total_tagged: 312, cap: 200, kept: 200 },
      { status: 'no_frames_tagged' },
      { status: 'category_extraction_fallback' },
    ]);
    expect(only(state).warnings).toHaveLength(3);
    expect(only(state).status).toBe('running');
    expect(only(state).phase).not.toBe('failed');
  });

  it('records each category as its supervisor finishes, without duplicates', () => {
    const state = feed([
      { status: 'partial', category: 'VOLTAGE' },
      { status: 'partial', category: 'CURRENT' },
      { status: 'partial', category: 'VOLTAGE' },
    ]);
    expect(only(state).progress.categoriesDone).toEqual(['VOLTAGE', 'CURRENT']);
  });

  it('records failed categories', () => {
    const state = feed([{ status: 'category_workers_failed', categories: ['TEMPERATURE'] }]);
    expect(only(state).progress.categoriesFailed).toEqual(['TEMPERATURE']);
  });

  it('ignores an unknown future status instead of throwing', () => {
    const state = feed([{ status: 'something_the_backend_added_later' }]);
    expect(only(state).status).toBe('running');
    expect(only(state).phase).toBe('routing');
    expect(only(state).events).toHaveLength(1);
  });

  it('captures a run id from the first event that carries one (Task B)', () => {
    const state = feed([
      { status: 'routing_complete', run_id: 'run-1' },
      { status: 'partial', category: 'VOLTAGE', run_id: 'run-2' },
    ]);
    expect(only(state).runId).toBe('run-1');
  });

  it('ignores events for a job that is not running', () => {
    const state = jobsReducer(withJob(baseJob({ status: 'completed' })), {
      type: 'event', jobId: 'j1', event: { status: 'partial', category: 'VOLTAGE' },
    });
    expect(only(state).events).toHaveLength(0);
  });
});

describe('phaseForEvent', () => {
  it('returns null for warnings so they cannot look like progress', () => {
    for (const status of WARNING_STATUSES) {
      expect(phaseForEvent(status, 'extracting')).toBeNull();
    }
  });

  it('maps the single-parameter correction path', () => {
    expect(phaseForEvent('targeting', 'routing')).toBe('extracting');
    expect(phaseForEvent('partial_correction', 'extracting')).toBe('extracting');
  });

  it('does not drag a supervising run back to extracting', () => {
    expect(phaseForEvent('partial', 'supervising')).toBe('supervising');
  });
});
