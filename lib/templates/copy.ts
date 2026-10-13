import { createTemplate, upsertTemplateRule, type ExtractionTemplateBase, type TemplateRule } from '@/api/templates';
import { copyName, ruleCopies } from './rules';

/**
 * "Save a copy" of a template the user cannot change (the system default):
 * a new personal template named "<name> (copy)", then one rule upsert per
 * rule. There is no backend route for this, so it is two kinds of call. If a
 * rule fails the error is thrown with the new template left in place; the
 * caller says so.
 */
export async function saveTemplateCopy(
  userId: string,
  source: ExtractionTemplateBase,
  rules: TemplateRule[],
  name: string = copyName(source.name),
): Promise<ExtractionTemplateBase> {
  const made = await createTemplate({ name: name.trim(), user_id: userId, is_global: false });
  for (const body of ruleCopies(rules)) await upsertTemplateRule(made.id, body);
  return made;
}
