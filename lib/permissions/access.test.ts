import { describe, expect, it } from 'vitest';
import {
  accessFromResponse, CONTROLS, canUnflag, controlState, LOADING_ACCESS, roleBadge,
  type Control, type Permissions, type Role,
} from './access';

const none: Permissions = { view: true, edit: false, extract: false, approve: false, flag: false, resolve_flags: false, sign_off: false, manage_members: false, delete_project: false };
const PERMS: Record<Role, Permissions> = {
  AUTHOR: { ...none, edit: true, extract: true, approve: true, flag: true, resolve_flags: true, manage_members: true, delete_project: true },
  CONTRIBUTOR: { ...none, edit: true, extract: true, approve: true, flag: true, resolve_flags: true },
  AUDITOR: { ...none, flag: true, sign_off: true },
};
const ready = (role: Role) => accessFromResponse(200, { project_id: 'p', user_id: 'u', role, permissions: PERMS[role] });

/** Every control the auditor role may not use (brief, requirement E). */
const BLOCKED_FOR_AUDITOR: Control[] = [
  'editValue', 'save', 'selectCandidate', 'reviewRow', 'approve', 'analyze', 'retryFlagged',
  'rowActions', 'upload', 'setStatus', 'resolveFlags', 'parameterAdmin', 'metadataEdit', 'promptPins',
];

describe('accessFromResponse', () => {
  it('200 gives the role and permissions', () => {
    const a = ready('AUDITOR');
    expect(a).toMatchObject({ status: 'ready', role: 'AUDITOR' });
  });
  it('403 (not a member) is denied with the backend text', () => {
    const a = accessFromResponse(403, { detail: 'You are not a member of this project' });
    expect(a).toEqual({ status: 'denied', reason: 'You are not a member of this project' });
  });
  it('404 and other errors are denied, never ready', () => {
    expect(accessFromResponse(404, { detail: 'Project not found' }).status).toBe('denied');
    expect(accessFromResponse(500, null).status).toBe('denied');
  });
  it('a 200 that is not shaped like the contract is denied rather than trusted', () => {
    expect(accessFromResponse(200, { role: 'AUDITOR' }).status).toBe('denied');
  });
});

describe('controlState', () => {
  it('while loading, every editing control is disabled', () => {
    for (const c of BLOCKED_FOR_AUDITOR) expect(controlState(LOADING_ACCESS, c).enabled).toBe(false);
  });
  it('a non-member cannot use any control', () => {
    const denied = accessFromResponse(403, { detail: 'You are not a member of this project' });
    for (const c of CONTROLS) expect(controlState(denied, c)).toEqual({ enabled: false, reason: 'You are not a member of this project' });
  });
  it.each(BLOCKED_FOR_AUDITOR)('%s is disabled for an auditor with the tooltip', (c) => {
    expect(controlState(ready('AUDITOR'), c)).toEqual({ enabled: false, reason: "Auditors can't change values" });
  });
  it.each(BLOCKED_FOR_AUDITOR)('%s is enabled for a contributor and an author', (c) => {
    expect(controlState(ready('CONTRIBUTOR'), c)).toEqual({ enabled: true, reason: null });
    expect(controlState(ready('AUTHOR'), c)).toEqual({ enabled: true, reason: null });
  });
  it('flagging stays available for an auditor (permissions.flag)', () => {
    expect(controlState(ready('AUDITOR'), 'flag').enabled).toBe(true);
  });
  it('flagging is off when the permission is off, whatever the role name', () => {
    const a = accessFromResponse(200, { project_id: 'p', user_id: 'u', role: 'AUDITOR', permissions: { ...PERMS.AUDITOR, flag: false } });
    expect(controlState(a, 'flag').enabled).toBe(false);
  });
  it('the decision follows the permission, not the role name', () => {
    const odd = accessFromResponse(200, { project_id: 'p', user_id: 'u', role: 'AUDITOR', permissions: { ...PERMS.AUDITOR, edit: true } });
    expect(controlState(odd, 'editValue').enabled).toBe(true);
    expect(controlState(odd, 'approve').enabled).toBe(false);
  });
  it('member forms need manage_members: only an author', () => {
    expect(controlState(ready('AUTHOR'), 'manageMembers').enabled).toBe(true);
    expect(controlState(ready('CONTRIBUTOR'), 'manageMembers')).toEqual({ enabled: false, reason: 'Only authors can manage members' });
    expect(controlState(ready('AUDITOR'), 'manageMembers').enabled).toBe(false);
  });
});

describe('canUnflag', () => {
  it('an auditor may remove only a flag they raised', () => {
    expect(canUnflag(ready('AUDITOR'), 'me', 'me')).toBe(true);
    expect(canUnflag(ready('AUDITOR'), 'someone-else', 'me')).toBe(false);
    expect(canUnflag(ready('AUDITOR'), null, 'me')).toBe(false);
  });
  it('editors keep unflag on every flag', () => {
    expect(canUnflag(ready('CONTRIBUTOR'), 'someone-else', 'me')).toBe(true);
    expect(canUnflag(ready('AUTHOR'), null, 'me')).toBe(true);
  });
  it('not while loading or denied', () => {
    expect(canUnflag(LOADING_ACCESS, 'me', 'me')).toBe(false);
  });
});

describe('roleBadge', () => {
  it('labels each role', () => {
    expect(roleBadge('AUTHOR')?.label).toBe('Author');
    expect(roleBadge('CONTRIBUTOR')?.label).toBe('Contributor');
    expect(roleBadge('AUDITOR')?.label).toBe('Auditor');
  });
  it('no badge without a role', () => {
    expect(roleBadge(null)).toBeNull();
    expect(roleBadge(undefined)).toBeNull();
  });
});
