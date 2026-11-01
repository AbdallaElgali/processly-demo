import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FullProjectDetails, ProjectBase } from '@/api/types/projects';
import type { ProjectParameter } from '@/api/projects';
import { OpenFlagsError } from '@/api/approvals';
import { dbParamToInputField } from '@/lib/parameter-adapter';
import { projectDataStore } from '@/lib/project-data/store';
import { projectsIndex } from '@/lib/project-data/projects-index';
import { errorMessage } from '@/lib/errors';
import {
  addParameterToProject,
  approveProject,
  changeProjectStatus,
  loadProjectDetails,
  resolveAllFlags,
  saveFields,
} from '@/lib/project-data/actions';
import { flagRow, removeFlag, saveAndApprove } from '@/lib/review/actions';
import { loadApproval, loadApprovals } from './history';

vi.mock('@/lib/db', () => ({
  savePendingFiles: vi.fn(async () => undefined),
  loadPendingFiles: vi.fn(async () => []),
  deletePendingFiles: vi.fn(async () => undefined),
  sweepPendingFiles: vi.fn(async () => undefined),
}));

const PID = 'proj-1';
const USER = 'user-1';

const row = (over: Record<string, unknown> = {}): ProjectParameter =>
  ({
    id: 'pp-1', parameter_key: 'U_MAX', parameter_alias: 'U max', final_value: 4.2, final_unit: 'V',
    is_human_modified: false, selected_candidate_id: 'c1', review_action: 'PENDING', human_flagged: false,
    active_flag_id: null, flag_reason: null,
    candidates: [{ id: 'c1', ai_value: 4.2, unit: 'V', confidence: 0.9 }],
    ...over,
  }) as unknown as ProjectParameter;

const project = (over: Record<string, unknown> = {}) => ({
  id: PID, alias_id: 'P', description: null, customer: null, status: 'IN_REVIEW', created_at: '2026-10-10T00:00:00Z',
  source_template_id: null, customer_id: null, documents: [], parameters: [row()],
  approval_version: null, approved_at: null, approved_by: null, approved_by_username: null,
  changed_since_approval: false, open_flag_count: 0, status_overridden: false,
  ...over,
});

type Call = { method: string; path: string; body: unknown; raw: string };
let calls: Call[];
let routes: Record<string, () => Response>;
let current: Record<string, unknown>;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function seed() {
  projectDataStore.reset();
  projectsIndex.reset();
  const rows = [row()];
  projectDataStore.setDetails(PID, project() as unknown as FullProjectDetails, rows.map(dbParamToInputField));
}

beforeEach(() => {
  calls = [];
  routes = {};
  current = project();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const raw = String(init?.body ?? '');
      let body: unknown = raw;
      try { body = raw ? JSON.parse(raw) : undefined; } catch { /* form body */ }
      const path = new URL(url).pathname;
      calls.push({ method, path, body, raw });
      const custom = routes[`${method} ${path}`];
      if (custom) return custom();
      if (method === 'GET' && path === `/projects/${PID}`) return json(200, current);
      if (path === '/flagging/ai-flag-parameter') return json(200, { flag_id: 'flag-1' });
      return json(200, {});
    }),
  );
  seed();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  projectsIndex.reset();
});

const paths = () => calls.map((c) => `${c.method} ${c.path}`);
const statusWrites = () => calls.filter((c) => c.path.endsWith('/update-project-status'));

const approval = (over: Record<string, unknown> = {}) => ({
  id: 'a1', version: 1, approved_by: USER, approved_by_username: 'mia', approved_at: '2026-10-31T10:00:00Z',
  note: null, flags_resolved_count: 0, item_count: 1, ...over,
});

