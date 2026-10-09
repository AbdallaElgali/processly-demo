import { loadProjectDetails } from '@/lib/project-data/actions';
import { JOB_CAP } from './config';
import { selectStartable } from './ordering';
import { runCorrection, runExtraction, runUpload, type RunContext, type RunOutcome } from './runners';
import { jobStore } from './store';
import type { Job, JobPayload } from './types';

/**
 * Starts queued jobs when a slot frees, and applies their outcome.
 *
 * In-tab only for now: the cap is enforced across this tab's store. Step 2b
 * makes it per browser with Web Locks and a shared record, behind this same
 * interface (CLAUDE.md 8.1).
 *
 * The runtime owns a job for its whole life. The component that pressed
 * Analyze does not, which is the point: navigating away must neither cancel
 * the run nor misdirect its results.
 */
export class JobRuntime {
  private userId: string | null = null;
  /**
   * Files for queued uploads, held in memory until the upload runs. Step 2b
   * moves these to IndexedDB so a queued upload survives a refresh; until
   * then a refresh loses them, which is why only 2b claims that guarantee.
   */
  private pendingFiles = new Map<string, File[]>();
  private pumping = false;

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  /** Files are passed separately: they are not serialisable into the job. */
  enqueue(job: Job, files?: File[]) {
    if (files) this.pendingFiles.set(job.id, files);
    jobStore.dispatch({ type: 'enqueue', job });
    this.pump();
  }

  cancel(jobId: string) {
    const job = jobStore.getJob(jobId);
    if (!job) return;
    // Aborting a running stream stops only this side. The backend may keep
    // working and saves nothing unless the run reaches `complete` (D9), so the
    // UI must not claim the run was undone (CLAUDE.md 8.3).
    if (job.status === 'running') jobStore.abort(jobId);
    jobStore.dispatch({ type: 'cancel', jobId, at: Date.now() });
    this.pendingFiles.delete(jobId);
    this.pump();
  }

  /** Starts whatever the ordering rules allow. Safe to call repeatedly. */
  pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      const startable = selectStartable(jobStore.getJobs(), JOB_CAP);
      for (const job of startable) void this.start(job);
    } finally {
      this.pumping = false;
    }
  }

  private async start(job: Job) {
    if (!this.userId) return;

    const controller = new AbortController();
    jobStore.registerController(job.id, controller);
    jobStore.dispatch({ type: 'start', jobId: job.id, tabId: 'local', at: Date.now() });

    const ctx: RunContext = {
      signal: controller.signal,
      emit: (event) => jobStore.dispatch({ type: 'event', jobId: job.id, event }),
    };

    let outcome: RunOutcome;
    try {
      outcome = await this.runByKind(job, ctx, job.payload);
    } catch (error) {
      outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      jobStore.releaseController(job.id);
      this.pendingFiles.delete(job.id);
    }

    // A cancelled job keeps its cancelled status; do not overwrite it.
    if (jobStore.getJob(job.id)?.status === 'cancelled') {
      this.pump();
      return;
    }

    if (outcome.ok) {
      // Completion refreshes that project's data in the background and never
      // navigates. `seen` is true only when the project is already on screen.
      await loadProjectDetails(job.projectId, { background: true });
      jobStore.dispatch({
        type: 'complete',
        jobId: job.id,
        at: Date.now(),
        seen: this.isProjectOnScreen(job.projectId),
      });
    } else {
      jobStore.dispatch({
        type: 'fail',
        jobId: job.id,
        at: Date.now(),
        error: outcome.error ?? 'The job failed.',
      });
    }

    this.pump();
  }

  private runByKind(job: Job, ctx: RunContext, payload: JobPayload): Promise<RunOutcome> {
    const userId = this.userId!;
    switch (payload.kind) {
      case 'extraction':
        return runExtraction(job, ctx, userId);
      case 'correction':
        return runCorrection(job, ctx, userId);
      case 'upload':
        return runUpload(job, ctx, this.pendingFiles.get(job.id) ?? []);
    }
  }

  /** Injected by the provider; avoids the runtime importing UI state. */
  isProjectOnScreen: (projectId: string) => boolean = () => false;
}

export const jobRuntime = new JobRuntime();

/** Builds a job record. Ids are generated here so callers cannot collide. */
export function createJob(
  projectId: string,
  payload: JobPayload,
): Job {
  return {
    id: `${payload.kind}-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    kind: payload.kind,
    status: 'queued',
    createdAt: Date.now(),
    phase: 'queued',
    events: [],
    warnings: [],
    progress: { categoriesDone: [], categoriesFailed: [] },
    seen: false,
    payload,
  };
}
