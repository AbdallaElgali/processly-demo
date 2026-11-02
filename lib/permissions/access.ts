/**
 * What the signed-in person may do in one project, from
 * `GET /projects/{id}/me` (backend roles foundation). Components ask for a
 * *control*; this file decides from `permissions`, never from the role name.
 * The backend enforces the same rules and answers 403, so this only avoids
 * offering a button that cannot work.
 */

export type Role = 'AUTHOR' | 'CONTRIBUTOR' | 'AUDITOR';

export interface Permissions {
  view: boolean;
  edit: boolean;
  extract: boolean;
  approve: boolean;
  flag: boolean;
  resolve_flags: boolean;
  sign_off: boolean;
  manage_members: boolean;
  delete_project: boolean;
}

/** GET /projects/{project_id}/me */
export interface MyAccess {
  project_id: string;
  user_id: string;
  role: Role;
  permissions: Permissions;
}

export type ProjectAccess =
  | { status: 'loading' }
  | { status: 'ready'; role: Role; permissions: Permissions }
  | { status: 'denied'; reason: string };

export const LOADING_ACCESS: ProjectAccess = { status: 'loading' };

export const CHANGE_DENIED = "Auditors can't change values";
const MEMBERS_DENIED = 'Only authors can manage members';
const FLAG_DENIED = "You can't flag values in this project";
const LOADING_REASON = 'Checking your permissions…';

/** Every gated control in the app, and the permission that opens it. */
const CONTROL_PERMISSION = {
  editValue: 'edit',
  save: 'edit',
  selectCandidate: 'edit',
  reviewRow: 'edit', // Accept / Reject / Reset
  rowActions: 'edit', // Edit / Retry / Pick alternative / Revert
  setStatus: 'edit',
  parameterAdmin: 'edit', // add / edit / remove a parameter
  metadataEdit: 'edit', // alias, description, AI instructions
  promptPins: 'edit',
  approve: 'approve',
  analyze: 'extract',
  retryFlagged: 'extract',
  upload: 'extract',
  resolveFlags: 'resolve_flags',
  flag: 'flag',
  manageMembers: 'manage_members',
} as const satisfies Record<string, keyof Permissions>;

export type Control = keyof typeof CONTROL_PERMISSION;
export const CONTROLS = Object.keys(CONTROL_PERMISSION) as Control[];

export interface ControlState {
  enabled: boolean;
  /** Tooltip for a disabled control; null when enabled. */
  reason: string | null;
}

export function controlState(access: ProjectAccess, control: Control): ControlState {
  if (access.status === 'loading') return { enabled: false, reason: LOADING_REASON };
  if (access.status === 'denied') return { enabled: false, reason: access.reason };
  if (access.permissions[CONTROL_PERMISSION[control]]) return { enabled: true, reason: null };
  if (control === 'manageMembers') return { enabled: false, reason: MEMBERS_DENIED };
  if (control === 'flag') return { enabled: false, reason: FLAG_DENIED };
  return { enabled: false, reason: CHANGE_DENIED };
}

/**
 * Removing a flag: anyone who may resolve flags removes any; a person who may
 * only flag removes the ones they raised themselves (the backend says
 * "Auditors can only withdraw their own flags").
 */
export function canUnflag(access: ProjectAccess, flaggerId: string | null, userId: string | null): boolean {
  if (access.status !== 'ready') return false;
  if (access.permissions.resolve_flags) return true;
  return access.permissions.flag && !!flaggerId && flaggerId === userId;
}

function backendDetail(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  return typeof detail === 'string' && detail ? detail : fallback;
}

function isMyAccess(body: unknown): body is MyAccess {
  const b = body as Partial<MyAccess> | null;
  return !!b && typeof b.role === 'string' && !!b.permissions && typeof b.permissions === 'object';
}

/** Turns the status and body of GET /projects/{id}/me into an access state. */
export function accessFromResponse(status: number, body: unknown): ProjectAccess {
  if (status === 200 && isMyAccess(body)) return { status: 'ready', role: body.role, permissions: body.permissions };
  if (status === 403) return { status: 'denied', reason: backendDetail(body, 'You are not a member of this project') };
  if (status === 404) return { status: 'denied', reason: backendDetail(body, 'Project not found') };
  return { status: 'denied', reason: backendDetail(body, 'Your permissions could not be loaded.') };
}

const ROLE_LABELS: Record<Role, string> = { AUTHOR: 'Author', CONTRIBUTOR: 'Contributor', AUDITOR: 'Auditor' };

/** The label for a role badge; null (no badge) when the caller has no role. */
export function roleBadge(role: Role | null | undefined): { label: string; role: Role } | null {
  return role ? { label: ROLE_LABELS[role], role } : null;
}
