import type { Job } from './types';

const PHASE_LABEL: Record<string, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  routing: 'Routing sections',
  routed: 'Sections routed',
  extracting: 'Extracting',
  supervising: 'Checking results',
  done: 'Done',
  failed: 'Failed',
};

const KIND: Record<string, string> = { upload: 'Upload', extraction: 'Extraction', correction: 'Correction' };

export const jobKindLabel = (kind: string) => KIND[kind] ?? kind;

/**
 * The running job as one line of text. A correction starts in the `routing`
 * phase (the job's initial phase) but never routes: until its first event it
 * reads "Re-extracting KEY…" instead of "Routing sections".
 */
export function runningJobText(job: Pick<Job, 'kind' | 'phase' | 'payload'>): string {
  if (job.payload.kind === 'correction') {
    const label = `Re-extracting ${job.payload.parameterKey}`;
    if (job.phase === 'routing' || job.phase === 'queued') return `${label}…`;
    return `${label}: ${PHASE_LABEL[job.phase] ?? job.phase}`;
  }
  return `${KIND[job.kind] ?? job.kind}: ${PHASE_LABEL[job.phase] ?? job.phase}`;
}

/** A failed job as one line: its real error text when there is one. */
export function failedJobText(job: Pick<Job, 'kind' | 'error'>): string {
  const error = job.error?.trim();
  return error ? `${jobKindLabel(job.kind)} failed: ${error}` : `${jobKindLabel(job.kind)} failed`;
}

/** What to do next after a failure; an upload is never re-run by the app. */
export function failedJobHint(job: Pick<Job, 'kind'>): string | null {
  return job.kind === 'upload' ? 'Add the file again with Add documents.' : null;
}
