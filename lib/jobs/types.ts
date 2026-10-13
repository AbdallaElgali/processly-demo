import type { SseEvent, TimelinePhase } from './sse-types';

export type JobKind = 'upload' | 'extraction' | 'correction';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'cancelled';

/** A file waiting in IndexedDB for a queued upload to run (CLAUDE.md 8.1). */
export interface PendingFileRef {
  idbId: string;
  name: string;
  type: string;
  size: number;
}

export type JobPayload =
  | { kind: 'upload'; fileRefs: PendingFileRef[] }
  | {
      kind: 'extraction';
      /** ITERATIVE when flagged parameters are sent back as `previous_specs`. */
      mode: 'BLIND' | 'ITERATIVE';
      previousSpecs: Record<string, unknown> | null;
    }
  | {
      kind: 'correction';
      parameterKey: string;
      previousMetrics: unknown[];
      userHint: string | null;
    };

export interface JobProgress {
  categoriesDone: string[];
  categoriesFailed: string[];
}

/**
 * One unit of long-running work, owned by the app-level store rather than by
 * the component that started it (CLAUDE.md 8.1).
 *
 * `projectId` is the important field: results are applied to THAT project, not
 * to whatever is on screen. See the D11 regression test.
 */
export interface Job {
  id: string;
  projectId: string;
  kind: JobKind;
  status: JobStatus;

  createdAt: number;
  startedAt?: number;
  endedAt?: number;

  /** Which tab is running it. Liveness comes from the per-job Web Lock, not
   *  from a timer or from this field (AM2). */
  ownerTabId?: string;
  /** The tab that queued it: that tab starts it, so work appears where the
   *  user asked for it. Any tab may adopt it if that tab is gone. */
  enqueuedByTabId?: string;

  phase: TimelinePhase;
  events: SseEvent[];
  warnings: SseEvent[];
  progress: JobProgress;
  error?: string;

  /**
   * Per-file upload failures (`RunOutcome.warnings` from `runUpload`): the job
   * still completed, since at least one file landed, but these specific files
   * did not. Only uploads ever set this; extraction/correction warnings are
   * `warnings` above instead.
   */
  uploadWarnings?: string[];

  /** False until the results have been seen in that project (CLAUDE.md 8.1). */
  seen: boolean;

  /** Populated from the first event carrying one. Task B (RFC 5 P0). */
  runId?: string;

  payload: JobPayload;
}

export type JobAction =
  | { type: 'enqueue'; job: Job }
  | { type: 'start'; jobId: string; tabId: string; at: number }
  | { type: 'event'; jobId: string; event: SseEvent }
  | { type: 'complete'; jobId: string; at: number; seen: boolean; warnings?: string[] }
  | { type: 'fail'; jobId: string; at: number; error: string }
  | { type: 'interrupt'; jobId: string; at: number }
  | { type: 'cancel'; jobId: string; at: number }
  | { type: 'markSeen'; projectId: string }
  | { type: 'dismiss'; jobId: string }
  /** Replaces the whole set, e.g. when another tab changed shared storage. */
  | { type: 'hydrate'; jobs: Job[] };

export type JobsState = {
  /** Insertion-ordered; FIFO within a priority class depends on createdAt. */
  jobs: Job[];
};

export const ACTIVE_STATUSES: ReadonlySet<JobStatus> = new Set(['running']);

export const isActive = (job: Job) => ACTIVE_STATUSES.has(job.status);
export const isQueued = (job: Job) => job.status === 'queued';
