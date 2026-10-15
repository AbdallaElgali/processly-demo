import type { InputField } from '@/types';
import type { CanonicalParameter } from '@/api/templates';
import type { AddParameterBody, updateProjectParameter } from '@/api/projects';

/**
 * "Remove parameter" is wired end to end (`removeParameter`, the confirmation
 * in `ProjectParameters`) but hidden: `DELETE .../remove` is a HARD delete
 * that also cascades away the parameter's extracted candidates and flag
 * history, which destroys audit trail (backend item B18, owner decision after
 * step 11). Flip this to `true` when the backend soft-deletes.
 */
export const REMOVE_PARAMETER_AVAILABLE = false;
export const REMOVE_PARAMETER_UNAVAILABLE =
  'Removing a parameter is turned off for now: it would be deleted for good, together with its extracted values and flag history. Editing is available.';

/** `project_parameters.parameter_alias` is varchar(50). */
export const ALIAS_MAX = 50;

/** The three texts the Parameters screen edits on a project parameter. */
export interface ParameterMeta {
  alias: string;
  description: string;
  aiInstructions: string;
}

export function metaOf(field: InputField): ParameterMeta {
  return {
    alias: field.parameter_alias || field.label || field.id,
    description: field.description_override ?? '',
    aiInstructions: field.ai_instructions ?? '',
  };
}

/** `null` when the draft can be saved, otherwise what is wrong with the alias. */
export function validateAlias(alias: string): string | null {
  const trimmed = alias.trim();
  if (!trimmed) return 'The alias cannot be empty.';
  if (trimmed.length > ALIAS_MAX) return `At most ${ALIAS_MAX} characters.`;
  return null;
}

/**
 * The body for `PATCH /projects/project-parameter/{id}/`, or `null` when
 * nothing changed.
 *
 * The backend updates with `COALESCE($new, old)`, so **`null` means "leave
 * as is"** and cannot clear a field. A field the person emptied is therefore
 * sent as `''`, which does overwrite. Fields that did not change are sent as
 * `null`, so a stale screen can never write an old value over a newer one.
 */
export function buildParameterPatch(current: ParameterMeta, draft: ParameterMeta): updateProjectParameter | null {
  const pick = (before: string, after: string): string | null => {
    const next = after.trim();
    return next === before.trim() ? null : next;
  };
  const patch: updateProjectParameter = {
    parameter_alias: pick(current.alias, draft.alias),
    description_override: pick(current.description, draft.description),
    ai_instructions: pick(current.aiInstructions, draft.aiInstructions),
  };
  return patch.parameter_alias === null && patch.description_override === null && patch.ai_instructions === null
    ? null
    : patch;
}

/** Case-insensitive match on key, alias and both descriptions. An empty query matches everything. */
export function matchesQuery(field: InputField, canonical: CanonicalParameter | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const meta = metaOf(field);
  return [field.id, meta.alias, meta.description, meta.aiInstructions, canonical?.default_description ?? '']
    .some((text) => text.toLowerCase().includes(q));
}

/**
 * Canonical parameters this project does not have yet (backend 3.10).
 * Matches on the canonical `parameter_id`; `parameter_id` is not assumed to be
 * unique per project, so any row carrying it hides the parameter. A row that
 * carries no `parameter_id` (older payloads) falls back to the key.
 */
export function parametersNotInProject(canonical: CanonicalParameter[], fields: InputField[]): CanonicalParameter[] {
  const haveIds = new Set<string>();
  const haveKeys = new Set<string>();
  for (const f of fields) {
    if (f.parameterId) haveIds.add(f.parameterId);
    else haveKeys.add(f.id);
  }
  return canonical.filter((p) => !haveIds.has(p.id) && !haveKeys.has(p.name));
}

/** The body for `POST /projects/{id}/parameters`. */
export function buildAddParameterBody(parameterId: string, userId: string | null): AddParameterBody {
  return { parameter_id: parameterId, user_id: userId };
}
