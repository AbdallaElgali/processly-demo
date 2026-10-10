import { flagParameter, unFlagParameter, updateResolvedBy } from '@/api/parameters';

/**
 * Raising and clearing a human flag (contract fix H1).
 *
 * The bug this replaces: `AIFlagRequest.ai_metric_candidate_id` is required,
 * but the old `handleFlag` passed `activeSpec?.candidateId ?? null` and wrapped
 * the call in a `catch` that only logged. For a parameter with no AI candidate
 * every flag produced a 422 and was silently discarded; the row looked flagged
 * until the next reload.
 *
 * Why there is no fallback for the no-candidate case
 * --------------------------------------------------
 * A flag is a row in `ai_parameter_flags`, and that table requires BOTH a
 * candidate and an extraction run:
 *
 *   ai_metric_candidate_id uuid NOT NULL
 *   extraction_run_id      uuid NOT NULL
 *
 * `project_parameters` has no `human_flagged` column at all -- the field the
 * API returns is derived from a LATERAL join on open flags. And
 * `save_project_parameters_batch_db` writes only final_value, final_unit,
 * is_human_modified, selected_candidate_id and review_action: it accepts the
 * `flag` fields in its request schema and then ignores them.
 *
 * So a parameter that has never been extracted CANNOT be flagged by any route
 * the backend exposes today. Rather than fail silently, this refuses with an
 * explanation the reviewer can act on. Lifting the restriction is a backend
 * change, recorded for Task B.
 */
export class FlagNotSupportedError extends Error {
  constructor() {
    super(
      'This parameter has no extracted value yet, so there is nothing to flag. ' +
        'Run an analysis first, then flag the value it produces.',
    );
    this.name = 'FlagNotSupportedError';
  }
}

export interface RaiseFlagInput {
  /** project_parameters.id */
  projectParameterId: string;
  userId: string;
  /** The selected candidate. Null means the parameter has never been extracted. */
  candidateId: string | null;
  /** Chains onto an existing flag when re-flagging. */
  parentFlagId: string | null;
  reason: string;
}

export interface RaiseFlagResult {
  flagId: string;
}

export async function raiseHumanFlag(input: RaiseFlagInput): Promise<RaiseFlagResult> {
  if (!input.candidateId) throw new FlagNotSupportedError();

  const flagId = await flagParameter(
    input.userId,
    input.projectParameterId,
    input.candidateId,
    input.parentFlagId,
    input.reason,
  );
  return { flagId };
}

/**
 * Resolves the flag ticket. With no ticket there is nothing to clear, which is
 * a legitimate no-op: without a ticket the parameter was never flagged in the
 * backend's eyes either.
 */
export async function clearHumanFlag(activeFlagId: string | null): Promise<void> {
  if (!activeFlagId) return;
  await unFlagParameter(activeFlagId, null, 'DISMISSED');
}

/**
 * Closes the flag because the reviewer accepted a value: status RESOLVED,
 * resolved by the chosen candidate. `candidateId` is null for a value a
 * person typed; the flag is still resolved, just without a resolving
 * candidate. The backend closes every OPEN flag of the parameter, chained
 * ones included.
 *
 * Why two calls (found in step 10, candidate B16): `ai-unflag-parameter`
 * with a `resolved_by` always fails. Its second query selects
 * `extraction_run_id` and the loop then reads `['id']` from that row
 * (`BDA/src/db/ai_parameters.py`, `unflag_ai_parameter_db`), a KeyError that
 * rolls the whole transaction back and leaves the flag OPEN. So the
 * resolving candidate is recorded through `select-correct-ai-candidate`,
 * and the flag is then closed through the branch without `resolved_by`,
 * which works. Lost until B16 is fixed: `resolved_at_run_id`.
 */
export async function resolveHumanFlag(activeFlagId: string, candidateId: string | null): Promise<void> {
  if (candidateId) await updateResolvedBy(activeFlagId, candidateId);
  await unFlagParameter(activeFlagId, null, 'RESOLVED');
}
