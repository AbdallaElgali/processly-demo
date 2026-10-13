import type { InputField, Specification } from '@/types';
import { isHighConfidence } from './confidence';
import { matchReasonCode, type ReasonCodeInfo } from './reasonCodes';
import { newerCandidateAvailable } from './newer';

/**
 * Row-state precedence (AM1). Every parameter row shows exactly ONE primary
 * state (RFC 4.1); anything else that is also true is a secondary indicator.
 *
 *   1. Human flag
 *   2. Auto-flag "Bounds"       -- rule_violations on the selected candidate, ONLY
 *   3. Empty with reason / No run yet
 *   4. Human-modified
 *   5. Low confidence / Needs review
 *   6. High confidence
 *
 * `requires_review` alone is NOT an auto-flag: the backend's gap-fill pass sets
 * it on every empty reason-code row, and the Supervisor sets it on uncertain
 * values that are within bounds. Treating it as "Bounds" would label every
 * empty parameter as out of bounds (AM1's problem statement).
 */
export type PrimaryState =
  | 'human_flag'
  | 'bounds'
  | 'empty'
  | 'no_run'
  | 'modified'
  | 'needs_review'
  | 'high';

export type SecondaryFact = 'bounds' | 'modified' | 'low_confidence' | 'needs_review' | 'accepted' | 'newer_candidate';

export interface RowState {
  primary: PrimaryState;
  /** Facts that also hold, never repeating the primary. */
  secondary: SecondaryFact[];
  /** For `empty`: the matched reason code, or null when the text is not one of the four. */
  reason: ReasonCodeInfo | null;
  /** For `needs_review`: whether it is low confidence, the Supervisor's flag, or both. */
  lowConfidence: boolean;
  supervisorReview: boolean;
  selected: Specification | undefined;
}

export function selectedSpec(field: InputField): Specification | undefined {
  return field.specifications.find((s) => s.id === field.selectedSpecId) ?? field.specifications[0];
}

export function hasValue(spec: Specification | undefined): boolean {
  return !!spec && spec.value !== null && spec.value !== undefined && String(spec.value).trim() !== '';
}

export function rowState(field: InputField): RowState {
  const selected = selectedSpec(field);
  const valued = hasValue(selected);
  const modified = field.reviewAction === 'MODIFIED';
  const bounds = (selected?.rule_violations?.length ?? 0) > 0;
  // A human-entered value has no confidence; that is not "low".
  const isAiValue = !!selected?.candidateId;
  const lowConfidence = valued && isAiValue && !isHighConfidence(selected?.confidence);
  const supervisorReview = valued && !!selected?.requires_review;

  let primary: PrimaryState;
  if (field.isFlagged) primary = 'human_flag';
  else if (bounds) primary = 'bounds';
  else if (field.specifications.length === 0) primary = 'no_run';
  else if (!valued) primary = 'empty';
  else if (modified) primary = 'modified';
  else if (lowConfidence || supervisorReview) primary = 'needs_review';
  else primary = 'high';

  const secondary: SecondaryFact[] = [];
  if (bounds && primary !== 'bounds') secondary.push('bounds');
  if (modified && primary !== 'modified') secondary.push('modified');
  if (primary !== 'needs_review' && !modified) {
    if (lowConfidence) secondary.push('low_confidence');
    else if (supervisorReview) secondary.push('needs_review');
  }
  if (field.reviewAction === 'ACCEPTED') secondary.push('accepted');
  if (newerCandidateAvailable(field)) secondary.push('newer_candidate');

  return {
    primary,
    secondary,
    // requires_review is ignored for empty rows (AM1); only the text matters.
    reason: primary === 'empty' ? matchReasonCode(selected?.extractionLogic) : null,
    lowConfidence,
    supervisorReview,
    selected,
  };
}

/**
 * Sort order for "Needs review first" (RFC 4.1: low confidence sorted to the
 * top of the queue). Distinct from display precedence: an empty row is shown
 * as empty, but sorts after the rows that have a doubtful value to check.
 */
const REVIEW_ORDER: Record<PrimaryState, number> = {
  human_flag: 0,
  bounds: 1,
  needs_review: 2,
  empty: 3,
  no_run: 4,
  modified: 5,
  high: 6,
};

export function reviewOrder(state: PrimaryState): number {
  return REVIEW_ORDER[state];
}
