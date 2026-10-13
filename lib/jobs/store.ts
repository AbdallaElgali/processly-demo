import { jobsReducer, initialJobsState } from './reducer';
import type { Job, JobAction, JobsState } from './types';

type Listener = () => void;

/**
 * App-level job store, mounted above the route tree (CLAUDE.md 8.1).
 *
 * Deliberately a plain observable rather than a state library: the store also
 * has to own AbortControllers and, from step 2b, Web Locks and cross-tab
 * messages. Those are not React state, and splitting ownership between a
 * cache library and a hand-rolled scheduler would be worse than one small
 * store that owns all of it.
 *
 * Read through useSyncExternalStore (see hooks.ts), never by prop drilling.
 */
export class JobStore {
  private state: JobsState = initialJobsState;
  private listeners = new Set<Listener>();
  /** AbortControllers for running jobs. Not serialisable, so kept apart. */
  private controllers = new Map<string, AbortController>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): JobsState => this.state;

  dispatch = (action: JobAction): JobsState => {
    const next = jobsReducer(this.state, action);
    if (next === this.state) return next;
    this.state = next;
    this.listeners.forEach((l) => l());
    return next;
  };

  getJobs = (): Job[] => this.state.jobs;

  getJob = (jobId: string): Job | undefined =>
    this.state.jobs.find((j) => j.id === jobId);

  // --- abort control ------------------------------------------------------

  registerController(jobId: string, controller: AbortController) {
    this.controllers.set(jobId, controller);
  }

  releaseController(jobId: string) {
    this.controllers.delete(jobId);
  }

  /**
   * Stops the client side of a job.
   *
   * Only the local stream is guaranteed to stop. The backend may keep working,
   * and it saves results only when a run reaches `complete` (decision D9), so
   * the UI must not claim the run was undone (CLAUDE.md 8.3).
   */
  abort(jobId: string) {
    this.controllers.get(jobId)?.abort();
    this.controllers.delete(jobId);
  }

  abortAll() {
    this.controllers.forEach((c) => c.abort());
    this.controllers.clear();
  }
}

export const jobStore = new JobStore();
