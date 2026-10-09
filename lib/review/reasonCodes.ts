/**
 * The four "no value" reason codes (AM6), copied EXACTLY from
 * BDA/src/engine/reason_codes.py. Keep the two in step: the backend writes one
 * of these into `extraction_logic` on a null-valued candidate, and this module
 * is the only place the frontend matches them.
 *
 * Stopgap until the backend returns an explicit reason-code field (Task B, B5).
 */

export const REASON_NOT_SEARCHED_NO_TAG =
  'not searched: no document frame was tagged with this parameter, so no worker looked for it';
export const REASON_NOT_SEARCHED_CAP_REACHED = 'not searched: cap reached';
export const REASON_SEARCHED_ABSENT =
  'searched, absent: worker(s) searched the tagged source frame(s) for this parameter ' +
  'and found no matching value';
export const REASON_CATEGORY_WORKERS_FAILED =
  'category workers failed: this parameter was assigned to a worker, but every worker in its ' +
  'category failed, so no Supervisor could run for it';

export type ReasonCode = 'not_searched_no_tag' | 'not_searched_cap' | 'searched_absent' | 'workers_failed';

export interface ReasonCodeInfo {
  code: ReasonCode;
  /** Short chip label. */
  label: string;
  /** The backend's full sentence, for the tooltip. */
  text: string;
  /**
   * What is matched. The backend promises the part before the first colon is
   * stable, but two codes share "not searched", so the match also includes the
   * start of the detail that tells them apart.
   */
  prefix: string;
}

export const REASON_CODES: readonly ReasonCodeInfo[] = [
  {
    code: 'not_searched_no_tag',
    label: 'Not searched: no frame',
    text: REASON_NOT_SEARCHED_NO_TAG,
    prefix: 'not searched: no document frame',
  },
  {
    code: 'not_searched_cap',
    label: 'Not searched: cap reached',
    text: REASON_NOT_SEARCHED_CAP_REACHED,
    prefix: 'not searched: cap reached',
  },
  {
    code: 'searched_absent',
    label: 'Searched, absent',
    text: REASON_SEARCHED_ABSENT,
    prefix: 'searched, absent',
  },
  {
    code: 'workers_failed',
    label: 'Category workers failed',
    text: REASON_CATEGORY_WORKERS_FAILED,
    prefix: 'category workers failed',
  },
];

/**
 * Prefix match against the constants above, and nothing else (AM6): no
 * substring search, so a rationale that merely mentions "absent" is not
 * mistaken for a reason code. Case and leading whitespace are tolerated.
 */
export function matchReasonCode(text: string | null | undefined): ReasonCodeInfo | null {
  if (!text) return null;
  const normalized = text.trimStart().toLowerCase();
  return REASON_CODES.find((r) => normalized.startsWith(r.prefix)) ?? null;
}
