import { toast } from '@/components/ui/Toast';
import { RevertCorrectionError, revertCorrection, updateResolvedBy } from '@/api/parameters';
import { projectDataStore, type RowOp } from '@/lib/project-data/store';
import { approveProject, reloadAfterRun, saveFields } from '@/lib/project-data/actions';
import { mapFieldsToSpecs } from '@/lib/parameter-adapter';
import { createJob, jobRuntime } from '@/lib/jobs/runtime';
import { jobStore } from '@/lib/jobs/store';
import type { InputField } from '@/types';
import { errorMessage } from '@/lib/errors';
import { clearHumanFlag, raiseHumanFlag, resolveHumanFlag } from './flagging';
import { acceptField, editValue, revertValue, selectCandidate } from './edits';
import { selectedSpec } from './rowState';
import { canRevertCorrection, REVERT_CONFLICT_TEXT, REVERT_UNAVAILABLE_TEXT } from './corrections';

/**
 * The human-in-the-loop actions of the Workspace (plan-A 6.4, step 10).
 *
 * Plain functions over the project-data store, keyed by projectId, not hooks:
 * a flag that is still posting when the user switches project lands in the
 * project it was raised in (the D11 rule, applied to review actions too).
 * Each backend call marks only its own row as busy (`rowOps`); nothing here
 * disables the table, the toolbar or another project (CLAUDE.md 8.1).
 *
 * What persists where (read from the backend, see the step 10 note):
 * - flag, remove flag, accept-with-flag: the /flagging routes, immediately;
 * - value, unit and chosen candidate: `PUT /projects/{id}/parameters`, on
 *   Save (or on Accept, for that row);
 * - Accept: ACCEPTED, saved for that row at once; Approve accepts every row
 *   that is still PENDING. The review state is stored (B15), so there is no
 *   session-only mark.
 */

const fieldOf = (projectId: string, key: string): InputField | undefined =>
  projectDataStore.get(projectId).fields.find((f) => f.id === key);

const message = (e: unknown) => errorMessage(e);

/** Runs `fn` with the row marked busy; refuses if the row is already busy. */
async function onRow<T>(projectId: string, key: string, op: RowOp, fn: () => Promise<T>): Promise<T | undefined> {
  if (projectDataStore.get(projectId).rowOps[key]) return undefined;
  projectDataStore.setRowOp(projectId, key, op);
  try {
    return await fn();
  } finally {
    projectDataStore.setRowOp(projectId, key, null);
  }
}

/** Parameter keys with a correction queued or running in this project. */
export function correctionsInFlight(projectId: string): Set<string> {
  const keys = new Set<string>();
  for (const j of jobStore.getJobs()) {
    if (j.projectId !== projectId || j.payload.kind !== 'correction') continue;
    if (j.status === 'queued' || j.status === 'running') keys.add(j.payload.parameterKey);
  }
  return keys;
}

// ---- local edits (saved by Save) -------------------------------------------

export function editRowValue(projectId: string, key: string, value: string, unit: string) {
  projectDataStore.updateField(projectId, key, (f) => editValue(f, value, unit), { dirty: true });
}

export function revertRowValue(projectId: string, key: string) {
  projectDataStore.updateField(projectId, key, revertValue, { dirty: true });
}

/**
 * Choose a candidate. Local until Save. When the row has an open flag, the
 * backend is also told which candidate answers it
 * (`POST /flagging/select-correct-ai-candidate`); if that fails, the choice
 * is undone so the screen never shows a state the backend did not take.
 */
export async function chooseCandidate(projectId: string, key: string, specId: string) {
  const before = fieldOf(projectId, key);
  if (!before || before.selectedSpecId === specId) return;
  projectDataStore.updateField(projectId, key, (f) => selectCandidate(f, specId), { dirty: true });

  const target = before.specifications.find((s) => s.id === specId);
  if (!before.isFlagged || !before.activeFlagId || !target?.candidateId) return;
  const flagId = before.activeFlagId;
  const candidateId = target.candidateId;
  await onRow(projectId, key, 'select', async () => {
    try {
      await updateResolvedBy(flagId, candidateId);
    } catch (e) {
      projectDataStore.updateField(projectId, key, () => before);
      toast.show(`Could not record the chosen candidate for ${key}: ${message(e)}`, { severity: 'error' });
    }
  });
}

