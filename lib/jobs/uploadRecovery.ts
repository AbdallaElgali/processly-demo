import type { UploadCheck } from './types';

/**
 * What happened to an upload whose tab went away (backend U1).
 *
 * A fully sent upload keeps running on the server and is saved; a document is
 * listed only once it is fully processed. So "interrupted" is settled by
 * asking the project which of the job's files it now holds, not by assuming
 * nothing was saved. (Extraction and correction streams are different: they
 * really stop with the tab, and keep their own message.)
 */

export const CHECKING_TEXT = 'Checking whether the server finished…';
export const SAVED_AWAY_TEXT = 'Saved while you were away';
export const NOT_SAVED_TEXT = 'Not saved. Upload again';
export const UNKNOWN_TEXT = 'Could not check whether the server finished. Open the project again to see its documents';

/** First check at once, then every interval: 5 waits of 12 s is about 60 s. */
export const RECOVERY_ATTEMPTS = 6;
export const RECOVERY_INTERVAL_MS = 12_000;

/** Splits files by whether the project already lists a document of that name (`documents.name` is the uploaded file name). */
export function splitByDocuments<T extends { name: string }>(
  items: readonly T[],
  docs: readonly { name: string }[],
): { saved: T[]; missing: T[] } {
  const listed = new Set(docs.map((d) => d.name));
  const saved: T[] = [];
  const missing: T[] = [];
  for (const item of items) (listed.has(item.name) ? saved : missing).push(item);
  return { saved, missing };
}

export interface UploadOutcome {
  saved: string[];
  missing: string[];
  /** False when the project could never be read, so "missing" means "unknown". */
  checked: boolean;
}

/**
 * Asks the project for its documents until every file is listed or the attempts
 * run out. A failed read counts as an attempt; it does not end the check.
 */
export async function checkUploadOutcome(opts: {
  names: readonly string[];
  fetchDocuments: () => Promise<readonly { name: string }[]>;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  intervalMs?: number;
  signal?: AbortSignal;
}): Promise<UploadOutcome> {
  const { names, fetchDocuments, signal } = opts;
  const attempts = opts.attempts ?? RECOVERY_ATTEMPTS;
  const intervalMs = opts.intervalMs ?? RECOVERY_INTERVAL_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let outcome: UploadOutcome = { saved: [], missing: [...names], checked: false };
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(intervalMs);
    try {
      const docs = await fetchDocuments();
      const { saved, missing } = splitByDocuments(names.map((name) => ({ name })), docs);
      outcome = { saved: saved.map((f) => f.name), missing: missing.map((f) => f.name), checked: true };
      if (outcome.missing.length === 0) break;
    } catch {
      /* try again on the next round */
    }
    if (signal?.aborted) break;
  }
  return outcome;
}

/** The one line an interrupted upload shows, from the state of its check. */
export function interruptedUploadText(check: UploadCheck | undefined): string {
  if (!check || check.state === 'checking') return CHECKING_TEXT;
  if (check.state === 'unknown') return UNKNOWN_TEXT;
  if (check.saved === 0) return NOT_SAVED_TEXT;
  return `${check.saved} ${check.saved === 1 ? 'file' : 'files'} saved while you were away; ${check.missing.length} not saved. Upload again`;
}

/** What "Run again" tells the person about what it will send. */
export function resendNotice(saved: number, missing: number): string {
  if (missing === 0) return 'All files are already in the project; nothing to re-send.';
  const files = missing === 1 ? 'file that is' : 'files that are';
  return `Re-sending ${missing} ${files} not in the project${saved > 0 ? `; ${saved} already saved` : ''}.`;
}
