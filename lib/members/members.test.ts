import { describe, expect, it } from 'vitest';
import { addMemberResult, formatAdded, groupMembers, type Member } from './members';

const m = (over: Partial<Member>): Member => ({ user_id: 'u', username: 'x', department: null, role: 'CONTRIBUTOR', is_creator: false, assigned_at: null, ...over });

describe('groupMembers', () => {
  it('groups Authors / Contributors / Auditors in that order and keeps the given order inside a group', () => {
    const groups = groupMembers([
      m({ user_id: '1', username: 'cc', role: 'CONTRIBUTOR' }),
      m({ user_id: '2', username: 'aa', role: 'AUTHOR', is_creator: true }),
      m({ user_id: '3', username: 'uu', role: 'AUDITOR' }),
      m({ user_id: '4', username: 'dd', role: 'CONTRIBUTOR' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Authors', 'Contributors', 'Auditors']);
    expect(groups[1].members.map((x) => x.username)).toEqual(['cc', 'dd']);
  });
  it('leaves out an empty group', () => {
    expect(groupMembers([m({ role: 'AUTHOR' })]).map((g) => g.title)).toEqual(['Authors']);
  });
  it('empty list, no groups', () => expect(groupMembers([])).toEqual([]));
});

describe('formatAdded', () => {
  it('a date, or a dash when the backend has none', () => {
    expect(formatAdded('2026-11-01T22:56:58.454304+00:00')).toMatch(/2026/);
    expect(formatAdded(null)).toBe('—');
    expect(formatAdded('not a date')).toBe('—');
  });
});

describe('addMemberResult', () => {
  const member = m({ username: 'newcomer', role: 'AUDITOR' });
  it('201 added', () => expect(addMemberResult({ added: true, member })).toEqual({ added: true, alreadyMember: false, role: 'AUDITOR' }));
  it('200 already a member, role unchanged', () =>
    expect(addMemberResult({ added: false, member: { ...member, role: 'CONTRIBUTOR' } })).toEqual({ added: false, alreadyMember: true, role: 'CONTRIBUTOR' }));
  it('the old shape {"message"} counts as added', () =>
    expect(addMemberResult({ message: 'Added' })).toEqual({ added: true, alreadyMember: false, role: null }));
});
