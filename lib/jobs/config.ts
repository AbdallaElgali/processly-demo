/**
 * Job scheduling constants (CLAUDE.md 8.1).
 *
 * The cap is deliberately ONE constant: browsers allow roughly 6 concurrent
 * connections per origin over HTTP/1.1, and the app still needs connections
 * for ordinary navigation while extractions stream.
 */
export const JOB_CAP = 3;

/** Shared storage key for the cross-tab job record (step 2b reads/writes it). */
export const JOBS_STORAGE_KEY = 'bda.jobs.v1';

/** Cross-tab message channel (step 2b). */
export const JOBS_CHANNEL = 'bda-jobs';

/** Web Lock serialising scheduler decisions so two tabs cannot start one job. */
export const SCHEDULER_LOCK = 'bda-jobs-scheduler';

/** Per-job Web Lock. Held for the run; its absence means the owner died (AM2). */
export const jobLockName = (jobId: string) => `bda-job-${jobId}`;

/**
 * Partial results arrive faster than the UI needs to repaint. Coalesce them.
 * Carried over from the previous useAnalyze implementation, which used 120ms.
 */
export const PARTIAL_FLUSH_MS = 120;

/** Cap on retained SSE events per job, so a long run cannot grow without bound. */
export const MAX_RETAINED_EVENTS = 200;
