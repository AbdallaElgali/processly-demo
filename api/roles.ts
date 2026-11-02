import { config } from './config';
import { apiFetch } from '@/lib/http/apiFetch';
import { accessFromResponse, type ProjectAccess } from '@/lib/permissions/access';
import type { MembersResponse } from '@/lib/members/members';
import { errorMessage } from '@/lib/errors';

const BASE = `${config.api}/projects`;

/**
 * GET /projects/{id}/me. A 403 (not a member) or 404 is an answer, not an
 * error: it becomes a `denied` state and the generic 403 toast stays quiet.
 */
export async function fetchMyAccess(projectId: string, signal?: AbortSignal): Promise<ProjectAccess> {
  const response = await apiFetch(`${BASE}/${encodeURIComponent(projectId)}/me`, { signal, quiet403: true });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* no JSON body */
  }
  return accessFromResponse(response.status, body);
}

/** GET /projects/{id}/members (any member). */
export async function fetchMembers(projectId: string, signal?: AbortSignal): Promise<MembersResponse> {
  const response = await apiFetch(`${BASE}/${encodeURIComponent(projectId)}/members`, { signal });
  if (!response.ok) throw new Error(errorMessage(new Error(await response.text()), 'Could not load the members.'));
  return (await response.json()) as MembersResponse;
}
