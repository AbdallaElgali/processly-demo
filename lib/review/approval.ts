import type { InputField } from '@/types';
import { rowState } from './rowState';

/**
 * What stands between a project and Approve.
 *
 * - **Open flags no longer block on the client.** The backend decides: Approve
 *   answers 409 with the open flags, and the UI offers "Approve and resolve N
 *   flags" (lib/approvals). `openFlags` is still counted for the dialog.
 * - A running or queued extraction or correction blocks: it will write
 *   parameters (and a correction opens a new chained flag) after the approval.
 * - **Auto-flags** ("Bounds") only warn: the machine's doubt is shown in the
 *   confirmation, and the engineer may approve over it.
 * - Unsaved edits are saved first ("Save and approve"), so what is approved
 *   is what the table shows.
 */
/**
 * The backend stores `review_action` per row and keeps a human-touched row
 * through re-extraction (B15 + R1). While this was false, every save wrote
 * PENDING and the UI had to work around it; the workarounds are gone, and the
 * switch records that the frontend now depends on the stored state.
 */
export const REVIEW_STATE_PERSISTED = true;

/**
 * The one rule for "still to be reviewed": the stored `review_action` is
 * PENDING. ACCEPTED, MODIFIED and REJECTED are a person's decision. Approve's
 * gate and the Overview's review progress both read this, so they cannot
 * disagree.
 */
export function isPendingReview(field: Pick<InputField, 'reviewAction'>): boolean {
  return field.reviewAction === 'PENDING';
}

export interface ApprovalCheck {
  openFlags: string[];
  bounds: string[];
  empty: string[];
  needsReview: string[];
  unsaved: number;
  jobBusy: boolean;
  /**
   * Rows Approve will accept: the ones whose review_action is PENDING. Approve
   * flips only those; an edited (MODIFIED) row is already a person's decision
   * and stays as it is, so it is not counted.
   */
  pending: number;
  /** The project changed after its latest approval, so Approve is a re-approval even with nothing pending. */
  changedSinceApproval: boolean;
}

export function approvalCheck(
  fields: InputField[],
  opts: { unsaved: number; jobBusy: boolean; changedSinceApproval?: boolean },
): ApprovalCheck {
  const check: ApprovalCheck = { openFlags: [], bounds: [], empty: [], needsReview: [], unsaved: opts.unsaved, jobBusy: opts.jobBusy, pending: 0, changedSinceApproval: !!opts.changedSinceApproval };
  for (const f of fields) {
    if (isPendingReview(f)) check.pending += 1;
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
  if (check.jobBusy) return 'Wait for the running analysis or re-extraction to finish.';
  // Open flags are resolved by Approve, and a changed project is re-approved: neither needs a pending row.
  if (check.pending === 0 && check.openFlags.length === 0 && !check.changedSinceApproval) {
    return 'Nothing is pending: every parameter is already accepted, edited or rejected.';
  }
  return null;
}
