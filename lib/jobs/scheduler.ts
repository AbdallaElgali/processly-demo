import { JOB_CAP, SCHEDULER_LOCK, jobLockName } from './config';
import type { LockManager } from './locks';
import { selectStartable } from './ordering';
import type { Job } from './types';

export const tabLockName = (tabId: string) => `bda-tab-${tabId}`;

/**
 * Decides, for one tab, which jobs that tab should start now.
 *
 * Pure apart from the lock queries, so the two-tab rules are unit-testable
 * (AM3). Everything here runs inside the scheduler lock, so the decisions of
 * concurrent tabs are serialised and two tabs can never claim the same job.
 */

export interface SchedulePassInput {
  jobs: Job[];
  tabId: string;
  heldLockNames: string[];
  cap?: number;
}

export interface SchedulePassResult {
  /** Jobs whose owning tab is gone; they become Interrupted. */
  interrupted: Job[];
  /** Jobs this tab should claim and run. */
  toStart: Job[];
}

/**
 * A running job is alive while its per-job lock is held somewhere in this
 * origin. The browser releases that lock when the owning tab closes, crashes
 * or reloads — so "no lock" means the tab died, with no timer involved (AM2).
 *
 * The lock is always acquired BEFORE a job is marked running, so a job in the
 * record as running with no lock has genuinely lost its owner; there is no
 * start-up window to tolerate.
 */
export function planSchedulePass({
  jobs,
  tabId,
  heldLockNames,
  cap = JOB_CAP,
}: SchedulePassInput): SchedulePassResult {
  const held = new Set(heldLockNames);

  const interrupted = jobs.filter(
    (job) => job.status === 'running' && !held.has(jobLockName(job.id)),
  );

  // Treat those as gone when deciding what can start, so a dead job does not
  // keep occupying a slot.
  const deadIds = new Set(interrupted.map((j) => j.id));
  const effective = jobs.map((job) =>
    deadIds.has(job.id) ? { ...job, status: 'interrupted' as const } : job,
  );

  const startable = selectStartable(effective, cap);

  // A job is started by the tab that queued it, so work appears where the user
  // asked for it. If that tab is gone (its tab lock is not held) any surviving
  // tab may adopt the job, otherwise closing a tab would strand its queue.
  const toStart = startable.filter((job) => {
    const owner = job.enqueuedByTabId;
    if (!owner || owner === tabId) return true;
    return !held.has(tabLockName(owner));
  });

  return { interrupted, toStart };
}

/** Runs one scheduler pass under the shared lock. */
export async function withSchedulerLock<T>(
  locks: LockManager,
  fn: () => Promise<T>,
): Promise<T> {
  return locks.withLock(SCHEDULER_LOCK, fn);
}