describe('A: the frontend never writes the status; it re-reads the project', () => {
  it('Save re-reads the project and sends no status', async () => {
    await saveFields(PID, projectDataStore.get(PID).fields, USER);
    expect(paths()).toEqual(['PUT /projects/proj-1/parameters', `GET /projects/${PID}`]);
    expect(statusWrites()).toHaveLength(0);
  });

  it('raising a flag re-reads the project', async () => {
    await flagRow(PID, 'U_MAX', USER, '');
    expect(paths()).toContain('POST /flagging/ai-flag-parameter');
    expect(paths().slice(-1)[0]).toBe(`GET /projects/${PID}`);
    expect(statusWrites()).toHaveLength(0);
  });

  it('removing a flag re-reads the project', async () => {
    projectDataStore.updateField(PID, 'U_MAX', (f) => ({ ...f, isFlagged: true, activeFlagId: 'f1' }));
    await removeFlag(PID, 'U_MAX', USER);
    expect(paths()).toContain('POST /flagging/ai-unflag-parameter');
    expect(paths().slice(-1)[0]).toBe(`GET /projects/${PID}`);
    expect(statusWrites()).toHaveLength(0);
  });

  it('adding a parameter re-reads the project', async () => {
    routes['POST /projects/proj-1/parameters'] = () => json(201, row({ id: 'pp-2', parameter_key: 'U_MIN' }));
    await addParameterToProject(PID, 'canon-2', USER);
    expect(paths().slice(-1)[0]).toBe(`GET /projects/${PID}`);
    expect(statusWrites()).toHaveLength(0);
  });

  it('approve and resolve-all re-read the project', async () => {
    routes[`POST /projects/${PID}/approve`] = () => json(200, { created: true, approval: approval(), flags_resolved: 0, parameters_approved: 1, status: 'APPROVED' });
    await approveProject(PID, USER);
    expect(paths().slice(-1)[0]).toBe(`GET /projects/${PID}`);
    calls.length = 0;
    routes[`POST /projects/${PID}/flags/resolve-all`] = () => json(200, { message: 'Open flags resolved', resolved_count: 2 });
    await resolveAllFlags(PID, USER);
    expect(paths()).toEqual([`POST /projects/${PID}/flags/resolve-all`, `GET /projects/${PID}`]);
    expect(statusWrites()).toHaveLength(0);
  });

  it('the project list takes the status and approval fields of the re-read project', async () => {
    projectsIndex.set([{ ...(project() as unknown as ProjectBase), status: 'NEW' }]);
    current = project({ status: 'APPROVED', approval_version: 2, approved_by_username: 'mia' });
    await loadProjectDetails(PID, { background: true });
    const listed = projectsIndex.getSnapshot().projects[0];
    expect(listed.status).toBe('APPROVED');
    expect(listed.approval_version).toBe(2);
  });
});

describe('C: manual status override', () => {
  it('posts form-encoded with project_id, new_status and user_id, then re-reads', async () => {
    routes['POST /projects/update-project-status'] = () => json(200, { message: 'ok', status: 'IN_REVIEW', previous_status: 'APPROVED' });
    await changeProjectStatus(PID, 'IN_REVIEW', USER);
    const post = calls[0];
    expect(post.method).toBe('POST');
    expect(new URLSearchParams(post.raw).get('project_id')).toBe(PID);
    expect(new URLSearchParams(post.raw).get('new_status')).toBe('IN_REVIEW');
    expect(new URLSearchParams(post.raw).get('user_id')).toBe(USER);
    expect(paths().slice(-1)[0]).toBe(`GET /projects/${PID}`);
  });

  it('shows the backend message on an error', async () => {
    routes['POST /projects/update-project-status'] = () => json(409, { detail: 'APPROVED cannot be set manually: use Approve, which records the approval snapshot.' });
    const err = await changeProjectStatus(PID, 'IN_REVIEW', USER).catch((e) => e);
    expect(errorMessage(err)).toBe('APPROVED cannot be set manually: use Approve, which records the approval snapshot.');
  });

  it('shows the 422 text for an unknown user', async () => {
    routes['POST /projects/update-project-status'] = () => json(422, { detail: 'Unknown user_id' });
    const err = await changeProjectStatus(PID, 'NEW', 'ghost').catch((e) => e);
    expect(errorMessage(err)).toBe('Unknown user_id');
  });
});

