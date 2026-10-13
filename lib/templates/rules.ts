import type { CanonicalParameter, ExtractionTemplateBase, TemplateRule, TemplateRuleUpsert } from '@/api/templates';

export const RULE_ALIAS_MAX = 50;

/**
 * "Save this project as a template" is wired end to end (`useTemplates`,
 * `NameDialog`), but `POST /extraction-templates/from-project` fails on the
 * current backend: `save_project_as_template` selects `custom_alias` from
 * `project_parameters`, whose column is `parameter_alias`, so the insert is
 * rolled back and nothing is created (proposed backend item B17, found in
 * step 11). The action stays a labelled placeholder until that is fixed;
 * flip this to `true` then.
 */
export const SAVE_AS_TEMPLATE_AVAILABLE = false;
export const SAVE_AS_TEMPLATE_UNAVAILABLE =
  'Unavailable: the backend route that saves a project as a template fails (proposed backend item B17).';

export interface TemplateAccess {
  editable: boolean;
  /** Why not, in a sentence the UI can show next to the disabled action. */
  reason?: string;
}

/**
 * Whether the signed-in user may edit or delete a template. **The backend
 * does not check this** (no route compares the caller to `user_id`, and the
 * system default can be deleted by anyone), so the UI refuses on its own:
 * the system default is shared by every project, and someone else's template
 * is not ours to change. There is no authentication to enforce it either
 * (CLAUDE.md section 4).
 */
export function templateAccess(template: ExtractionTemplateBase, userId: string | null | undefined): TemplateAccess {
  if (template.is_system_default) {
    return { editable: false, reason: 'System default template, shared by every project. Read-only here.' };
  }
  if (userId && template.user_id === userId) return { editable: true };
  return { editable: false, reason: 'Belongs to someone else. Read-only here.' };
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
 * `(template_id, custom_alias)` is unique in the database, and a violation
 * comes back as a bare 500. Check it first. `editingId` is the rule being
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
