import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttp, setRequestUser } from '@/lib/http/apiFetch';
import {
  addMemberOutcomeText,
  LAST_AUTHOR_MESSAGE,
  memberRowControls,
  memberErrorText,
  removeConfirmText,
} from './manage';
import { addProjectMember, changeMemberRole, removeProjectMember } from '@/api/roles';
import { runAddMember, runChangeRole, runRemoveMember } from './actions';
import type { Member } from './members';
import { controlState, type ProjectAccess } from '@/lib/permissions/access';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const P = 'proj-1';

const member = (over: Partial<Member>): Member => ({
  user_id: OTHER, username: 'bea', department: null, role: 'CONTRIBUTOR', is_creator: false, assigned_at: null, ...over,
});

let calls: { url: string; init?: RequestInit }[];
let respond: (url: string, init?: RequestInit) => Response;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  calls = [];
  respond = () => json(200, {});
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond(String(input), init);
  }));
  configureHttp({});
  setRequestUser(ME);
});
afterEach(() => vi.unstubAllGlobals());

const sent = (i: number) => ({
  url: calls[i].url,
  method: calls[i].init?.method,
  body: calls[i].init?.body ? JSON.parse(String(calls[i].init?.body)) : undefined,
  user: new Headers(calls[i].init?.headers).get('X-User-Id'),
});

describe('add member (POST /members)', () => {
  it.each(['AUTHOR', 'CONTRIBUTOR', 'AUDITOR'] as const)('sends username and role %s with the caller header', async (role) => {
    respond = () => json(201, { added: true, member: member({ role }) });
    const result = await addProjectMember(P, 'bea', role);
    expect(sent(0)).toMatchObject({ url: expect.stringMatching(/\/projects\/proj-1\/members$/), method: 'POST', body: { username: 'bea', role }, user: ME });
    expect(result).toMatchObject({ added: true, alreadyMember: false, role });
    expect(addMemberOutcomeText('bea', result, role)).toBe(`bea added as ${role.toLowerCase()}.`);
  });

  it('already a member (200, added false): says so and points at the list, role not changed', async () => {
    respond = () => json(200, { added: false, member: member({ role: 'AUDITOR' }) });
    const result = await addProjectMember(P, 'bea', 'AUTHOR');
    expect(result.alreadyMember).toBe(true);
    expect(addMemberOutcomeText('bea', result, 'AUTHOR')).toBe('bea is already an auditor; change the role in the list below.');
  });

  it('404 shows "No user with that name."', async () => {
    respond = () => json(404, { detail: 'User not found' });
    await expect(addProjectMember(P, 'zed', 'AUTHOR')).rejects.toSatisfy((e) => memberErrorText(e, 'add') === 'No user with that name.');
  });

  it('422 and 403 show the backend text', async () => {
    respond = () => json(403, { detail: 'Only authors can manage members' });
    await expect(addProjectMember(P, 'bea', 'AUTHOR')).rejects.toSatisfy((e) => memberErrorText(e, 'add') === 'Only authors can manage members');
  });
});

describe('change role (PATCH /members/{user_id})', () => {
  it('sends the new role', async () => {
    respond = () => json(200, { member: member({ role: 'AUTHOR' }) });
    await changeMemberRole(P, OTHER, 'AUTHOR');
    expect(sent(0)).toMatchObject({ url: expect.stringMatching(new RegExp(`/projects/proj-1/members/${OTHER}$`)), method: 'PATCH', body: { role: 'AUTHOR' }, user: ME });
  });

  it('409 shows the last-author sentence', async () => {
    respond = () => json(409, { detail: 'A project needs at least one author.' });
    await expect(changeMemberRole(P, ME, 'AUDITOR')).rejects.toSatisfy((e) => memberErrorText(e, 'change') === LAST_AUTHOR_MESSAGE);
    expect(LAST_AUTHOR_MESSAGE).toBe('A project needs at least one author. Make someone else author first.');
  });

  it('404 says the person is no longer a member', async () => {
    respond = () => json(404, { detail: 'Not a member of this project' });
    await expect(changeMemberRole(P, OTHER, 'AUTHOR')).rejects.toSatisfy((e) => memberErrorText(e, 'change') === 'Not a member of this project');
  });
});

