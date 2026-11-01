import type { Job } from './types';

/**
 * What the server says about a run whose tab went away.
 *
 * An extraction or correction is saved only when its stream reaches
 * `complete` (D9), and the `extraction_runs` row is created in that same save.
 * So a run that exists and is newer than the job proves the job finished,
 * even if the tab died a moment before it could say so.
 */

/** Browser and server clocks may differ a little; a run counts if it is no older than this before the job's start. */
const CLOCK_SLACK_MS = 5_000;

interface RunLike {
  extraction_type: string;
  created_at: string | null;
}

/** The run type the backend writes for each kind of job. */
function runTypeOf(job: Job): string {
  if (job.payload.kind === 'correction') return 'SINGLE_PARAM';
  if (job.payload.kind === 'extraction' && job.payload.previousSpecs) return 'ITERATIVE';
  return 'MAIN_MULTI_AGENT';
}

/** The backend sends naive datetimes (UTC). Without a zone, `Date.parse` would read them as local time. */
function parseServerTime(value: string): number {
  return Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`);
}

export function runSavedSince(runs: readonly RunLike[], job: Job): boolean {
  if (job.startedAt === undefined) return false;
  const type = runTypeOf(job);
  return runs.some((run) => {
    if (run.extraction_type !== type || !run.created_at) return false;
    const at = parseServerTime(run.created_at);
    return Number.isFinite(at) && at >= job.startedAt! - CLOCK_SLACK_MS;
  });
}

/**
 * Of the jobs a scheduler pass thinks are dead, those the shared record still
 * shows as running. The owner may have finished and published between the
 * pass reading the record and asking which locks are held.
 */
export function stillRunning(candidates: readonly Job[], fresh: readonly Job[]): Job[] {
  const running = new Set(fresh.filter((job) => job.status === 'running').map((job) => job.id));
  return candidates.filter((job) => running.has(job.id));
}

const KIND_NOUN: Record<string, string> = { extraction: 'analysis', correction: 're-extraction' };

/** What an interrupted extraction or correction shows: what happened, and what to do. */
export function interruptedRunText(job: Job): string {
  const noun = KIND_NOUN[job.kind] ?? 'run';
  if (job.runCheck === 'unknown') {
    return `The ${noun} may have stopped when this page was closed or reloaded, and we could not check with the server. Open Runs to see whether it was saved, or run it again.`;
  }
  return `The ${noun} stopped before it finished because this page was closed or reloaded. Nothing was saved. Run it again.`;
}
