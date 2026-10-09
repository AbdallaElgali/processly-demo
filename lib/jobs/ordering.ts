import { JOB_CAP } from './config';
import type { Job, JobKind } from './types';
import { isActive, isQueued } from './types';

/**
 * Scheduling rules (CLAUDE.md 8.1 and 8.3). Pure functions so the ordering can
 * be tested without a browser, a lock or a network.
 *
 * 1. At most JOB_CAP active jobs across the whole browser. Uploads,
 *    extractions and corrections all count.
 * 2. Corrections jump the queue: a queued correction starts before any queued
 *    upload or extraction.
 * 3. FIFO within a priority class, by createdAt.
 * 4. One project runs at most one extraction-or-correction at a time. Both
 *    write that project's candidates and flag chain, so letting two run
 *    concurrently would interleave writes to the same rows. Uploads are
 *    exempt: they touch documents, not parameters.
 */

/** Lower sorts first. */
const priority = (kind: JobKind): number => (kind === 'correction' ? 0 : 1);

export const byPriorityThenFifo = (a: Job, b: Job): number =>
  priority(a.kind) - priority(b.kind) || a.createdAt - b.createdAt;

/** Jobs that occupy a slot right now. */
export const activeJobs = (jobs: Job[]): Job[] => jobs.filter(isActive);

/** Queued jobs in the order they will actually start. */
export const queuedInStartOrder = (jobs: Job[]): Job[] =>
  jobs.filter(isQueued).sort(byPriorityThenFifo);

/**
 * Rule 4: is a parameter-writing job already occupying a slot for this project?
 *
 * `occupied` is the set of jobs holding a slot -- those already running PLUS
 * the ones chosen earlier in this same pass. It deliberately does NOT re-check
 * `isActive`: a job selected moments ago is still `queued` until the caller
 * starts it, and filtering on status here would let two corrections for one
 * project be selected together.
 */
const projectIsBusy = (occupied: Job[], projectId: string): boolean =>
  occupied.some((j) => j.projectId === projectId && j.kind !== 'upload');

/**
 * Which queued jobs should start now, given what is already running.
 *
 * Note the loop accumulates into `running`, so rules 1 and 4 are enforced
 * against decisions made earlier in this same pass: two queued corrections for
 * one project can never both be selected.
 */
export function selectStartable(jobs: Job[], cap: number = JOB_CAP): Job[] {
  const running = [...activeJobs(jobs)];
  const chosen: Job[] = [];

  for (const job of queuedInStartOrder(jobs)) {
    if (running.length >= cap) break;
    if (job.kind !== 'upload' && projectIsBusy(running, job.projectId)) continue;
    chosen.push(job);
    running.push(job);
  }

  return chosen;
}

/**
 * 1-based position shown as "Queued, position N". Computed over the whole
 * browser queue with the real ordering, so the number matches what happens.
 * Returns null when the job is not queued.
 */
export function queuePosition(jobs: Job[], jobId: string): number | null {
  const index = queuedInStartOrder(jobs).findIndex((j) => j.id === jobId);
  return index === -1 ? null : index + 1;
}

/**
 * Whether a project may start new work of this kind. Opening and browsing a
 * project is never gated by this (CLAUDE.md 8.1): only *starting* is.
 */
export function canStart(
  jobs: Job[],
  projectId: string,
  kind: JobKind,
): { allowed: true } | { allowed: false; reason: string } {
  if (kind === 'extraction') {
    const busy = jobs.some(
      (j) =>
        j.projectId === projectId &&
        j.kind === 'extraction' &&
        (isActive(j) || isQueued(j)),
    );
    if (busy) {
      return { allowed: false, reason: 'This project already has an extraction running or queued.' };
    }
  }

  if (kind === 'correction') {
    const busy = jobs.some(
      (j) =>
        j.projectId === projectId &&
        j.kind === 'correction' &&
        (isActive(j) || isQueued(j)),
    );
    if (busy) {
      return { allowed: false, reason: 'This project already has a correction running or queued.' };
    }
  }

  // At the cap the job is still accepted -- it queues rather than being
  // refused, which is what CLAUDE.md 8.1 requires.
  return { allowed: true };
}
