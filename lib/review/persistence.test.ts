import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputField, Specification } from '@/types';
import { dbParamToInputField, inputFieldToParameterInput } from '@/lib/parameter-adapter';
import type { ProjectParameter } from '@/api/projects';
import { acceptField, editValue, revertValue, selectCandidate } from './edits';
import { newerCandidateAvailable } from './newer';
import { approvalCheck, approveBlockReason, REVIEW_STATE_PERSISTED } from './approval';
import { rowState } from './rowState';

/**
 * F-B15: the backend now stores `review_action` and a human-touched row
 * survives re-extraction. These pin what the frontend sends, so a save can
 * never downgrade a row the person did not touch (and an Accept is stored).
 */

const spec = (over: Partial<Specification> = {}): Specification => ({
  id: 'c1',
  candidateId: 'c1',
  value: '4.2',
  confidence: 95,
  unit: 'V',
  source: null,
  calculated: false,
  rule_passed: true,
  rule_violations: [],
  requires_review: false,
  ...over,
});

const field = (over: Partial<InputField> = {}, specs: Specification[] = [spec()]): InputField => ({
  id: 'U_MAX',
  dbId: 'pp-1',
  label: 'U_MAX',
  specifications: specs,
  selectedSpecId: specs[0]?.id,
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
  ...over,
});

const serverRow = (over: Partial<ProjectParameter> = {}): ProjectParameter =>
  ({
    id: 'pp-1',
    parameter_key: 'U_MAX',
    parameter_alias: 'U max',
    final_value: 4.2,
    final_unit: 'V',
    is_human_modified: false,
    selected_candidate_id: 'c1',
    review_action: 'PENDING',
    reviewed_at: null,
    human_flagged: false,
    active_flag_id: null,
    flag_reason: null,
    flagger_id: null,
    confidence: 0.95,
    source_text_snippet: null,
    source_page_number: null,
    candidates: [{ id: 'c1', ai_value: 4.2, unit: 'V', confidence: 0.95, run_number: 1 }],
    description_override: null,
    ai_instructions: null,
    ...over,
  }) as ProjectParameter;

describe('what a save sends for review_action (step 3)', () => {
  it.each(['PENDING', 'ACCEPTED', 'MODIFIED', 'REJECTED'] as const)(
    'a row the person did not touch is sent back as the server had it: %s',
    (state) => {
      const loaded = dbParamToInputField(serverRow({ review_action: state, is_human_modified: state === 'MODIFIED' }));
      const sent = inputFieldToParameterInput(loaded, 'u1');
      expect(sent.review_action).toBe(state);
      expect(sent.is_human_modified).toBe(state === 'MODIFIED');
    },
  );

  it('an ACCEPTED row that was also edited keeps is_human_modified (so its edited value reloads)', () => {
    const loaded = dbParamToInputField(serverRow({ review_action: 'ACCEPTED', is_human_modified: true, final_value: 4.1 }));
    const sent = inputFieldToParameterInput(loaded, 'u1');
    expect(sent.review_action).toBe('ACCEPTED');
    expect(sent.is_human_modified).toBe(true);
    expect(sent.final_value).toBe(4.1);
  });

  it('an edit of value or unit sends MODIFIED, even on an accepted row', () => {
    const accepted = dbParamToInputField(serverRow({ review_action: 'ACCEPTED' }));
    const sent = inputFieldToParameterInput(editValue(accepted, '4.1', 'V'), 'u1');
    expect(sent.review_action).toBe('MODIFIED');
    expect(sent.is_human_modified).toBe(true);
    expect(inputFieldToParameterInput(editValue(accepted, '4.2', 'mV'), 'u1').review_action).toBe('MODIFIED');
  });

  it('Accept sends ACCEPTED, and an accepted edit stays human-modified', () => {
    const sent = inputFieldToParameterInput(acceptField(field()), 'u1');
    expect(sent.review_action).toBe('ACCEPTED');
    expect(sent.is_human_modified).toBe(false);

    const edited = inputFieldToParameterInput(acceptField(editValue(field(), '4.1', 'V')), 'u1');
    expect(edited.review_action).toBe('ACCEPTED');
    expect(edited.is_human_modified).toBe(true);
    expect(edited.final_value).toBe(4.1);
  });

  it('Revert and choosing another candidate are a deliberate reset to PENDING, not human-modified', () => {
    const f = field({}, [spec(), spec({ id: 'c2', candidateId: 'c2', value: '4.3' })]);
    const reverted = inputFieldToParameterInput(revertValue(editValue(f, '9', 'V')), 'u1');
    expect(reverted).toMatchObject({ review_action: 'PENDING', is_human_modified: false });
    const chosen = inputFieldToParameterInput(selectCandidate(acceptField(f), 'c2'), 'u1');
    expect(chosen).toMatchObject({ review_action: 'PENDING', is_human_modified: false, selected_candidate_id: 'c2' });
  });
});

