import type { InputField, LatestCorrection } from '@/types';
import { formatDisplayValue } from './format';
import { hasValue, selectedSpec } from './rowState';

export type { LatestCorrection };

/**
 * Corrections as the backend reports them (contract items 3, 4 and 6).
 *
 * The badges come from `latest_correction` of the reloaded project, so what
 * the screen shows is the backend's state, never a selection rebuilt from the
 * stream's `final_specs`. The only transient facts are the per-parameter
 * `error` events of the run, which the backend records no outcome for.
 */

/** One entry of `correction_outcomes` on the terminal `complete` event. */
export interface CorrectionOutcomeEvent {
  parameter: string;
  project_parameter_id?: string;
  outcome: 'new_value' | 'confirmed' | 'no_new_value' | (string & {});
  correction_id?: string;
  previous_candidate_id?: string | null;
  new_candidate_id?: string | null;
}

/** What the last correction run reported, kept per project until the next run. */
export interface CorrectionReport {
  outcomes: CorrectionOutcomeEvent[];
  /** Parameter key -> the backend's message, for parameters that failed. */
  errors: Record<string, string>;
  /** "3 corrected, 1 confirmed, 1 nothing new"; null when there is nothing to say. */
  summary: string | null;
}

export const REVERT_CONFLICT_TEXT = "This value was changed after the correction, so it can't be reverted automatically.";
export const REVERT_UNAVAILABLE_TEXT = 'This value has no correction that can be reverted.';

/** Contract item 6: new_value, not reverted, and the selection is still the new candidate. */
export function canRevertCorrection(field: InputField): boolean {
  const c = field.latestCorrection;
  if (!c || c.outcome !== 'new_value' || c.reverted_at) return false;
  const selected = field.specifications.find((s) => s.id === field.selectedSpecId);
  return !!c.new_candidate_id && selected?.candidateId === c.new_candidate_id;
}

/** The candidate a correction replaced, while that correction has not been reverted. */
export function supersededCandidateId(field: InputField): string | null {
  const c = field.latestCorrection;
  return c && c.outcome === 'new_value' && !c.reverted_at ? c.previous_candidate_id : null;
}

export interface CorrectionBadge {
  kind: 'corrected' | 'confirmed' | 'none' | 'error';
  text: string;
  revertable: boolean;
}

export function correctionBadge(field: InputField, error?: string | null): CorrectionBadge | null {
  if (error) return { kind: 'error', text: `Retry failed: ${error}`, revertable: false };
  const c = field.latestCorrection;
  if (!c || c.reverted_at) return null;
  switch (c.outcome) {
    case 'new_value': {
      const was = c.previous_value !== null && c.previous_value !== undefined && String(c.previous_value) !== ''
        ? ` · was ${[formatDisplayValue(c.previous_value), c.previous_unit].filter(Boolean).join(' ')}`
        : '';
      return { kind: 'corrected', text: `Corrected${was}`, revertable: canRevertCorrection(field) };
    }
    case 'confirmed':
      return { kind: 'confirmed', text: 'AI confirmed the same value', revertable: false };
    case 'no_new_value':
      return { kind: 'none', text: 'No new value found', revertable: false };
    default:
      return null;
  }
}

/** "3 corrected, 1 confirmed, 1 nothing new", zero counts left out; null when empty. */
export function summarizeOutcomes(outcomes: readonly CorrectionOutcomeEvent[], failed: number): string | null {
  const count = (kind: string) => outcomes.filter((o) => o.outcome === kind).length;
  const parts = [
    [count('new_value'), 'corrected'],
    [count('confirmed'), 'confirmed'],
    [count('no_new_value'), 'nothing new'],
    [failed, 'failed'],
  ] as const;
  const text = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(', ');
  return text || null;
}

export function buildCorrectionReport(outcomes: readonly CorrectionOutcomeEvent[], errors: Record<string, string>): CorrectionReport {
  return { outcomes: [...outcomes], errors: { ...errors }, summary: summarizeOutcomes(outcomes, Object.keys(errors).length) };
}

export interface RowActions {
  edit: boolean;
  retry: boolean;
  pick: boolean;
  revert: boolean;
}

/**
 * Which per-row actions exist for this row. An action that cannot work is not
 * offered at all (hidden, not greyed out): Retry needs a candidate to flag and
 * no correction already running, Pick needs a second candidate with a value,
 * Revert follows `canRevertCorrection`. A busy row offers nothing.
 */
export function availableRowActions(field: InputField, state: { busy: boolean; correcting: boolean }): RowActions {
  if (state.busy) return { edit: false, retry: false, pick: false, revert: false };
  const selected = selectedSpec(field);
  const alternatives = field.specifications.filter((s) => s.id !== field.selectedSpecId && s.candidateId && hasValue(s));
  return {
    edit: true,
    retry: !state.correcting && !!selected?.candidateId,
    pick: alternatives.length > 0,
    revert: canRevertCorrection(field),
  };
}

/** Toolbar button for the batch correction (requirement F). */
export function retryFlaggedButton(flagged: number): { label: string; disabled: boolean; tooltip: string } {
  return {
    label: `Retry flagged values (${flagged})`,
    disabled: flagged === 0,
    tooltip:
      flagged === 0
        ? 'Flag the values that look wrong first. Then this button asks the AI to look at them again.'
        : `${flagged} flagged value${flagged === 1 ? '' : 's'} will be sent back to the AI. Other values are not changed.`,
  };
}
