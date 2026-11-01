import type { ProjectStatus } from '@/api/types/projects';

/**
 * Project statuses, in lifecycle order. The backend's `update-project-status`
 * accepts a free string (`new_status: string` in openapi.json) and the
 * database enum rejects anything else, so the UI offers exactly these four.
 */
export const PROJECT_STATUSES: readonly ProjectStatus[] = ['NEW', 'PENDING_REVIEW', 'IN_REVIEW', 'APPROVED'];

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

/**
 * The backend moves the status by itself (extraction, review, approval). A
 * person can only override it by hand, to one of `OVERRIDE_STATUSES`
 * (lib/approvals/view.ts); APPROVED comes only from Approve.
 */

/** The form-encoded body of `POST /projects/update-project-status`; `user_id` only when known. */
export function statusFormBody(projectId: string, status: ProjectStatus, userId: string | null = null): URLSearchParams {
  const body = new URLSearchParams({ project_id: projectId, new_status: status });
  if (userId) body.set('user_id', userId);
  return body;
}

/** What an extraction run's `extraction_type` is called on screen (Overview, Runs table). */
export const RUN_TYPE_LABEL: Record<string, string> = {
  MAIN_MULTI_AGENT: 'Blind',
  ITERATIVE: 'Iterative',
  SINGLE_PARAM: 'Single parameter',
};
