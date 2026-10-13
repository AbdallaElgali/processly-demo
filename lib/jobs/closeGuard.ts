import type { Job } from './types';

/** Shown by the running-job indicator (backend X3: closing the tab cancels the analysis and nothing is saved). */
export const KEEP_TAB_OPEN_TEXT = 'Keep this tab open until the analysis finishes';

/** Backend U1: a fully sent upload survives the tab, but closing during the send itself loses the file. */
export const KEEP_UPLOAD_OPEN_TEXT = 'Keep this tab open until the upload has been sent';

/** An extraction or correction is streaming. Uploads are not analyses; queued jobs have not started. */
export function hasRunningAnalysis(jobs: readonly Job[]): boolean {
  return jobs.some((j) => j.status === 'running' && (j.kind === 'extraction' || j.kind === 'correction'));
}

export function hasRunningUpload(jobs: readonly Job[]): boolean {
  return jobs.some((j) => j.status === 'running' && j.kind === 'upload');
}

/** The "keep this tab open" line for what is running, or null. An analysis outranks an upload. */
export function keepOpenText(jobs: readonly Job[]): string | null {
  if (hasRunningAnalysis(jobs)) return KEEP_TAB_OPEN_TEXT;
  if (hasRunningUpload(jobs)) return KEEP_UPLOAD_OPEN_TEXT;
  return null;
}

/**
 * A `beforeunload` handler that makes the browser ask before the tab is closed
 * or reloaded, only while an analysis or an upload runs. It reads the jobs when the event
 * fires, so it never needs re-attaching.
 */
export function closeWarningHandler(getJobs: () => readonly Job[]): (event: BeforeUnloadEvent) => void {
  return (event) => {
    const jobs = getJobs();
    if (!hasRunningAnalysis(jobs) && !hasRunningUpload(jobs)) return;
    event.preventDefault();
    // Older browsers need a return value to show the prompt.
    event.returnValue = '';
  };
}
