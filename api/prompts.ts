import { config } from './config';

/**
 * Read-only prompt registry routes (step 13). Types are hand-written from
 * the schemas in `openapi.json` (D10): PinDetail, ResolvedSlotConfig,
 * ProjectPromptResolution, SlotSummary, PromptVersion, ModelAssignment.
 * Writes are limited to a project's own pins (S4); the global registry stays
 * read-only (see `lib/prompts/config.ts`).
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
  /** Some pins exist. A customer project has them from creation, so this is NOT frozen. */
  already_pinned: boolean;
  /** A run has used the pins: the pin routes now answer 409. The key for can-it-still-be-changed. */
  pins_frozen: boolean;
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

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${config.api}${path}`, { ...init, headers: init.body ? { 'Content-Type': 'application/json' } : undefined });
  if (!response.ok) throw new Error((await response.text().catch(() => '')) || response.statusText || String(response.status));
  return response.status === 204 ? (undefined as T) : response.json();
}

const pinPath = (projectId: string, slotKey: string) =>
  `/projects/${encodeURIComponent(projectId)}/prompt-pins/${encodeURIComponent(slotKey)}`;

/** Change one category slot's version for this project only. 409 once the project has been extracted. */
export const apiSetProjectPin = (projectId: string, slotKey: string, promptVersionId: string) =>
  send<PinDetail>(pinPath(projectId, slotKey), { method: 'PUT', body: JSON.stringify({ prompt_version_id: promptVersionId }) });

/** Remove the project's own choice: the slot resolves through customer, then global. 204. */
export const apiResetProjectPin = (projectId: string, slotKey: string) =>
  send<void>(pinPath(projectId, slotKey), { method: 'DELETE' });

export const apiListSlots = (signal?: AbortSignal) => getJson<SlotSummary[]>('/prompts/slots', signal);

export const apiListSlotVersions = (slotKey: string, signal?: AbortSignal) =>
  getJson<PromptVersion[]>(`/prompts/slots/${encodeURIComponent(slotKey)}/versions?include_archived=true`, signal);