// ---- flags (persisted at once by the /flagging routes) ---------------------

/**
 * Raise a human flag. The reason ("Hint for the AI") is optional: blank is
 * sent as null. Returns the new flag id, or null on failure.
 */
export async function flagRow(projectId: string, key: string, userId: string, reason: string = ''): Promise<string | null> {
  const field = fieldOf(projectId, key);
  const text = reason.trim();
  if (!field) return null;
  const candidateId = selectedSpec(field)?.candidateId ?? null;

  const flagId = await onRow(projectId, key, 'flag', async () => {
    try {
      const { flagId: id } = await raiseHumanFlag({
        userId,
        projectParameterId: field.dbId,
        candidateId,
        parentFlagId: field.activeFlagId ?? null,
        reason: text,
      });
      // No batch save afterwards: the flag route stores the flag, and the
      // batch save ignores flag fields (B9). The old "persist on flag" saved
      // every other row's unsaved edits as a side effect.
      projectDataStore.updateField(projectId, key, (f) => ({ ...f, isFlagged: true, flagReason: text || null, activeFlagId: id }));
      return id;
    } catch (e) {
      toast.show(`Could not flag ${key}: ${message(e)}`, { severity: 'error' });
      return null;
    }
  });
  return flagId ?? null;
}

/** Dismiss the open flag. The flag stays in the audit trail as DISMISSED. */
export async function removeFlag(projectId: string, key: string, userId: string | null = null): Promise<boolean> {
  const field = fieldOf(projectId, key);
  if (!field?.isFlagged) return false;
  const ok = await onRow(projectId, key, 'unflag', async () => {
    try {
      await clearHumanFlag(field.activeFlagId, userId);
      projectDataStore.updateField(projectId, key, (f) => ({ ...f, isFlagged: false, flagReason: null, activeFlagId: null }));
      toast.show(`Flag removed from ${key}.`, { severity: 'success' });
      return true;
    } catch (e) {
      toast.show(`Could not remove the flag from ${key}: ${message(e)}`, { severity: 'error' });
      return false;
    }
  });
  return !!ok;
}

/**
 * Re-extract one flagged parameter as a correction job
 * (`POST /specs/stream-parameter`). Corrections jump the queue (CLAUDE.md
 * 8.3); the row shows "Queued" or the run's phase, nothing else waits. The
 * row's unsaved edit is dropped: the correction replaces its value.
 */
export function reextractRow(projectId: string, key: string, hint: string) {
  const field = fieldOf(projectId, key);
  if (!field?.isFlagged || correctionsInFlight(projectId).has(key)) return;
  const scoped = mapFieldsToSpecs([field]) as Record<string, unknown> | null;
  projectDataStore.dropDirty(projectId, key);
  void jobRuntime.enqueue(
    createJob(projectId, {
      kind: 'correction',
      parameterKey: key,
      previousMetrics: (scoped?.[key] ?? []) as unknown[],
      userHint: hint.trim() || field.flagReason || '',
    }),
  );
}

/**
 * Retry: flag the row (the hint is optional) and run the single-parameter
 * correction. A correction needs a flagged metric, so nothing is queued if the
 * flag fails; a row that is already flagged is not flagged twice.
 */
export async function retryRow(projectId: string, key: string, userId: string, hint: string = '') {
  const field = fieldOf(projectId, key);
  if (!field || correctionsInFlight(projectId).has(key)) return;
  const flagged = field.isFlagged && field.activeFlagId ? field.activeFlagId : await flagRow(projectId, key, userId, hint);
  if (flagged) reextractRow(projectId, key, hint);
}

/** Kept for existing callers: the same as Retry. */
export const flagAndReextract = retryRow;

/** Pick alternative: choose another candidate and save the row at once. */
export async function chooseAlternative(projectId: string, key: string, specId: string, userId: string | null): Promise<boolean> {
  await chooseCandidate(projectId, key, specId);
  const field = fieldOf(projectId, key);
  if (!field || field.selectedSpecId !== specId) return false;
  return saveRow(projectId, key, userId);
}

/** Save one row's value, unit and chosen candidate now (Edit, Pick alternative). */
export async function saveRow(projectId: string, key: string, userId: string | null): Promise<boolean> {
  const done = await onRow(projectId, key, 'save', async () => {
    const field = fieldOf(projectId, key);
    if (!field) return false;
    try {
      await saveFields(projectId, [field], userId, { silent: true });
      return true;
    } catch (e) {
      toast.show(`Could not save ${key}: ${message(e)}`, { severity: 'error' });
      return false;
    }
  });
  return !!done;
}

