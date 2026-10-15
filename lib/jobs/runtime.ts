import { apiGetProjectDetails } from '@/api/projects';
import { reloadAfterRun } from '@/lib/project-data/actions';
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
import { checkUploadOutcome } from './uploadRecovery';
import { canEnqueue } from './ordering';
import { canRetry, finishedJobIds, jobsToSweep } from './tray';
import { fileRefsOf } from './uploadGuard';
import type { Job, JobPayload } from './types';

/**
 * Owns long-running work for the whole browser.
 *
 * The cap is per browser, not per tab (CLAUDE.md 8.1): all tabs share one
 * queue through localStorage, serialise their decisions on one Web Lock, and
 * announce changes on a BroadcastChannel. Exactly one tab runs each job.
 */
/** How often finished jobs past their short window are dropped. */
const SWEEP_INTERVAL_MS = 4_000;

export type EnqueueResult = { allowed: true } | { allowed: false; reason: string };

export class JobRuntime {
  private userId: string | null = null;
  private locks: LockManager = new WebLockManager();
  private channel: BroadcastChannel | null = null;
  private releaseTabLock: (() => void) | null = null;
  private jobLockReleasers = new Map<string, () => void>();
  private started = false;
  private pumping = false;
  private pumpQueued = false;
  /** Interrupted uploads this tab is currently checking against the project's documents. */
  private recovering = new Set<string>();

