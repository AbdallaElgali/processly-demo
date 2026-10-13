import { config } from './config';

/** Result of `GET /documents/{doc_id}/file` (D7). */
export type DocumentFileResult =
  | { kind: 'ok'; blob: Blob }
  /**
   * 404 or 410: the backend has no file for this document. It answers 404 both
   * for missing metadata and for a cleaned-up file (Task B item B7); RFC §5 P1
   * proposes 410 for the latter. Both mean "source unavailable, values
   * preserved".
   */
  | { kind: 'unavailable'; status: number };

/**
 * Fetches one document's original file. Throws on network errors and on any
 * other non-2xx status, which the caller shows as a retryable error rather
 * than as "unavailable".
 */
export async function fetchDocumentFile(docId: string, signal?: AbortSignal): Promise<DocumentFileResult> {
  // `no-store`: a file must never come from another user's cached response.
  const res = await fetch(`${config.api}/documents/${encodeURIComponent(docId)}/file`, { signal, cache: 'no-store' });
  if (res.status === 404 || res.status === 410) return { kind: 'unavailable', status: res.status };
  if (!res.ok) throw new Error(`The document could not be loaded (HTTP ${res.status}).`);
  return { kind: 'ok', blob: await res.blob() };
}
