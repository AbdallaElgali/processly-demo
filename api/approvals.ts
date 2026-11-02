import { apiFetch } from '@/lib/http/apiFetch';
import { config } from './config';
import type { Approval, ApprovalDetail, ApproveResult, OpenFlag } from './types/approvals';

const BASE = config.api + '/projects';

/**
 * Approve answered 409: the project has open flags and nothing was changed.
 * Carries the flags so the UI can list them and offer "Approve and resolve N flags".
 */
export class OpenFlagsError extends Error {
  readonly count: number;
  readonly flags: OpenFlag[];
  constructor(detail: string, count: number, flags: OpenFlag[]) {
    super(detail);
    this.name = 'OpenFlagsError';
    this.count = count;
    this.flags = flags;
  }
}

export interface ApproveOptions {
  /** Resolve the open flags as part of the approval. */
  resolveOpenFlags?: boolean;
  note?: string | null;
}

/**
 * POST /projects/{id}/approve. Identity stays in the body (`reviewer_id`; an
 * unknown id is a 422 whose text the caller shows). 409 throws
 * `OpenFlagsError`; every other failure throws with the backend's body.
 */
export async function apiApprove(projectId: string, reviewerId: string | null, options: ApproveOptions = {}): Promise<ApproveResult> {
  const note = options.note?.trim() ? options.note.trim() : null;
  const response = await apiFetch(`${BASE}/${projectId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_id: reviewerId, resolve_open_flags: options.resolveOpenFlags ?? false, note }),
  });
  if (response.status === 409) {
    const body = await response.json().catch(() => null);
    if (body && Array.isArray(body.open_flags)) {
      throw new OpenFlagsError(String(body.detail ?? 'The project has open flags.'), Number(body.open_flag_count ?? body.open_flags.length), body.open_flags);
    }
    throw new Error(JSON.stringify(body ?? {}));
  }
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

/** POST /projects/{id}/flags/resolve-all -> number of flags resolved. */
export async function apiResolveAllFlags(projectId: string, userId: string | null): Promise<number> {
  const response = await apiFetch(`${BASE}/${projectId}/flags/resolve-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error(await response.text());
  const body: { resolved_count?: number } = await response.json();
  return typeof body.resolved_count === 'number' ? body.resolved_count : 0;
}

/** GET /projects/{id}/approvals -> versions, newest first ([] when never approved). */
export async function apiGetApprovals(projectId: string): Promise<Approval[]> {
  const response = await apiFetch(`${BASE}/${projectId}/approvals`);
  if (!response.ok) throw new Error(await response.text());
  const body: { approvals?: Approval[] } = await response.json();
  return body.approvals ?? [];
}

/** GET /projects/{id}/approvals/{version} (404 when the project has no such version). */
export async function apiGetApproval(projectId: string, version: number): Promise<ApprovalDetail> {
  const response = await apiFetch(`${BASE}/${projectId}/approvals/${version}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
