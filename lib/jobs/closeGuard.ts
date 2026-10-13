import type { Job } from './types';

/** Shown by the running-job indicator (backend X3: closing the tab cancels the analysis and nothing is saved). */
export const KEEP_TAB_OPEN_TEXT = 'Keep this tab open until the analysis finishes';

/** An extraction or correction is streaming. Uploads are not analyses; queued jobs have not started. */
export function hasRunningAnalysis(jobs: readonly Job[]): boolean {
  return jobs.some((j) => j.status === 'running' && (j.kind === 'extraction' || j.kind === 'correction'));
}

/**
 * A `beforeunload` handler that makes the browser ask before the tab is closed
 * or reloaded, only while an analysis runs. It reads the jobs when the event
 * fires, so it never needs re-attaching.
 */
export function closeWarningHandler(getJobs: () => readonly Job[]): (event: BeforeUnloadEvent) => void {
  return (event) => {
    if (!hasRunningAnalysis(getJobs())) return;
    event.preventDefault();
    // Older browsers need a return value to show the prompt.
    event.returnValue = '';
  };
}