describe('remove (DELETE /members/{user_id})', () => {
  it('sends DELETE and accepts 204', async () => {
    respond = () => new Response(null, { status: 204 });
    await removeProjectMember(P, OTHER);
    expect(sent(0)).toMatchObject({ method: 'DELETE', user: ME, url: expect.stringMatching(new RegExp(`/members/${OTHER}$`)) });
  });

  it('409 shows the last-author sentence', async () => {
    respond = () => json(409, { detail: 'A project needs at least one author.' });
    await expect(removeProjectMember(P, ME)).rejects.toSatisfy((e) => memberErrorText(e, 'remove') === LAST_AUTHOR_MESSAGE);
  });

  it('the confirmation names the person; for yourself it says you will lose access', () => {
    expect(removeConfirmText('bea', false)).toMatch(/bea/);
    expect(removeConfirmText('bea', false)).not.toMatch(/\bYou\b/);
    expect(removeConfirmText('me', true)).toMatch(/^You will lose access/);
  });
});

describe('re-read after each change', () => {
  const refresh = () => ({ members: vi.fn(async () => undefined), access: vi.fn(async () => undefined) });

  it('add, change and remove each re-read the members list and the caller permissions', async () => {
    const r = refresh();
    respond = (url, init) => (init?.method === 'DELETE' ? new Response(null, { status: 204 }) : json(init?.method === 'POST' ? 201 : 200, { added: true, member: member({}) }));
    await runAddMember(P, 'bea', 'AUDITOR', r);
    await runChangeRole(P, OTHER, 'AUTHOR', r);
    await runRemoveMember(P, OTHER, ME, r);
    expect(r.members).toHaveBeenCalledTimes(3);
    expect(r.access).toHaveBeenCalledTimes(3);
  });

  it('a failed call re-reads nothing and rethrows', async () => {
    const r = refresh();
    respond = () => json(409, { detail: 'A project needs at least one author.' });
    await expect(runChangeRole(P, ME, 'AUDITOR', r)).rejects.toThrow();
    expect(r.members).not.toHaveBeenCalled();
    expect(r.access).not.toHaveBeenCalled();
  });

  it('removing yourself reports selfRemoved (so the screen goes to the projects list) and does not re-read the project', async () => {
    const r = refresh();
    respond = () => new Response(null, { status: 204 });
    expect(await runRemoveMember(P, ME, ME, r)).toEqual({ selfRemoved: true });
    expect(r.members).not.toHaveBeenCalled();
    expect(r.access).not.toHaveBeenCalled();
  });

  it('removing someone else reports selfRemoved false', async () => {
    const r = refresh();
    respond = () => new Response(null, { status: 204 });
    expect(await runRemoveMember(P, OTHER, ME, r)).toEqual({ selfRemoved: false });
  });
});

describe('row controls', () => {
  const counts = (a: number) => ({ AUTHOR: a, CONTRIBUTOR: 1, AUDITOR: 0 });

  it('the only author: role menu and Remove disabled, with the reason as tooltip', () => {
    const c = memberRowControls(member({ role: 'AUTHOR' }), counts(1));
    expect(c).toEqual({ roleMenu: { enabled: false, reason: LAST_AUTHOR_MESSAGE }, remove: { enabled: false, reason: LAST_AUTHOR_MESSAGE } });
  });

  it('one of several authors is changeable and removable', () => {
    const c = memberRowControls(member({ role: 'AUTHOR' }), counts(2));
    expect(c.roleMenu.enabled).toBe(true);
    expect(c.remove.enabled).toBe(true);
  });

  it('a non-author is always changeable, even when there is one author', () => {
    const c = memberRowControls(member({ role: 'CONTRIBUTOR' }), counts(1));
    expect(c.roleMenu.enabled).toBe(true);
    expect(c.remove.enabled).toBe(true);
  });
});

describe('who sees the management controls', () => {
  const ready = (role: 'AUTHOR' | 'CONTRIBUTOR' | 'AUDITOR', manage: boolean): ProjectAccess =>
    ({ status: 'ready', role, permissions: { manage_members: manage } as never });

  it('only authors (manage_members); contributors and auditors get the read-only list', () => {
    expect(controlState(ready('AUTHOR', true), 'manageMembers').enabled).toBe(true);
    expect(controlState(ready('CONTRIBUTOR', false), 'manageMembers').enabled).toBe(false);
    expect(controlState(ready('AUDITOR', false), 'manageMembers').enabled).toBe(false);
  });
});