describe('approval gate with persisted review state (step 6)', () => {
  it('REVIEW_STATE_PERSISTED is on', () => {
    expect(REVIEW_STATE_PERSISTED).toBe(true);
  });

  it('counts the rows Approve will flip: PENDING only, an unsaved edit is MODIFIED and is not flipped', () => {
    const rows = [field({ id: 'A' }), field({ id: 'B', reviewAction: 'ACCEPTED' }), field({ id: 'C', reviewAction: 'MODIFIED' })];
    expect(approvalCheck(rows, { unsaved: 1, jobBusy: false }).pending).toBe(1);
    const none = approvalCheck(rows.slice(1), { unsaved: 1, jobBusy: false });
    expect(approveBlockReason(none)).toMatch(/Nothing is pending/);
  });

  it('a saved Accept is shown as accepted without any session mark', () => {
    expect(rowState(field({ reviewAction: 'ACCEPTED' })).secondary).toContain('accepted');
  });
});

describe('Newer AI candidate available (step 7)', () => {
  const older = spec({ id: 'c1', candidateId: 'c1', runNumber: 1 });
  const newer = spec({ id: 'c2', candidateId: 'c2', runNumber: 2, value: '4.3' });

  it('shows for a human-touched row whose selected candidate is from an older run than another candidate', () => {
    for (const action of ['ACCEPTED', 'MODIFIED', 'REJECTED'] as const) {
      expect(newerCandidateAvailable(field({ reviewAction: action }, [older, newer]))).toBe(true);
    }
    expect(newerCandidateAvailable(field({ reviewAction: 'PENDING', isHumanModified: true }, [older, newer]))).toBe(true);
  });

  it('does not show for an untouched row, the newest candidate, equal runs, or when run numbers are unknown', () => {
    expect(newerCandidateAvailable(field({ reviewAction: 'PENDING' }, [older, newer]))).toBe(false);
    expect(newerCandidateAvailable(field({ reviewAction: 'ACCEPTED', selectedSpecId: 'c2' }, [older, newer]))).toBe(false);
    expect(newerCandidateAvailable(field({ reviewAction: 'ACCEPTED' }, [older, { ...newer, runNumber: 1 }]))).toBe(false);
    expect(newerCandidateAvailable(field({ reviewAction: 'ACCEPTED' }, [{ ...older, runNumber: null }, newer]))).toBe(false);
    expect(newerCandidateAvailable(field({ reviewAction: 'ACCEPTED' }, [spec({ candidateId: null, runNumber: undefined }), newer]))).toBe(false);
  });

  it('reads run_number from the project payload', () => {
    const loaded = dbParamToInputField(
      serverRow({
        review_action: 'ACCEPTED',
        candidates: [
          { id: 'c1', ai_value: 4.2, unit: 'V', confidence: 0.9, run_number: 1 },
          { id: 'c2', ai_value: 4.3, unit: 'V', confidence: 0.9, run_number: 2 },
        ],
      }),
    );
    expect(newerCandidateAvailable(loaded)).toBe(true);
    expect(rowState(loaded).secondary).toContain('newer_candidate');
  });
});

// ---- API calls (steps 3-5): the bodies on the wire -----------------------

interface Call { url: string; method: string; body: unknown }
let calls: Call[];
let respond: (call: Call) => { status: number; body: unknown };

