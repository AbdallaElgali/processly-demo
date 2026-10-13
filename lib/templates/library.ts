import type { ExtractionTemplateBase } from '@/api/templates';

export function ruleCountLabel(count: number | undefined): string {
  if (count === undefined) return '';
  return `${count} ${count === 1 ? 'rule' : 'rules'}`;
}

export interface ProjectTemplateOption {
  id: string;
  name: string;
  rules: string;
  isDefault: boolean;
  /** The chosen customer's default template (S4). */
  isCustomerDefault: boolean;
}

/**
 * The New project selector: every visible template. Preselects the chosen
 * customer's default template, else the user's default, else the system default.
 */
export function projectTemplateOptions(
  templates: ExtractionTemplateBase[],
  counts: Record<string, number>,
  defaultTemplateId: string | null | undefined,
  customerDefaultId?: string | null,
): { options: ProjectTemplateOption[]; selectedId: string } {
  const userDefault = templates.find((t) => t.id === defaultTemplateId);
  const customerDefault = templates.find((t) => t.id === customerDefaultId);
  const selected = customerDefault ?? userDefault ?? templates.find((t) => t.is_system_default);
  return {
    options: templates.map((t) => ({ id: t.id, name: t.name, rules: ruleCountLabel(counts[t.id]), isDefault: t.id === userDefault?.id, isCustomerDefault: t.id === customerDefault?.id })),
    selectedId: selected?.id ?? '',
  };
}
