import type { Job, JobStatus } from './types';

/**
 * What the job tray shows, and when finished jobs go away. Pure, so the rules
 * are tested without a browser.
 *
 * - Running and queued work is always listed.
 * - A completed job is listed for a short time, then it clears itself (its
 *   runs stay visible in the project's Runs view).
 * - A failed or interrupted job stays until the person dismisses it. So does a
 *   completed upload that had rejected files, because that is the only place
 *   the reasons are shown.
 * - One entry per job id, and at most `MAX_TRAY_ENTRIES` entries; the rest are
 *   counted ("+N more").
 */

export const COMPLETED_VISIBLE_MS = 8_000;
export const MAX_TRAY_ENTRIES = 6;

/** Order in the tray: lower first. */
const RANK: Record<JobStatus, number> = {
  running: 0,
  queued: 1,
  failed: 2,
  interrupted: 3,
  completed: 4,
  cancelled: 5,
};

/** How far a job has got; a later stage wins when the same id appears twice. */
const STAGE: Record<JobStatus, number> = {
  queued: 0,
  running: 1,
  interrupted: 2,
  failed: 2,
  completed: 2,
  cancelled: 2,
};

const endedOrCreated = (job: Job) => job.endedAt ?? job.createdAt;

/** One job per id. A repeated id keeps the most advanced copy, at the position of its first appearance. */
export function dedupeJobs(jobs: Job[]): Job[] {
  const index = new Map<string, number>();
  const out: Job[] = [];
  for (const job of jobs) {
    const at = index.get(job.id);
    if (at === undefined) {
      index.set(job.id, out.length);
      out.push(job);
    } else if (STAGE[job.status] >= STAGE[out[at].status]) {
      out[at] = job;
    }
  }
  return out;
}

/** Jobs that stay until the person dismisses them. */
export function staysUntilDismissed(job: Job): boolean {
  if (job.status === 'failed' || job.status === 'interrupted') return true;
  return job.status === 'completed' && (job.uploadWarnings?.length ?? 0) > 0;
}

export interface TrayEntries {
  entries: Job[];
  /** Entries beyond the cap, for the "+N more" line. */
  more: number;
}

export function trayEntries(jobs: Job[], now: number, max: number = MAX_TRAY_ENTRIES): TrayEntries {
  const visible = dedupeJobs(jobs).filter((job) => {
    if (job.status === 'running' || job.status === 'queued') return true;
    if (staysUntilDismissed(job)) return true;
    if (job.status === 'completed') return endedOrCreated(job) + COMPLETED_VISIBLE_MS > now;
    return false;
  });
  visible.sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    // Waiting work in start order, finished work newest first.
    return a.status === 'queued' || a.status === 'running'
      ? a.createdAt - b.createdAt
      : endedOrCreated(b) - endedOrCreated(a);
  });
  return { entries: visible.slice(0, max), more: Math.max(0, visible.length - max) };
}

/** Finished jobs the store can drop on its own: completed (results seen) and cancelled ones past the window. */
export function jobsToSweep(jobs: Job[], now: number): string[] {
  return dedupeJobs(jobs)
    .filter((job) => {
      if (staysUntilDismissed(job)) return false;
      if (job.status === 'cancelled') return endedOrCreated(job) + COMPLETED_VISIBLE_MS <= now;
      // Unseen results keep their project badge until that project is opened.
      if (job.status === 'completed') return job.seen && endedOrCreated(job) + COMPLETED_VISIBLE_MS <= now;
      return false;
    })
    .map((job) => job.id);
}

/** Everything that is not waiting or running: what "Clear all finished" removes. */
export function finishedJobIds(jobs: Job[]): string[] {
  return dedupeJobs(jobs)
    .filter((job) => job.status !== 'running' && job.status !== 'queued')
    .map((job) => job.id);
}

/**
 * "Run again" starts a NEW run that costs tokens, so it is offered for an
 * interrupted extraction or correction only. An upload is never re-run by the
 * app: the person adds the file again.
 */
export function canRetry(job: Job): boolean {
  return job.kind !== 'upload' && job.status === 'interrupted';
}
