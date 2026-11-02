import { addProjectMember, changeMemberRole, removeProjectMember } from '@/api/roles';
import type { Role } from '@/lib/permissions/access';
import type { AddMemberResult } from './members';

/** What to re-read after a change: the members list and the caller's own permissions (their role may have changed). */
export interface MemberRefresh {
  members: () => Promise<unknown> | void;
  access: () => Promise<unknown> | void;
}

async function refresh(r: MemberRefresh): Promise<void> {
  await Promise.all([r.members(), r.access()]);
}

export async function runAddMember(projectId: string, username: string, role: Role, r: MemberRefresh): Promise<AddMemberResult> {
  const result = await addProjectMember(projectId, username, role);
  await refresh(r);
  return result;
}

export async function runChangeRole(projectId: string, userId: string, role: Role, r: MemberRefresh): Promise<void> {
  await changeMemberRole(projectId, userId, role);
  await refresh(r);
}

/**
 * Removing yourself ends your access: nothing is re-read (it would answer 403)
 * and the caller sends the person to the projects list.
 */
export async function runRemoveMember(projectId: string, userId: string, myId: string | null, r: MemberRefresh): Promise<{ selfRemoved: boolean }> {
  await removeProjectMember(projectId, userId);
  if (userId === myId) return { selfRemoved: true };
  await refresh(r);
  return { selfRemoved: false };
}
