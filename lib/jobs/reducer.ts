import { MAX_RETAINED_EVENTS } from './config';
import type { Job, JobAction, JobsState } from './types';
import { WARNING_STATUSES, phaseForEvent } from './sse-types';

export const initialJobsState: JobsState = { jobs: [] };

/**
 * Applies `update` to one job. Returns the SAME state object when the update
 * was a no-op, so a guard that declines to change a job (e.g. interrupting one
 * that already completed) does not allocate new state and force a re-render.
 */
const replace = (state: JobsState, jobId: string, update: (job: Job) => Job): JobsState => {
  let changed = false;
  const jobs = state.jobs.map((job) => {
    if (job.id !== jobId) return job;
    const next = update(job);
    if (next !== job) changed = true;
    return next;
  });
  return changed ? { jobs } : state;
};

/** Applies one SSE event to a job: phase, warnings, progress, run id. */
export function applyEvent(job: Job, event: SseEventLike): Job {
  const next: Job = {
    ...job,
    events: [...job.events, event].slice(-MAX_RETAINED_EVENTS),
  };

  if (event.run_id && !next.runId) next.runId = event.run_id;

  if (WARNING_STATUSES.has(event.status)) {
    next.warnings = [...job.warnings, event];
  }

  if (event.status === 'partial' && typeof event.category === 'string') {
    if (!next.progress.categoriesDone.includes(event.category)) {
      next.progress = {
        ...next.progress,
        categoriesDone: [...next.progress.categoriesDone, event.category],
      };
    }
  }

  if (event.status === 'category_workers_failed' && Array.isArray(event.categories)) {
    const merged = new Set([...next.progress.categoriesFailed, ...event.categories]);
    next.progress = { ...next.progress, categoriesFailed: [...merged] };
  }

  const phase = phaseForEvent(event.status, job.phase);
  if (phase) next.phase = phase;

  return next;
}

type SseEventLike = Job['events'][number];

export function jobsReducer(state: JobsState, action: JobAction): JobsState {
  switch (action.type) {
    case 'hydrate':
      return { jobs: action.jobs };

    case 'enqueue':
      // Guard against a double submit racing itself.
      if (state.jobs.some((j) => j.id === action.job.id)) return state;
      return { jobs: [...state.jobs, action.job] };

    case 'start':
      return replace(state, action.jobId, (job) =>
        job.status === 'queued'
          ? {
              ...job,
              status: 'running',
              startedAt: action.at,
              ownerTabId: action.tabId,
              // An upload has no stream; everything else opens one.
              phase: job.kind === 'upload' ? 'uploading' : 'routing',
            }
          : job,
      );

    case 'event':
      return replace(state, action.jobId, (job) =>
        job.status === 'running' ? applyEvent(job, action.event) : job,
      );

    case 'complete':
      return replace(state, action.jobId, (job) => ({
        ...job,
        status: 'completed',
        phase: 'done',
        endedAt: action.at,
        seen: action.seen,
        uploadWarnings: action.warnings ?? job.uploadWarnings,
        ...(action.savedWhileAway && { savedWhileAway: true, uploadCheck: undefined, error: undefined }),
      }));

    case 'uploadCheck':
      return replace(state, action.jobId, (job) =>
        job.status === 'interrupted' ? { ...job, uploadCheck: action.check } : job,
      );

    case 'fail':
      return replace(state, action.jobId, (job) => ({
        ...job,
        status: 'failed',
        phase: 'failed',
        endedAt: action.at,
        error: action.error,
      }));

    case 'interrupt':
      // Only a running job can be interrupted. A job that already finished
      // must never be rewritten by a late liveness sweep.
      return replace(state, action.jobId, (job) =>
        job.status === 'running'
          ? {
              ...job,
              status: 'interrupted',
              endedAt: action.at,
              error: 'The tab running this job was closed or refreshed.',
            }
          : job,
      );

    case 'cancel':
      return replace(state, action.jobId, (job) =>
        job.status === 'queued' || job.status === 'running'
          ? { ...job, status: 'cancelled', endedAt: action.at }
          : job,
      );

    case 'markSeen': {
      let changed = false;
      const jobs = state.jobs.map((job) => {
        if (job.projectId !== action.projectId || job.seen) return job;
        changed = true;
        return { ...job, seen: true };
      });
      return changed ? { jobs } : state;
    }

    case 'dismiss':
      return { jobs: state.jobs.filter((j) => j.id !== action.jobId) };

    default:
      return state;
  }
}
