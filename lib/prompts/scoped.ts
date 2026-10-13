import type { ProjectPromptResolution } from '@/api/prompts';
import { slotLabel } from '@/lib/customers/settings';
import { normalizeScope, scopeLabel } from './view';

export const PINS_FROZEN_TEXT = 'Frozen by the first extraction';

export interface ProjectSlotRow {
  slotKey: string;
  label: string;
  versionId: string | null;
  version: number | null;
  /** "Customer", "Project" or "Global". */
  source: string;
  /** Only a project's own choice can be reset. */
  canReset: boolean;
  description: string | null;
}

/** The category slots a project may change. Agent slots are global only and never listed. */
export function projectSlotRows(resolution: ProjectPromptResolution | null): ProjectSlotRow[] {
  return (resolution?.slots ?? [])
    .filter((s) => s.slot_level === 'CATEGORY' && s.is_project_scopable)
    .map((s) => ({
      slotKey: s.slot_key,
      label: slotLabel(s.slot_key),
      versionId: s.prompt_version_id ?? null,
      version: s.version_number ?? null,
      source: scopeLabel(s.resolved_from_scope),
      canReset: normalizeScope(s.resolved_from_scope) === 'PROJECT',
      description: s.slot_description ?? null,
    }));
}

/** Changes are allowed until a run has used the pins. `already_pinned` does not decide this. */
export function pinsEditable(resolution: ProjectPromptResolution | null): boolean {
  return resolution !== null && !resolution.pins_frozen;
}

export function resolutionNote(resolution: ProjectPromptResolution | null): string {
  if (resolution?.pins_frozen) {
    return 'The first extraction has used this project’s prompts, so they are frozen. Every slot below repeats its pin; the scope says where each pinned value came from.';
  }
  return 'This project has not been extracted yet, so its prompts can still be changed. Below is what the first run would use; the source says where each value comes from (project, then customer, then global).';
}
