import { JOBS_STORAGE_KEY } from './config';
import type { Job } from './types';

/**
 * The shared job record.
 *
 * localStorage is the source of truth ACROSS tabs (CLAUDE.md 8.1: the cap is
 * per browser, not per tab). Every scheduler decision re-reads it under the
 * scheduler lock rather than trusting the tab's in-memory copy, which may be
 * stale by a few milliseconds.
 *
 * Only serialisable state goes here. AbortControllers, lock releasers and the
 * File objects for a queued upload do not: files live in IndexedDB
 * (lib/db.ts), the rest is per-tab and is reconstructed on load.
 */

/** Events are only needed for the live timeline, so persist a short tail. */
const PERSISTED_EVENT_TAIL = 20;

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export function readJobs(): Job[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(JOBS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Job[]) : [];
  } catch {
    // A corrupt or partially-written record must not brick the app. Losing the
    // queue is recoverable; a crash loop on startup is not.
    return [];
  }
}

export function writeJobs(jobs: Job[]): void {
  if (!isBrowser()) return;
  try {
    const slim = jobs.map((job) => ({
      ...job,
      events: job.events.slice(-PERSISTED_EVENT_TAIL),
    }));
    window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(slim));
  } catch (error) {
    // Most likely a quota error. Keep running on the in-memory copy.
    console.error('Could not persist the job queue', error);
  }
}

/**
 * Jobs worth keeping between sessions.
 *
 * Queued and interrupted jobs are kept: the first so the queue survives a
 * refresh, the second so "Run again" is still offered. Finished jobs are kept
 * only while unseen, so a completed run can still raise its badge; everything
 * else is dropped so the record cannot grow forever.
 */
export function prunePersistable(jobs: Job[]): Job[] {
  return jobs.filter((job) => {
    if (job.status === 'queued' || job.status === 'running' || job.status === 'interrupted') return true;
    if (job.status === 'completed') return !job.seen;
    if (job.status === 'failed') return true;
    return false; // cancelled
  });
}
