import type { CustomerPromptSlotSetting, CustomerSettings, CustomerTemplateRef } from '@/api/customerSettings';
import type { PromptVersion } from '@/api/prompts';

/** Only category prompts are shown or changed per customer. */
export function categorySlots<T extends { slot_key: string }>(slots: T[]): T[] {
  return slots.filter((s) => s.slot_key.startsWith('category.'));
}

/** `category.end_of_life` -> "End of life". */
export function slotLabel(slotKey: string): string {
  const name = slotKey.includes('.') ? slotKey.slice(slotKey.indexOf('.') + 1) : slotKey;
  const words = name.split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Global (v1)" or "Customer (v3, change note)". */
export function promptSourceLabel(s: CustomerPromptSlotSetting): string {
  if (s.prompt_version_id) {
    const note = s.change_note?.trim();
    return `Customer (v${s.version_number}${note ? `, ${note}` : ''})`;
  }
  return `Global (v${s.global_version_number ?? '?'})`;
}

/** New project dialog: "Customer prompts: Current v2, Voltage v3" or "Global prompts". */
export function customerPromptSummary(settings: CustomerSettings | null): string {
  const chosen = categorySlots(settings?.prompt_slots ?? [])
    .filter((s) => s.prompt_version_id)
    .sort((a, b) => a.slot_key.localeCompare(b.slot_key));
  if (chosen.length === 0) return 'Global prompts';
  return `Customer prompts: ${chosen.map((s) => `${slotLabel(s.slot_key)} v${s.version_number}`).join(', ')}`;
}

/** The default-template selector: every template the user can see, plus the current default if it is not among them. */
export function customerDefaultTemplateOptions(
  templates: { id: string; name: string }[],
  current: CustomerTemplateRef | null,
): { id: string; name: string }[] {
  const list = templates.map((t) => ({ id: t.id, name: t.name }));
  return current && !list.some((t) => t.id === current.id) ? [{ id: current.id, name: current.name }, ...list] : list;
}

/** Versions to choose from, newest first. Archived ones are left out unless one is the version in use. */
export function versionChoices(versions: PromptVersion[], inUseId: string | null): { id: string; versionNumber: number; label: string }[] {
  return versions
    .filter((v) => !v.is_archived || v.id === inUseId)
    .sort((a, b) => b.version_number - a.version_number)
    .map((v) => {
      const note = v.change_note?.trim();
      return { id: v.id, versionNumber: v.version_number, label: note ? `v${v.version_number} · ${note}` : `v${v.version_number}` };
    });
}

/** Client-side check before posting a customer version; the backend still checks the placeholders. */
export function validateNewVersion(d: { content: string; changeNote: string }): string | null {
  if (d.content.trim() === '') return 'Write the prompt text.';
  if (d.changeNote.trim() === '') return 'Add a change note saying what is different for this customer.';
  return null;
}
