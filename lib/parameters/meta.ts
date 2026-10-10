import type { InputField } from '@/types';
import type { CanonicalParameter } from '@/api/templates';
import type { updateProjectParameter } from '@/api/projects';

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

/** Canonical parameters this project does not have yet. */
export function parametersNotInProject(canonical: CanonicalParameter[], fields: InputField[]): CanonicalParameter[] {
  const have = new Set(fields.map((f) => f.id));
  return canonical.filter((p) => !have.has(p.name));
}
