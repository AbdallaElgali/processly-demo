import { errorMessage } from '@/lib/errors';
import type { Role } from '@/lib/permissions/access';
import type { AddMemberResult, MembersResponse, Member } from './members';

export const LAST_AUTHOR_MESSAGE = 'A project needs at least one author. Make someone else author first.';

/** A refused member call: the HTTP status and the backend's body text. */
export class MemberApiError extends Error {
  constructor(readonly status: number, body: string) {
    super(body);
    this.name = 'MemberApiError';
  }
}

export type MemberAction = 'add' | 'change' | 'remove';

/** The sentence shown for a refused call. 409 is always the last-author rule on these routes. */
export function memberErrorText(error: unknown, action: MemberAction): string {
  if (error instanceof MemberApiError) {
    if (error.status === 409) return LAST_AUTHOR_MESSAGE;
    if (error.status === 404 && action === 'add') return 'No user with that name.';
  }
  return errorMessage(error, action === 'add' ? 'Could not add the member.' : action === 'change' ? 'Could not change the role.' : 'Could not remove the member.');
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** Toast text after POST /members. `requested` is the role the form asked for. */
export function addMemberOutcomeText(username: string, result: AddMemberResult, requested: Role): string {
  const role = (result.role ?? requested).toLowerCase();
  if (result.alreadyMember) return `${username} is already ${article(role)} ${role}; change the role in the list below.`;
  return `${username} added as ${role}.`;
}

export function removeConfirmText(username: string, isSelf: boolean): string {
  return isSelf
    ? 'You will lose access to this project. Another author would have to add you again.'
    : `${username} will lose access to this project.`;
}

export interface RowControls {
  roleMenu: { enabled: boolean; reason?: string };
  remove: { enabled: boolean; reason?: string };
}

/** The last author can be neither demoted nor removed (counts.AUTHOR from the members payload). */
export function memberRowControls(member: Member, counts: MembersResponse['counts']): RowControls {
  if (member.role === 'AUTHOR' && (counts.AUTHOR ?? 0) <= 1) {
    const locked = { enabled: false, reason: LAST_AUTHOR_MESSAGE };
    return { roleMenu: locked, remove: { ...locked } };
  }
  return { roleMenu: { enabled: true }, remove: { enabled: true } };
}
