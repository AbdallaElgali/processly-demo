import type { InputField } from '@/types';
import { rowState } from '@/lib/review/rowState';

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
 *   empty    -- no value: never extracted, or a reason-code row (CLAUDE.md 7)
 *   accepted -- `review_action === 'ACCEPTED'` (Approve, or a saved Accept)
 *   pending  -- has a value, not accepted yet (includes edited rows)
 */
export interface ReviewProgress {
  total: number;
  accepted: number;
  pending: number;
  flagged: number;
  empty: number;
  /** Auto-flags (out of bounds) among the parameters: a warning, not a bucket (approval.ts). */
  outOfBounds: number;
}

export function reviewProgress(fields: readonly InputField[]): ReviewProgress {
  const progress: ReviewProgress = { total: fields.length, accepted: 0, pending: 0, flagged: 0, empty: 0, outOfBounds: 0 };
  for (const field of fields) {
    const state = rowState(field);
    if (state.primary === 'bounds' || state.secondary.includes('bounds')) progress.outOfBounds += 1;
    if (field.isFlagged) progress.flagged += 1;
    else if (state.primary === 'empty' || state.primary === 'no_run') progress.empty += 1;
    else if (field.reviewAction === 'ACCEPTED') progress.accepted += 1;
    else progress.pending += 1;
  }
  return progress;
}

/** Share of parameters accepted, 0-100, rounded down so 100 means all of them. */
export function acceptedPercent(progress: ReviewProgress): number {
  return progress.total === 0 ? 0 : Math.floor((progress.accepted / progress.total) * 100);
}
