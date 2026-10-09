import { loadProjectDetails } from '@/lib/project-data/actions';
import {
  deletePendingFiles,
  loadPendingFiles,
  savePendingFiles,
  sweepPendingFiles,
} from '@/lib/db';
import { JOBS_CHANNEL, JOBS_STORAGE_KEY, jobLockName } from './config';
import { WebLockManager, type LockManager } from './locks';
import { prunePersistable, readJobs, writeJobs } from './persistence';
import { runCorrection, runExtraction, runUpload, type RunContext, type RunOutcome } from './runners';
import { planSchedulePass, tabLockName, withSchedulerLock } from './scheduler';
import { jobStore } from './store';
import type { Job, JobPayload } from './types';

/**
 * Owns long-running work for the whole browser.
 *
 * The cap is per browser, not per tab (CLAUDE.md 8.1): all tabs share one
 * queue through localStorage, serialise their decisions on one Web Lock, and
 * announce changes on a BroadcastChannel. Exactly one tab runs each job.
 */
export class JobRuntime {
  private userId: string | null = null;
  private locks: LockManager = new WebLockManager();
  private channel: BroadcastChannel | null = null;
  private releaseTabLock: (() => void) | null = null;
  private jobLockReleasers = new Map<string, () => void>();
  private started = false;
  private pumping = false;
  private pumpQueued = false;