export type RevertResult = { ok: true } | { ok: false; message: string };

/**
 * Undo the latest correction of a row (`POST /flagging/revert-correction`),
 * then read the project back. Only offered under the contract rule
 * (`canRevertCorrection`). A 409 means the row changed after the correction.
 */
export async function revertCorrectionRow(projectId: string, key: string, userId: string | null): Promise<RevertResult> {
  const field = fieldOf(projectId, key);
  const correction = field?.latestCorrection;
  if (!field || !correction || !userId || !canRevertCorrection(field)) return { ok: false, message: REVERT_UNAVAILABLE_TEXT };
  const result = await onRow<RevertResult>(projectId, key, 'revert', async () => {
    try {
      await revertCorrection(correction.correction_id, userId);
      projectDataStore.dropDirty(projectId, key);
      await reloadAfterRun(projectId);
      toast.show(`${key} is back to its earlier value.`, { severity: 'success' });
      return { ok: true };
    } catch (e) {
      const text = revertErrorText(e);
      toast.show(text, { severity: 'error' });
      return { ok: false, message: text };
    }
  });
  return result ?? { ok: false, message: 'This row is busy. Try again in a moment.' };
}

function revertErrorText(e: unknown): string {
  const status = e instanceof RevertCorrectionError ? e.status : 0;
  if (status === 409) return REVERT_CONFLICT_TEXT;
  if (status === 404) return 'This correction no longer exists, so there is nothing to revert.';
  if (status >= 500) return 'The server could not revert this value. Try again in a moment.';
  return errorMessage(e, 'This value could not be reverted.');
}

// ---- accept, save, approve -------------------------------------------------

/**
 * Accept the row's current value: resolve its open flag (RESOLVED, by the
 * chosen candidate), then save this row as ACCEPTED. If the save fails the
 * row goes back to the state it had.
 */
export async function acceptRow(projectId: string, key: string, userId: string | null): Promise<void> {
  await onRow(projectId, key, 'accept', async () => {
    const field = fieldOf(projectId, key);
    if (!field) return;
    const flagId = field.isFlagged ? field.activeFlagId : null;
    const wasDirty = projectDataStore.get(projectId).dirty.includes(key);
    let resolved = false;
    try {
      if (flagId) {
        await resolveHumanFlag(flagId, selectedSpec(field)?.candidateId ?? null, userId);
        projectDataStore.updateField(projectId, key, (f) => ({ ...f, isFlagged: false, flagReason: null, activeFlagId: null }));
        resolved = true;
      }
      projectDataStore.updateField(projectId, key, acceptField, { dirty: true });
      const current = fieldOf(projectId, key);
      if (current) await saveFields(projectId, [current], userId, { silent: true });
      toast.show(resolved ? `${key} accepted: flag resolved and value saved.` : `${key} accepted and saved.`, { severity: 'success' });
    } catch (e) {
      projectDataStore.updateField(projectId, key, (f) => ({ ...f, reviewAction: field.reviewAction }));
      if (!wasDirty) projectDataStore.dropDirty(projectId, key);
      toast.show(
        resolved
          ? `${key}: the flag was resolved, but saving the value failed: ${message(e)}. Use Save to retry.`
          : `Could not accept ${key}: ${message(e)}`,
        { severity: 'error' },
      );
    }
  });
}

/** Rows Save would send: unsaved edits, minus rows a correction is about to replace. */
export function rowsToSave(projectId: string): InputField[] {
  const state = projectDataStore.get(projectId);
  const busy = correctionsInFlight(projectId);
  return state.fields.filter((f) => state.dirty.includes(f.id) && !busy.has(f.id));
}

/** Save the unsaved edits. Returns how many rows were saved. */
export async function saveChanges(projectId: string, userId: string | null): Promise<number> {
  const rows = rowsToSave(projectId);
  await saveFields(projectId, rows, userId);
  return rows.length;
}

/** Save pending edits first, then approve. Returns how many parameters the backend approved. */
export async function saveAndApprove(projectId: string, userId: string | null): Promise<number> {
  await saveChanges(projectId, userId);
  return approveProject(projectId, userId);
}