  readonly tabId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`;

  /** Injected by the provider so the runtime need not import UI state. */
  isProjectOnScreen: (projectId: string) => boolean = () => false;

  /** Injected by the provider: a small notification when a job settles (never navigation, CLAUDE.md 8.1). */
  onJobSettled: (job: Job, outcome: RunOutcome) => void = () => undefined;

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
    // An upload left interrupted whose check never finished (its tab died mid-check).
    for (const job of jobStore.getJobs()) {
      if (job.status === 'interrupted' && job.kind === 'upload' && (!job.uploadCheck || job.uploadCheck.state === 'checking')) {
        void this.recoverUpload(job.id);
      }
    }
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
    window.setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);

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

  /**
   * Accepts a job, or refuses it. The decision is made under the scheduler
   * lock against the SHARED record of every tab, so two tabs cannot both
   * start an extraction for one project: a second extraction is refused here,
   * not only by a disabled button.
   */
  async enqueue(job: Job, files?: File[]): Promise<EnqueueResult> {
    let stamped: Job = { ...job, enqueuedByTabId: this.tabId };
    if (stamped.payload.kind === 'upload' && files?.length) {
      // The job must say which files it carries: the tabs, the duplicate
      // guard and the interrupted-upload check all read the names from here.
      stamped = { ...stamped, payload: { kind: 'upload', fileRefs: fileRefsOf(stamped.id, files) } };
    }
    const verdict = await withSchedulerLock(this.locks, async (): Promise<EnqueueResult> => {
      const verdict = canEnqueue(this.mergeSharedRecord(readJobs()), stamped);
      if (!verdict.allowed) return verdict;
      if (files?.length) await savePendingFiles(stamped.id, stamped.projectId, files);
      jobStore.dispatch({ type: 'enqueue', job: stamped });
      this.publish();
      return verdict;
    });
    if (verdict.allowed) void this.pump();
    return verdict;
  }

  /** Writes the shared record and tells the other tabs. */
  private publish() {
    writeJobs(prunePersistable(jobStore.getJobs()));
    this.channel?.postMessage({ from: this.tabId });
  }

  /** Re-queues an interrupted job as a NEW run. Re-running costs tokens, so
   *  this is always the user's choice (CLAUDE.md 8.1). */
  async runAgain(jobId: string) {
    const job = jobStore.getJob(jobId);
    if (!job) return;
    // An upload is never re-run by the app: the person adds the file again.
    if (!canRetry(job)) return;
    const replacement = createJob(job.projectId, job.payload);
    jobStore.dispatch({ type: 'dismiss', jobId });
    await deletePendingFiles(jobId);
    await this.enqueue(replacement);
  }

  private async finishSavedWhileAway(jobId: string, projectId: string) {
    await deletePendingFiles(jobId);
    await reloadAfterRun(projectId);
    // Not marked seen: the "Saved while you were away" line is the news.
    jobStore.dispatch({ type: 'complete', jobId, at: Date.now(), seen: false, savedWhileAway: true });
    this.publish();
  }

  /**
   * An interrupted upload is not known to be lost: the server keeps working on
   * a fully sent file and lists the document once it is done. Poll the
   * project's documents for about a minute, then say what is there.
   */
  private async recoverUpload(jobId: string) {
    if (this.recovering.has(jobId)) return;
    const job = jobStore.getJob(jobId);
    if (!job || job.status !== 'interrupted' || job.payload.kind !== 'upload') return;
    const names = job.payload.fileRefs.map((ref) => ref.name);
    // One tab polls per job: another tab (or an earlier call) already holds it.
    const release = await this.locks.tryHold(`bda-recover-${jobId}`);
    if (!release) return;
    this.recovering.add(jobId);
    try {
      jobStore.dispatch({ type: 'uploadCheck', jobId, check: { state: 'checking' } });
      this.publish();
      const outcome = names.length
        ? await checkUploadOutcome({ names, fetchDocuments: () => fetchProjectDocuments(job.projectId) })
        : { saved: [], missing: [], checked: false };

      // Dismissed or run again while we waited: leave it alone.
      if (jobStore.getJob(jobId)?.status !== 'interrupted') return;
      if (outcome.checked && outcome.missing.length === 0) {
        await this.finishSavedWhileAway(jobId, job.projectId);
        return;
      }
      jobStore.dispatch({
        type: 'uploadCheck',
        jobId,
        check: outcome.checked
          ? { state: 'missing', missing: outcome.missing, saved: outcome.saved.length }
          : { state: 'unknown' },
      });
      this.publish();
    } finally {
      this.recovering.delete(jobId);
      release();
    }
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
    await this.dismissMany([jobId]);
  }

  /** Removes finished jobs from the store AND the shared record, so no tab brings them back. */
  async dismissMany(jobIds: string[]) {
    if (jobIds.length === 0) return;
    jobStore.dispatch({ type: 'dismissMany', jobIds });
    await Promise.all(jobIds.map((id) => deletePendingFiles(id)));
    this.publish();
  }

  /** "Clear all finished": every job that is not waiting or running. */
  async clearFinished() {
    await this.dismissMany(finishedJobIds(jobStore.getJobs()));
  }

  /** The results of a project have been seen; written to the shared record so a reload does not bring the badge back. */
  markSeen(projectId: string) {
    jobStore.dispatch({ type: 'markSeen', projectId });
    this.publish();
  }

  /** Drops completed (seen) and cancelled jobs once their short window is over. */
  async sweep(now: number = Date.now()) {
    await this.dismissMany(jobsToSweep(jobStore.getJobs(), now));
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
      const interruptedUploads = plan.interrupted.filter((job) => job.kind === 'upload');

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
      for (const job of interruptedUploads) void this.recoverUpload(job.id);
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
      // A stream aborted part-way has already put partial candidates into the
      // rows in memory; the backend saved none of them (D9).
      if (job.payload.kind === 'extraction' || job.payload.kind === 'correction') await reloadAfterRun(job.projectId);
      this.releaseJobLock(job.id);
      void this.pump();
      return;
    }

    if (outcome.ok) {
      await deletePendingFiles(job.id);
      // Completion refreshes that project in the background and never
      // navigates (CLAUDE.md 8.1).
      await reloadAfterRun(job.projectId);
      jobStore.dispatch({
        type: 'complete',
        jobId: job.id,
        at: Date.now(),
        seen: this.isProjectOnScreen(job.projectId),
        warnings: outcome.warnings,
      });
    } else {
      if (job.payload.kind === 'extraction' || job.payload.kind === 'correction') await reloadAfterRun(job.projectId);
      jobStore.dispatch({
        type: 'fail',
        jobId: job.id,
        at: Date.now(),
        error: outcome.error ?? 'The job failed.',
      });
    }
    this.onJobSettled(job, outcome);

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

async function fetchProjectDocuments(projectId: string): Promise<readonly { name: string }[]> {
  return (await apiGetProjectDetails(projectId)).documents ?? [];
}
