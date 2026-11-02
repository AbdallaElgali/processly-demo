import { config } from './config';
import { apiFetch } from '@/lib/http/apiFetch';
import { accessFromResponse, type ProjectAccess } from '@/lib/permissions/access';
import { addMemberResult, type AddMemberResult, type MembersResponse } from '@/lib/members/members';
import { MemberApiError } from '@/lib/members/manage';
import { errorMessage } from '@/lib/errors';
import type { Role } from '@/lib/permissions/access';

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

const memberUrl = (projectId: string, userId?: string) =>
  `${BASE}/${encodeURIComponent(projectId)}/members${userId ? `/${encodeURIComponent(userId)}` : ''}`;

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) throw new MemberApiError(response.status, await response.text());
  return response;
}

/** POST /projects/{id}/members: 201 {added: true} / 200 {added: false} (role unchanged); authors only. */
export async function addProjectMember(projectId: string, username: string, role: Role): Promise<AddMemberResult> {
  const response = await expectOk(await apiFetch(memberUrl(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, role }),
  }));
  return addMemberResult(await response.json().catch(() => null));
}

/** PATCH /projects/{id}/members/{user_id}: 404 not a member, 409 last author. */
export async function changeMemberRole(projectId: string, userId: string, role: Role): Promise<void> {
  await expectOk(await apiFetch(memberUrl(projectId, userId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  }));
}

/** DELETE /projects/{id}/members/{user_id}: 204; 404 not a member, 409 last author. */
export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await expectOk(await apiFetch(memberUrl(projectId, userId), { method: 'DELETE' }));
}