beforeEach(() => {
  calls = [];
  respond = () => ({ status: 200, body: {} });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call = { url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const r = respond(call);
    return { ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('reviewer_id and user_id on the wire (step 4)', () => {
  it('the batch save and the approve body carry reviewer_id', async () => {
    const { apiSaveProjectParameters, apiApproveProjectParameters } = await import('@/api/projects');
    await apiSaveProjectParameters('p1', [], 'user-1');
    await apiApproveProjectParameters('p1', 'user-1');
    expect(calls[0].body).toEqual({ parameters: [], reviewer_id: 'user-1' });
    expect(calls[1].url).toMatch(/\/p1\/approve$/);
    expect(calls[1].body).toEqual({ reviewer_id: 'user-1' });
  });

  it('without a user the body still carries the field, null (the backend accepts the old body too)', async () => {
    const { apiSaveProjectParameters, apiApproveProjectParameters } = await import('@/api/projects');
    await apiSaveProjectParameters('p1', [], null);
    await apiApproveProjectParameters('p1', null);
    expect(calls[0].body).toMatchObject({ reviewer_id: null });
    expect(calls[1].body).toEqual({ reviewer_id: null });
  });

  it('removing a flag and resolving one send user_id', async () => {
    const { clearHumanFlag, resolveHumanFlag } = await import('./flagging');
    await clearHumanFlag('f1', 'user-1');
    await resolveHumanFlag('f2', 'cand-1', 'user-1');
    const unflags = calls.filter((c) => c.url.endsWith('/ai-unflag-parameter')).map((c) => c.body);
    expect(unflags).toEqual([
      { flag_id: 'f1', resolved_by: null, status: 'DISMISSED', user_id: 'user-1' },
      { flag_id: 'f2', resolved_by: null, status: 'RESOLVED', user_id: 'user-1' },
    ]);
  });

  it('an unknown reviewer (422) surfaces the backend text and is not retried', async () => {
    const { saveFields } = await import('@/lib/project-data/actions');
    const { errorMessage } = await import('@/lib/errors');
    respond = () => ({ status: 422, body: { detail: 'Unknown reviewer_id: no such user' } });
    const err = await saveFields('p1', [field()], 'ghost').catch((e) => e);
    expect(errorMessage(err)).toBe('Unknown reviewer_id: no such user');
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});

describe('reload after approve and after a run (step 5)', () => {
  const detailsBody = { id: 'p1', parameters: [serverRow({ review_action: 'ACCEPTED' })], documents: [] };
  const isDetailsGet = (c: Call) => c.method === 'GET' && /\/projects\/p\d$/.test(c.url);

  it('approve sends the reviewer and reloads the project, so no stale review state is saved back', async () => {
    const { approveProject } = await import('@/lib/project-data/actions');
    const { projectDataStore } = await import('@/lib/project-data/store');
    respond = (c) => (isDetailsGet(c) ? { status: 200, body: detailsBody } : { status: 200, body: { parameters_approved: 1 } });
    expect(await approveProject('p1', 'user-1')).toBe(1);
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET']);
    expect(calls[0].body).toEqual({ reviewer_id: 'user-1' });
    expect(projectDataStore.get('p1').fields[0].reviewAction).toBe('ACCEPTED');
  });

  it('a saved row is read back too', async () => {
    const { saveFields } = await import('@/lib/project-data/actions');
    respond = (c) => (isDetailsGet(c) ? { status: 200, body: detailsBody } : { status: 200, body: {} });
    await saveFields('p1', [acceptField(field())], 'user-1');
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'GET']);
    expect((calls[0].body as { parameters: { review_action: string }[] }).parameters[0].review_action).toBe('ACCEPTED');
  });

  it('a finished run reloads the project with the server state, overwriting stale non-dirty rows', async () => {
    const { reloadAfterRun } = await import('@/lib/project-data/actions');
    const { projectDataStore } = await import('@/lib/project-data/store');
    projectDataStore.setFields('p2', [field({ reviewAction: 'PENDING' })]);
    respond = (c) =>
      isDetailsGet(c)
        ? { status: 200, body: { ...detailsBody, id: 'p2', parameters: [serverRow({ review_action: 'MODIFIED', is_human_modified: true })] } }
        : { status: 200, body: {} };
    await reloadAfterRun('p2');
    expect(calls.some((c) => /\/projects\/p2$/.test(c.url))).toBe(true);
    expect(projectDataStore.get('p2').fields[0].reviewAction).toBe('MODIFIED');
  });
});
