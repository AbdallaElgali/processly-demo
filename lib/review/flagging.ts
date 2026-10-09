import { flagParameter, unFlagParameter } from '@/api/parameters';
import { apiSaveProjectParameters, type ParameterInput } from '@/api/projects';

/**
 * Raising a human flag (contract fix H1).
 *
 * The bug this replaces: `AIFlagRequest.ai_metric_candidate_id` is a REQUIRED
 * string on the backend, but the old `handleFlag` passed
 * `activeSpec?.candidateId ?? null` and wrapped the call in a `catch` that only
 * logged. For a human-entered value -- a parameter with no AI candidate --
 * every flag produced a 422 and was silently discarded. The row looked flagged
 * until the next reload.
 *
 * Two paths, chosen by whether a candidate exists:
 *
 *   candidate present -> POST /flagging/ai-flag-parameter, which opens a real
 *     ai_parameter_flags ticket and returns its id. That id is what lets a
 *     later correction chain onto this flag via `parent_flag_id`.
 *
 *   no candidate -> there is nothing to attach a ticket to, so the flag is
 *     persisted on the parameter row itself through
 *     PUT /projects/{id}/parameters, which accepts inline flag/flag_reason/
 *     flagger_id. The flag survives a reload; it simply has no ticket, so no
 *     chain depth and no correction target. That is the honest representation
 *     of the backend's model, not a workaround.
 *
 * Neither path swallows a failure: callers surface it.
 */
export interface RaiseFlagInput {
  projectId: string;
  userId: string;
  /** project_parameters.id */
  projectParameterId: string;
  /** The selected candidate, or null for a human-entered value. */
  candidateId: string | null;
  /** Chains onto an existing flag when re-flagging. */
  parentFlagId: string | null;
  reason: string;
  /**
   * The parameter row as it should be saved on the no-candidate path. Built by
   * `inputFieldToParameterInput`; its `flag` fields are overwritten here so a
   * caller cannot accidentally save an unflagged row.
   */
  fallbackRow: ParameterInput;
}

export interface RaiseFlagResult {
  /** The ticket id, or null when the flag lives only on the parameter row. */
  flagId: string | null;
  path: 'ticket' | 'parameter-row';
}

export async function raiseHumanFlag(input: RaiseFlagInput): Promise<RaiseFlagResult> {
  if (input.candidateId) {
    const flagId = await flagParameter(
      input.userId,
      input.projectParameterId,
      input.candidateId,
      input.parentFlagId,
      input.reason,
    );
    return { flagId, path: 'ticket' };
  }

  await apiSaveProjectParameters(input.projectId, [
    {
      ...input.fallbackRow,
      flag: true,
      flag_reason: input.reason,
      flagger_id: input.userId,
    },
  ]);
  return { flagId: null, path: 'parameter-row' };
}

export interface ClearFlagInput {
  projectId: string;
  /** The ticket to resolve, or null when the flag lives on the parameter row. */
  activeFlagId: string | null;
  fallbackRow: ParameterInput;
}

/** Mirror of raiseHumanFlag: clears whichever representation was used. */
export async function clearHumanFlag(input: ClearFlagInput): Promise<void> {
  if (input.activeFlagId) {
    await unFlagParameter(input.activeFlagId, null, 'DISMISSED');
    return;
  }

  await apiSaveProjectParameters(input.projectId, [
    { ...input.fallbackRow, flag: false, flag_reason: null, flagger_id: null },
  ]);
}
