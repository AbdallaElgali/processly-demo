import { v4 as uuidv4 } from 'uuid';
import type { InputField, Specification } from '@/types';
import { selectedSpec } from './rowState';

/**
 * Local review edits to one parameter (step 10), as pure transforms, plus
 * the merge that keeps them when the project is refreshed from the backend.
 *
 * An edit stays local until Save. The row is then "dirty" (ProjectState.dirty),
 * and a background refresh -- a job finishing, a flag being raised -- must not
 * throw it away. Before step 10 every refresh replaced all fields, so a
 * correction finishing on one row silently reverted unsaved edits on others.
 */

/**
 * The engineer types a value or unit. The candidate's own value is kept as
 * `original` (once, on the first keystroke), so the row can show what was
 * extracted and offer Revert. With no candidate at all, a new human value is
 * created; it has no `original`.
 */
export function editValue(field: InputField, value: string, unit: string): InputField {
  const selected = field.specifications.find((s) => s.id === field.selectedSpecId);
  if (selected) {
    const original = selected.original ?? (selected.candidateId ? { value: selected.value, unit: selected.unit, confidence: selected.confidence } : undefined);
    return {
      ...field,
      reviewAction: 'MODIFIED',
      // A person's number has no model confidence (as after a reload, lib/parameter-adapter.ts).
      specifications: field.specifications.map((s) => (s.id === selected.id ? { ...s, value, unit, original, confidence: null } : s)),
    };
  }
  const human: Specification = {
    id: uuidv4(),
    candidateId: null,
    value,
    unit,
    confidence: null,
    source: null,
    calculated: false,
    rule_passed: true,
    rule_violations: [],
    requires_review: false,
  };
  return { ...field, reviewAction: 'MODIFIED', specifications: [human, ...field.specifications], selectedSpecId: human.id };
}

/** Undo an edit: the candidate's extracted value, unit and confidence come back. */
export function revertValue(field: InputField): InputField {
  const selected = selectedSpec(field);
  if (!selected?.original) return field;
  const { original } = selected;
  return {
    ...field,
    reviewAction: 'PENDING',
    specifications: field.specifications.map((s) =>
      s.id === selected.id ? { ...s, value: original.value, unit: original.unit, confidence: original.confidence, original: undefined } : s,
    ),
  };
}

export function canRevert(field: InputField): boolean {
  return !!selectedSpec(field)?.original;
}

/**
 * Choose another candidate. An edit belongs to the candidate it was made on,
 * so choosing a different one restores that candidate's extracted value:
 * the save then writes exactly the chosen AI value, not a person's number
 * under an AI candidate's id.
 */
export function selectCandidate(field: InputField, specId: string): InputField {
  if (field.selectedSpecId === specId || !field.specifications.some((s) => s.id === specId)) return field;
  const specifications = field.specifications.map((s) =>
    s.original ? { ...s, value: s.original.value, unit: s.original.unit, confidence: s.original.confidence, original: undefined } : s,
  );
  const target = specifications.find((s) => s.id === specId)!;
  return {
    ...field,
    specifications,
    selectedSpecId: specId,
    // A typed value with no candidate stays "modified"; an AI candidate is not.
    reviewAction: target.candidateId ? 'PENDING' : 'MODIFIED',
  };
}

/**
 * Fields from the backend, with the unsaved local edits of `dirty` rows laid
 * back on top.
 *
 * For a dirty row the server's candidates win (a run may have added some),
 * and the local choice is re-applied by candidate id: the selection, and an
 * edited value on that candidate. A typed value with no candidate is kept as
 * it was. If the locally chosen candidate no longer exists, the server's row
 * is taken as is (nothing to re-apply it to).
 */
export function mergeLocalEdits(server: InputField[], local: InputField[], dirty: ReadonlySet<string>): InputField[] {
  if (dirty.size === 0) return server;
  const byKey = new Map(local.map((f) => [f.id, f]));
  return server.map((f) => {
    if (!dirty.has(f.id)) return f;
    const mine = byKey.get(f.id);
    const chosen = mine ? selectedSpec(mine) : undefined;
    if (!mine || !chosen) return f;

    if (!chosen.candidateId) {
      // A value a person typed: keep it in front of whatever the server has.
      const rest = f.specifications.filter((s) => s.id !== chosen.id && s.candidateId !== null);
      return { ...f, specifications: [chosen, ...rest], selectedSpecId: chosen.id, reviewAction: mine.reviewAction };
    }

    const target = f.specifications.find((s) => s.candidateId === chosen.candidateId);
    if (!target) return f;
    const edited = chosen.original
      ? { ...target, value: chosen.value, unit: chosen.unit, confidence: null, original: chosen.original }
      : target;
    return {
      ...f,
      specifications: f.specifications.map((s) => (s.id === target.id ? edited : s)),
      selectedSpecId: target.id,
      reviewAction: mine.reviewAction,
    };
  });
}
