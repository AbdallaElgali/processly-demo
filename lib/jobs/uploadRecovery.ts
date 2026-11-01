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
export const UNKNOWN_TEXT = 'We could not check whether the upload finished. Look at the document list; if a file is missing, add it again with Add documents';

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

const fileList = (names: readonly string[]) =>
  names.length === 0 ? 'The file' : names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;

/**
 * Files not listed yet are not known to be lost: the server lists a document
 * only once it is fully processed, which can take longer than the check waits.
 */
export function notSavedText(missing: readonly string[]): string {
  const plural = missing.length > 1;
  return `The upload of ${fileList(missing)} stopped before it finished, or ${plural ? 'the files are' : 'the file is'} still being processed. Check the document list in a minute; if ${plural ? 'they are' : 'it is'} still missing, add ${plural ? 'them' : 'it'} again with Add documents.`;
}

/** The one line an interrupted upload shows, from the state of its check. */
export function interruptedUploadText(check: UploadCheck | undefined): string {
  if (!check || check.state === 'checking') return CHECKING_TEXT;
  if (check.state === 'unknown') return UNKNOWN_TEXT;
  if (check.saved === 0) return notSavedText(check.missing);
  return `${check.saved} ${check.saved === 1 ? 'file was' : 'files were'} saved; ${notSavedText(check.missing)}`;
}
