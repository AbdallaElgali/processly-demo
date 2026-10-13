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
 * The status-change control. It was hidden while `POST
 * /projects/update-project-status` answered 200 and wrote nothing (backend
 * item B22); backend step 3.1 fixed that and the route now returns the stored
 * status, so the control is on. Flip to `false` to hide it again.
 */
export const STATUS_CHANGE_AVAILABLE = true;
export const STATUS_CHANGE_UNAVAILABLE =
  'Changing the status is turned off for now. The status is shown as stored.';

/** The form-encoded body of `POST /projects/update-project-status`. */
export function statusFormBody(projectId: string, status: ProjectStatus): URLSearchParams {
  return new URLSearchParams({ project_id: projectId, new_status: status });
}

/** What an extraction run's `extraction_type` is called on screen (Overview, Runs table). */
export const RUN_TYPE_LABEL: Record<string, string> = {
  MAIN_MULTI_AGENT: 'Blind',
  ITERATIVE: 'Iterative',
  SINGLE_PARAM: 'Single parameter',
};
