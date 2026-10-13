import type { CanonicalParameter, ExtractionTemplateBase, TemplateRule, TemplateRuleUpsert } from '@/api/templates';

export const RULE_ALIAS_MAX = 100;

/**
 * "Save this project as a template" works since backend step 3.3 (B17 fixed):
 * `POST /extraction-templates/from-project` copies the project's parameters
 * (alias, description, AI instructions, the configured expected unit). An
 * unknown project is a 404, a project with no parameters or an unknown user a
 * 422; the dialog shows the backend's text.
 */
export const SAVE_AS_TEMPLATE_AVAILABLE = true;

export interface TemplateAccess {
  editable: boolean;
  /**
   * The template cannot be changed here but can be copied into one the user
   * owns ("Save a copy"). True for the system default only: the backend now
   * refuses to change or delete it (403, step 3.4).
   */
  copyable?: boolean;
  /** Why not, in a sentence the UI can show next to the disabled action. */
  reason?: string;
}

/**
 * Whether the signed-in user may edit or delete a template. **The backend
 * does not check this** (no route compares the caller to `user_id`), so the UI refuses on its own:
 * the system default is shared by every project, and someone else's template
 * is not ours to change (the backend refuses the system default with a 403
 * since step 3.4, but still checks no ownership). There is no authentication to enforce it either
 * (CLAUDE.md section 4).
 */
export function templateAccess(template: ExtractionTemplateBase, userId: string | null | undefined): TemplateAccess {
  if (template.is_system_default) {
    return { editable: false, copyable: true, reason: 'System default template, shared by every project. It cannot be changed; save a copy to make your own.' };
  }
  if (userId && template.user_id === userId) return { editable: true, copyable: false };
  return { editable: false, copyable: false, reason: 'Belongs to someone else. Read-only here.' };
}

/** What a template is, for the scope chip. */
export function templateScope(template: ExtractionTemplateBase, userId: string | null | undefined): 'System' | 'Global' | 'Personal' | 'Shared' {
  if (template.is_system_default) return 'System';
  if (userId && template.user_id === userId) return template.is_global ? 'Global' : 'Personal';
  return template.is_global ? 'Global' : 'Shared';
}

/** Canonical parameters a template has no rule for yet (the Add rule picker). */
export function parametersWithoutRule(canonical: CanonicalParameter[], rules: TemplateRule[]): CanonicalParameter[] {
  const used = new Set(rules.map((r) => r.parameter_id));
  return canonical.filter((p) => !used.has(p.id));
}

/**
 * `(template_id, custom_alias)` is unique in the database. A violation comes
 * back as a 409 whose `detail` names the alias (backend S1; it used to be a
 * bare 500), and the dialog shows that text. Checking first saves the round
 * trip. `editingId` is the rule being
 * edited, which may keep its own alias.
 */
export function validateRuleAlias(alias: string, rules: TemplateRule[], editingId?: string): string | null {
  const trimmed = alias.trim();
  if (!trimmed) return 'The alias cannot be empty.';
  if (trimmed.length > RULE_ALIAS_MAX) return `At most ${RULE_ALIAS_MAX} characters.`;
  if (rules.some((r) => r.id !== editingId && r.custom_alias === trimmed)) {
    return 'Another rule in this template already uses this alias.';
  }
  return null;
}

export interface RuleDraft {
  parameterId: string;
  alias: string;
  description: string;
  aiInstructions: string;
  expectedUnit: string;
  active: boolean;
}

export function draftFromRule(rule: TemplateRule): RuleDraft {
  return {
    parameterId: rule.parameter_id,
    alias: rule.custom_alias,
    description: rule.description_override ?? '',
    aiInstructions: rule.ai_instructions ?? '',
    expectedUnit: rule.expected_unit_override ?? '',
    active: rule.is_active,
  };
}

/**
 * The body for `PUT /extraction-templates/{id}/rules`. The upsert overwrites
 * **every** column with what it is sent (`SET ... = EXCLUDED....`), so an
 * omitted field is written as NULL. The old TemplatesManager left out
 * `expected_unit_override`, which silently erased it on every edit; this always
 * sends all of them, and a blank text is sent as `null`, not `''`.
 */
export function buildRuleUpsert(draft: RuleDraft): TemplateRuleUpsert {
  const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    parameter_id: draft.parameterId,
    custom_alias: draft.alias.trim(),
    is_active: draft.active,
    description_override: blankToNull(draft.description),
    ai_instructions: blankToNull(draft.aiInstructions),
    expected_unit_override: blankToNull(draft.expectedUnit),
  };
}

/** Name proposed for a copy of a template. */
export function copyName(name: string): string {
  return `${name.trim()} (copy)`;
}

/**
 * The upserts that reproduce a template's rules in another one. The upsert
 * overwrites every column, so all of them are sent, active flag included.
 */
export function ruleCopies(rules: TemplateRule[]): TemplateRuleUpsert[] {
  return rules.map((r) => ({
    parameter_id: r.parameter_id,
    custom_alias: r.custom_alias,
    is_active: r.is_active,
    description_override: r.description_override,
    ai_instructions: r.ai_instructions,
    expected_unit_override: r.expected_unit_override,
  }));
}
