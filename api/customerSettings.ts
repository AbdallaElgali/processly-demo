import { config } from './config';
import type { PromptVersion } from './prompts';

/**
 * Customer settings (backend S3). Types hand-written from `CustomerSettings`
 * and friends in `openapi.json` (D10). Errors are thrown with the raw body so
 * `errorMessage` can show the backend's `detail` (404 / 422 texts, and the
 * placeholder 422 whose detail is an object).
 */
export interface CustomerTemplateRef {
  id: string;
  name: string;
}

export interface CustomerPromptSlotSetting {
  slot_key: string;
  description?: string | null;
  /** null = the customer uses the global version. */
  prompt_version_id: string | null;
  version_number: number | null;
  change_note: string | null;
  global_version_id: string | null;
  global_version_number: number | null;
}

export interface CustomerSettings {
  customer_id: string;
  alias_name: string;
  name: string | null;
  default_template: CustomerTemplateRef | null;
  /** The settable (category) slots only: agent prompts are global. */
  prompt_slots: CustomerPromptSlotSetting[];
}

async function call<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${config.api}${path}`, {
    ...init,
    signal,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!response.ok) throw new Error((await response.text().catch(() => '')) || response.statusText || String(response.status));
  return response.status === 204 ? (undefined as T) : response.json();
}

const customer = (id: string) => `/customers/${encodeURIComponent(id)}`;

export const apiGetCustomerSettings = (customerId: string, signal?: AbortSignal) =>
  call<CustomerSettings>(`${customer(customerId)}/settings`, undefined, signal);

export const apiSetCustomerDefaultTemplate = (customerId: string, templateId: string) =>
  call<CustomerSettings>(`${customer(customerId)}/default-template`, { method: 'PUT', body: JSON.stringify({ template_id: templateId }) });

export const apiClearCustomerDefaultTemplate = (customerId: string) =>
  call<CustomerSettings>(`${customer(customerId)}/default-template`, { method: 'DELETE' });

export const apiSetCustomerPrompt = (customerId: string, slotKey: string, promptVersionId: string) =>
  call<CustomerSettings>(`${customer(customerId)}/prompt-settings/${encodeURIComponent(slotKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ prompt_version_id: promptVersionId }),
  });

export const apiClearCustomerPrompt = (customerId: string, slotKey: string) =>
  call<CustomerSettings>(`${customer(customerId)}/prompt-settings/${encodeURIComponent(slotKey)}`, { method: 'DELETE' });

/** Creates a version and makes it this customer's choice for the slot, in one transaction. */
export const apiCreateCustomerPromptVersion = (customerId: string, slotKey: string, content: string, changeNote: string) =>
  call<PromptVersion>(`/prompts/slots/${encodeURIComponent(slotKey)}/versions`, {
    method: 'POST',
    body: JSON.stringify({ content, change_note: changeNote, created_by: null, customer_id: customerId }),
  });