  readonly tabId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`;

  /** Injected by the provider so the runtime need not import UI state. */
  isProjectOnScreen: (projectId: string) => boolean = () => false;

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  /** Mounted once by the provider. Safe to call repeatedly. */
  async start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    if (!this.locks.available) {
      // Without Web Locks there is no safe way to share a cap between tabs.
      // Degrade to a per-tab cap rather than risk two tabs running the same
      // job, and say so once.
      console.warn(
        'This browser has no Web Locks API: the job cap applies per tab instead of per browser.',
      );
    }

    // Held for this tab's lifetime; released by the browser when it dies. Lets
    // other tabs tell a closed tab from a merely idle one.
    this.releaseTabLock = await this.locks.tryHold(tabLockName(this.tabId));

    // Adopt whatever the last session left behind.
    jobStore.dispatch({ type: 'hydrate', jobs: prunePersistable(readJobs()) });
    await sweepPendingFiles(new Set(jobStore.getJobs().map((j) => j.id)));

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(JOBS_CHANNEL);
      this.channel.onmessage = () => this.adoptSharedRecord();
    }
    // `storage` fires in every OTHER tab, so it covers browsers without
    // BroadcastChannel and acts as a backstop when a message is missed.
    window.addEventListener('storage', (event) => {
      if (event.key === JOBS_STORAGE_KEY) this.adoptSharedRecord();
    });

    window.addEventListener('pagehide', () => this.handlePageHide());

    void this.pump();
  }

  private adoptSharedRecord() {
    jobStore.dispatch({ type: 'hydrate', jobs: this.mergeSharedRecord(readJobs()) });
    void this.pump();
  }

  /**
   * Reconciles the shared record with this tab's live state.
   *
   * A job this tab is running accumulates `events`, `phase`, `warnings` and
   * `progress` locally; those are only published at start, completion and
   * failure, because writing localStorage on every SSE frame would be wasteful
   * and would wake every other tab. So for jobs we hold the lock on, the local
   * copy is newer than the record and must win -- otherwise any cross-tab
   * nudge would reset a running job's timeline to whatever was last published.
   */
  private mergeSharedRecord(stored: Job[]): Job[] {
    const local = new Map(jobStore.getJobs().map((job) => [job.id, job]));
    const merged = prunePersistable(stored).map((job) => {
      const mine = local.get(job.id);
      const iAmRunningIt = this.jobLockReleasers.has(job.id) && mine?.status === 'running';
      return iAmRunningIt ? mine! : job;
    });

    // Anything this tab knows about that has not reached the record yet.
    const seen = new Set(merged.map((job) => job.id));
    for (const job of local.values()) {
      if (!seen.has(job.id) && (job.status === 'queued' || job.status === 'running')) {
        merged.push(job);
      }
    }
    return merged;
  }

  /** Writes the shared record and tells the other tabs. */
  private publish() {
    writeJobs(prunePersistable(jobStore.getJobs()));
    this.channel?.postMessage({ from: this.tabId });
  }

  async enqueue(job: Job, files?: File[]) {
    const stamped: Job = { ...job, enqueuedByTabId: this.tabId };
    if (files?.length) await savePendingFiles(stamped.id, stamped.projectId, files);
    jobStore.dispatch({ type: 'enqueue', job: stamped });
    this.publish();
    void this.pump();
  }

  /** Re-queues an interrupted job as a NEW run. Re-running costs tokens, so
   *  this is always the user's choice (CLAUDE.md 8.1). */
  async runAgain(jobId: string) {
    const job = jobStore.getJob(jobId);
    if (!job) return;
    const files = job.kind === 'upload' ? await loadPendingFiles(job.id) : undefined;
    const replacement = createJob(job.projectId, job.payload);
    jobStore.dispatch({ type: 'dismiss', jobId });
    await deletePendingFiles(jobId);
    await this.enqueue(replacement, files);
  }

  async cancel(jobId: string) {
    const job = jobStore.getJob(jobId);
    if (!job) return;
    // Aborting stops only this side. The backend may keep working and saves
    // nothing unless the run reaches `complete` (D9), so the UI must not claim
    // the run was undone (CLAUDE.md 8.3).
    if (job.status === 'running') jobStore.abort(jobId);
    jobStore.dispatch({ type: 'cancel', jobId, at: Date.now() });
    await deletePendingFiles(jobId);
    this.releaseJobLock(jobId);
    this.publish();
    void this.pump();
  }

  async dismiss(jobId: string) {
    jobStore.dispatch({ type: 'dismiss', jobId });
    await deletePendingFiles(jobId);
    this.publish();
  }

  /**
   * One scheduler pass: adopt the shared record, mark dead jobs interrupted,
   * claim what this tab should start.
   *
   * Coalesced: a pass triggered while one is running sets a flag instead of
   * stacking, so a burst of storage events cannot pile up passes.
   */
  async pump(): Promise<void> {
    if (this.pumping) {
      this.pumpQueued = true;
      return;
    }
    this.pumping = true;
    try {
      do {
        this.pumpQueued = false;
        await this.onePass();
      } while (this.pumpQueued);
    } finally {
      this.pumping = false;
    }
  }

  private async onePass() {
    const claimed: Array<{ job: Job; release: () => void }> = [];

    await withSchedulerLock(this.locks, async () => {
      // Re-read inside the lock: another tab may have changed things. Merge
      // rather than replace, so this tab's in-flight runs keep their timeline.
      const jobs = this.mergeSharedRecord(readJobs());
      jobStore.dispatch({ type: 'hydrate', jobs });

      const heldLockNames = await this.locks.heldNames();
      const plan = planSchedulePass({ jobs, tabId: this.tabId, heldLockNames });

      for (const job of plan.interrupted) {
        jobStore.dispatch({ type: 'interrupt', jobId: job.id, at: Date.now() });
      }

      for (const job of plan.toStart) {
        // Claim by taking the per-job lock BEFORE marking it running, so a
        // concurrent liveness sweep can never see a running job with no lock.
        const release = await this.locks.tryHold(jobLockName(job.id));
        if (!release) continue; // another tab won the race
        this.jobLockReleasers.set(job.id, release);
        jobStore.dispatch({ type: 'start', jobId: job.id, tabId: this.tabId, at: Date.now() });
        claimed.push({ job: jobStore.getJob(job.id)!, release });
      }

      if (plan.interrupted.length > 0 || claimed.length > 0) this.publish();
    });

    // Run outside the scheduler lock: a run takes minutes and must not block
    // every other tab's scheduling.
    for (const { job } of claimed) void this.execute(job);
  }

  private releaseJobLock(jobId: string) {
    const release = this.jobLockReleasers.get(jobId);
    if (release) {
      release();
      this.jobLockReleasers.delete(jobId);
    }
  }

  private async execute(job: Job) {
    if (!this.userId) {
      this.releaseJobLock(job.id);
      return;
    }

    const controller = new AbortController();
    jobStore.registerController(job.id, controller);

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
    }

    // A cancelled job keeps its status; do not overwrite it.
    if (jobStore.getJob(job.id)?.status === 'cancelled') {
      this.releaseJobLock(job.id);
      void this.pump();
      return;
    }

    if (outcome.ok) {
      await deletePendingFiles(job.id);
      // Completion refreshes that project in the background and never
      // navigates (CLAUDE.md 8.1).
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

    this.releaseJobLock(job.id);
    this.publish();
    void this.pump();
  }

  private runByKind(job: Job, ctx: RunContext, payload: JobPayload): Promise<RunOutcome> {
    const userId = this.userId!;
    switch (payload.kind) {
      case 'extraction':
        return runExtraction(job, ctx, userId);
      case 'correction':
        return runCorrection(job, ctx, userId);
      case 'upload':
        return loadPendingFiles(job.id).then((files) => runUpload(job, ctx, files));
    }
  }

  /**
   * The tab is going away. Abort in flight work and drop the locks so other
   * tabs see the jobs as interrupted immediately rather than waiting for the
   * browser to notice. Running jobs are NOT re-queued: a re-run costs tokens
   * and creates a new extraction run, so it stays the user's choice.
   */
  private handlePageHide() {
    jobStore.abortAll();
    this.jobLockReleasers.forEach((release) => release());
    this.jobLockReleasers.clear();
    this.releaseTabLock?.();
    this.releaseTabLock = null;
  }
}

export const jobRuntime = new JobRuntime();

/** Builds a job record. Ids are generated here so callers cannot collide. */
export function createJob(projectId: string, payload: JobPayload): Job {
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
