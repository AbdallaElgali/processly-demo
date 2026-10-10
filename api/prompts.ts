import { config } from './config';

/**
 * Read-only prompt registry routes (step 13). Types are hand-written from
 * the schemas in `openapi.json` (D10): PinDetail, ResolvedSlotConfig,
 * ProjectPromptResolution, SlotSummary, PromptVersion, ModelAssignment.
 * Only GET routes are called here: the write routes have no authentication
 * (see `lib/prompts/config.ts`).
 */

export interface PinDetail {
  slot_id: string;
  slot_key: string;
  slot_level: string;
  prompt_version_id: string;
  content: string;
  version_number: number;
  /** Upper-case here (`GLOBAL`), lower-case in the resolution route. */
  resolved_from_scope: string;
  model_name: string | null;
  reasoning_effort: string | null;
  temperature: number | null;
  pinned_by_run_id: string | null;
  pinned_at: string;
  is_lazy: boolean;
}

export interface ResolvedSlotConfig {
  slot_key: string;
  slot_level: string;
  slot_description?: string | null;
  executes_calls: boolean;
  is_project_scopable: boolean;
  prompt_version_id?: string | null;
  version_number?: number | null;
  resolved_from_scope: string;
  model_name?: string | null;
  reasoning_effort?: string | null;
  temperature?: number | null;
  is_lazy?: boolean | null;
}

export interface ProjectPromptResolution {
  already_pinned: boolean;
  slots: ResolvedSlotConfig[];
}

export interface PromptVersion {
  id: string;
  slot_id: string;
  version_number: number;
  content: string;
  change_note?: string | null;
  created_by?: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface ModelAssignment {
  id: string;
  slot_id: string;
  model_name: string;
  reasoning_effort?: string | null;
  temperature?: number | null;
  scope: string;
  customer_id?: string | null;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotSummary {
  id: string;
  slot_key: string;
  slot_level: string;
  description?: string | null;
  required_placeholders?: string[];
  is_project_scopable: boolean;
  executes_calls: boolean;
  current_version?: PromptVersion | null;
  current_model?: ModelAssignment | null;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${config.api}${path}`, { signal });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const apiGetPromptPins = (projectId: string, signal?: AbortSignal) =>
  getJson<PinDetail[]>(`/projects/${encodeURIComponent(projectId)}/prompt-pins`, signal);

export const apiGetPromptResolution = (projectId: string, signal?: AbortSignal) =>
  getJson<ProjectPromptResolution>(`/projects/${encodeURIComponent(projectId)}/prompt-resolution`, signal);

export const apiListSlots = (signal?: AbortSignal) => getJson<SlotSummary[]>('/prompts/slots', signal);

export const apiListSlotVersions = (slotKey: string, signal?: AbortSignal) =>
  getJson<PromptVersion[]>(`/prompts/slots/${encodeURIComponent(slotKey)}/versions?include_archived=true`, signal);
