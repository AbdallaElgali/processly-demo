import type { Role } from '@/lib/permissions/access';

/** One entry of GET /projects/{id}/members. */
export interface Member {
  user_id: string;
  username: string;
  department: string | null;
  role: Role;
  is_creator: boolean;
  assigned_at: string | null;
}

export interface MembersResponse {
  members: Member[];
  counts: Record<Role, number>;
}

const GROUPS: { role: Role; title: string }[] = [
  { role: 'AUTHOR', title: 'Authors' },
  { role: 'CONTRIBUTOR', title: 'Contributors' },
  { role: 'AUDITOR', title: 'Auditors' },
];

/** Authors, Contributors, Auditors; an empty group is left out. Order inside a group is the backend's. */
export function groupMembers(members: Member[]): { role: Role; title: string; members: Member[] }[] {
  return GROUPS
    .map((g) => ({ ...g, members: members.filter((m) => m.role === g.role) }))
    .filter((g) => g.members.length > 0);
}

export function formatAdded(assignedAt: string | null): string {
  if (!assignedAt) return '—';
  const d = new Date(assignedAt);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export interface AddMemberResult {
  added: boolean;
  alreadyMember: boolean;
  /** The member's role after the call; null when the backend did not say (the older {"message"} answer). */
  role: Role | null;
}

/**
 * POST /projects/{id}/contributors|auditors answers `{"message"}` (200) before
 * roles are enforced, and `{"added": true|false, "member"}` (201 / 200) after.
 * An already-member keeps their role.
 */
export function addMemberResult(body: unknown): AddMemberResult {
  const b = body as { added?: unknown; member?: { role?: Role } } | null;
  const role = b?.member?.role ?? null;
  if (b && typeof b.added === 'boolean') return { added: b.added, alreadyMember: !b.added, role };
  return { added: true, alreadyMember: false, role };
}