describe('D: approve', () => {
  const ok = (over: Record<string, unknown> = {}) => json(200, { message: 'Project parameters approved successfully', approval: approval(), created: true, flags_resolved: 0, parameters_approved: 1, status: 'APPROVED', ...over });

  it('sends reviewer_id, resolve_open_flags false and the note', async () => {
    routes[`POST /projects/${PID}/approve`] = () => ok();
    await approveProject(PID, USER, { note: 'looks right' });
    expect(calls[0].body).toEqual({ reviewer_id: USER, resolve_open_flags: false, note: 'looks right' });
  });

  it('a blank note goes as null', async () => {
    routes[`POST /projects/${PID}/approve`] = () => ok();
    await approveProject(PID, USER, { note: '   ' });
    expect((calls[0].body as { note: unknown }).note).toBeNull();
  });

  it('on 409 it throws the open flags and changes nothing (no re-read)', async () => {
    const flag = { flag_id: 'f1', project_parameter_id: 'pp-1', parameter_alias: 'A', flagger_id: 'u', flagger_username: 'sam', flag_reason: null, created_at: '2026-10-31T10:00:00Z' };
    routes[`POST /projects/${PID}/approve`] = () =>
      json(409, { detail: 'The project has open flags. Approve again with resolve_open_flags=true to resolve them.', open_flag_count: 1, open_flags: [flag] });
    const err = await approveProject(PID, USER).catch((e) => e);
    expect(err).toBeInstanceOf(OpenFlagsError);
    expect((err as OpenFlagsError).count).toBe(1);
    expect((err as OpenFlagsError).flags).toEqual([flag]);
    expect(paths()).toEqual([`POST /projects/${PID}/approve`]);
  });

  it('Approve and resolve resends with resolve_open_flags true', async () => {
    routes[`POST /projects/${PID}/approve`] = () => ok({ flags_resolved: 1 });
    const result = await approveProject(PID, USER, { resolveOpenFlags: true });
    expect(calls[0].body).toMatchObject({ resolve_open_flags: true });
    expect(result.flags_resolved).toBe(1);
  });

  it('returns created true and created false as the backend answered', async () => {
    routes[`POST /projects/${PID}/approve`] = () => ok({ created: false, approval: approval({ version: 4 }) });
    const result = await approveProject(PID, USER);
    expect(result.created).toBe(false);
    expect(result.approval.version).toBe(4);
  });

  it('other errors carry the backend text', async () => {
    routes[`POST /projects/${PID}/approve`] = () => json(422, { detail: 'Unknown reviewer_id' });
    const err = await approveProject(PID, 'ghost').catch((e) => e);
    expect(err).not.toBeInstanceOf(OpenFlagsError);
    expect(errorMessage(err)).toBe('Unknown reviewer_id');
  });

  it('Save and approve saves edits first, then approves with the options', async () => {
    projectDataStore.updateField(PID, 'U_MAX', (f) => ({ ...f, reviewAction: 'MODIFIED' }), { dirty: true });
    routes[`POST /projects/${PID}/approve`] = () => ok();
    const result = await saveAndApprove(PID, USER, { note: 'n' });
    expect(paths().indexOf('PUT /projects/proj-1/parameters')).toBeLessThan(paths().indexOf(`POST /projects/${PID}/approve`));
    expect(result.created).toBe(true);
    expect(calls.find((c) => c.path.endsWith('/approve'))?.body).toMatchObject({ note: 'n', reviewer_id: USER });
  });
});

describe('F: resolve all flags', () => {
  it('posts user_id, re-reads and returns the count', async () => {
    routes[`POST /projects/${PID}/flags/resolve-all`] = () => json(200, { message: 'Open flags resolved', resolved_count: 3 });
    expect(await resolveAllFlags(PID, USER)).toBe(3);
    expect(calls[0].body).toEqual({ user_id: USER });
    expect(paths()).toEqual([`POST /projects/${PID}/flags/resolve-all`, `GET /projects/${PID}`]);
  });

  it('shows the backend text when it fails', async () => {
    routes[`POST /projects/${PID}/flags/resolve-all`] = () => json(422, { detail: 'Unknown user_id' });
    const err = await resolveAllFlags(PID, 'ghost').catch((e) => e);
    expect(errorMessage(err)).toBe('Unknown user_id');
  });
});

describe('G: approval history', () => {
  it('lists versions, newest first as the backend sends them', async () => {
    routes[`GET /projects/${PID}/approvals`] = () => json(200, { approvals: [approval({ version: 2 }), approval({ version: 1 })] });
    const list = await loadApprovals(PID);
    expect(list.map((a) => a.version)).toEqual([2, 1]);
  });

  it('an empty history is an empty list', async () => {
    routes[`GET /projects/${PID}/approvals`] = () => json(200, { approvals: [] });
    expect(await loadApprovals(PID)).toEqual([]);
  });

  it('opens one version with its items, including a removed parameter', async () => {
    routes[`GET /projects/${PID}/approvals/2`] = () =>
      json(200, {
        approval: approval({ version: 2 }),
        items: [
          { id: 'i1', project_parameter_id: 'pp-1', parameter_id: 'p1', parameter_name: 'U_MAX', parameter_alias: 'U max', final_value: '4.2', final_unit: 'V', selected_candidate_id: 'c1', source_document_id: null, source_anchor: null, origin: 'AI_SELECTED', review_action: 'ACCEPTED' },
          { id: 'i2', project_parameter_id: null, parameter_id: 'p2', parameter_name: 'U_MIN', parameter_alias: 'U min', final_value: null, final_unit: null, selected_candidate_id: null, source_document_id: null, source_anchor: null, origin: 'HUMAN_ENTERED', review_action: 'MODIFIED' },
        ],
      });
    const detail = await loadApproval(PID, 2);
    expect(detail.approval.version).toBe(2);
    expect(detail.items.map((i) => i.project_parameter_id)).toEqual(['pp-1', null]);
  });

  it('a missing version carries the backend text', async () => {
    routes[`GET /projects/${PID}/approvals/9`] = () => json(404, { detail: 'Approval version not found' });
    const err = await loadApproval(PID, 9).catch((e) => e);
    expect(errorMessage(err)).toBe('Approval version not found');
  });
});
