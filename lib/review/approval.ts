import type { InputField } from '@/types';
import { rowState } from './rowState';

/**
 * What stands between a project and Approve (plan-A 6.4, step 10).
 *
 * - An open **human** flag blocks: a colleague disputed the value, and
 *   approving would accept it over their objection. The reviewer accepts a
 *   value (which resolves the flag) or removes the flag first.
 * - A running or queued extraction or correction blocks: it will write
 *   parameters (and a correction opens a new chained flag) after the approval.
 * - **Auto-flags** ("Bounds") only warn: the machine's doubt is shown in the
 *   confirmation, and the engineer may approve over it.
 * - Unsaved edits are saved first ("Save and approve"), so what is approved
 *   is what the table shows.
 */
export interface ApprovalCheck {
  openFlags: string[];
  bounds: string[];
  empty: string[];
  needsReview: string[];
  unsaved: number;
  jobBusy: boolean;
  /**
   * Rows Approve will accept: not yet ACCEPTED, plus unsaved rows (the save
   * before approving writes them back as PENDING, B15).
   */
  pending: number;
}

export function approvalCheck(
  fields: InputField[],
  opts: { unsaved: number; jobBusy: boolean; dirty?: readonly string[] },
): ApprovalCheck {
  const check: ApprovalCheck = { openFlags: [], bounds: [], empty: [], needsReview: [], unsaved: opts.unsaved, jobBusy: opts.jobBusy, pending: 0 };
  for (const f of fields) {
    if (f.reviewAction !== 'ACCEPTED' || opts.dirty?.includes(f.id)) check.pending += 1;
    const st = rowState(f);
    if (f.isFlagged) check.openFlags.push(f.id);
    if (st.primary === 'bounds' || st.secondary.includes('bounds')) check.bounds.push(f.id);
    if (st.primary === 'empty' || st.primary === 'no_run') check.empty.push(f.id);
    if (st.primary === 'needs_review') check.needsReview.push(f.id);
  }
  return check;
}

/** Why Approve is disabled, or null when it is allowed. */
export function approveBlockReason(check: ApprovalCheck): string | null {
  if (check.openFlags.length > 0) {
    const n = check.openFlags.length;
    return `${n} open flag${n === 1 ? '' : 's'} (${check.openFlags.join(', ')}). Accept a value or remove the flag first.`;
  }
  if (check.jobBusy) return 'Wait for the running analysis or re-extraction to finish.';
  if (check.pending === 0) return 'Every parameter is already approved.';
  return null;
}
