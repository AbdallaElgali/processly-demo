import type { InputField } from '@/types';
import { rowState } from '@/lib/review/rowState';
import { isPendingReview } from '@/lib/review/approval';

/**
 * Review progress for the Overview (step 12), separate from the project's
 * status because **Approve does not change `projects.status`** (backend item
 * B10: it flips every PENDING parameter to ACCEPTED and leaves the project at
 * NEW). The status chip says where the project is in its lifecycle as someone
 * set it; this says how much of the review is done.
 *
 * Every parameter lands in exactly one bucket, so the four numbers add up to
 * `total`. Precedence, most urgent first:
 *   flagged  -- an open human flag (the colleague's objection is unresolved)
 *   pending  -- `review_action` is PENDING (`isPendingReview`, the rule
 *               Approve uses), **with or without a value** (F0c: an empty row
 *               nobody has decided on still needs a review)
 *   empty    -- no value, and someone has already decided (ACCEPTED,
 *               MODIFIED or REJECTED): never extracted or a reason-code row
 *               (CLAUDE.md 7)
 *   reviewed -- has a value and a person has decided: ACCEPTED, MODIFIED or
 *               REJECTED
 */
export interface ReviewProgress {
  total: number;
  reviewed: number;
  pending: number;
  flagged: number;
  empty: number;
  /** Auto-flags (out of bounds) among the parameters: a warning, not a bucket (approval.ts). */
  outOfBounds: number;
}

export function reviewProgress(fields: readonly InputField[]): ReviewProgress {
  const progress: ReviewProgress = { total: fields.length, reviewed: 0, pending: 0, flagged: 0, empty: 0, outOfBounds: 0 };
  for (const field of fields) {
    const state = rowState(field);
    if (state.primary === 'bounds' || state.secondary.includes('bounds')) progress.outOfBounds += 1;
    if (field.isFlagged) progress.flagged += 1;
    else if (isPendingReview(field)) progress.pending += 1;
    else if (state.primary === 'empty' || state.primary === 'no_run') progress.empty += 1;
    else progress.reviewed += 1;
  }
  return progress;
}

/** Share of parameters reviewed, 0-100, rounded down so 100 means all of them. */
export function reviewedPercent(progress: ReviewProgress): number {
  return progress.total === 0 ? 0 : Math.floor((progress.reviewed / progress.total) * 100);
}
