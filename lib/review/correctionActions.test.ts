import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FullProjectDetails } from '@/api/types/projects';
import type { ProjectParameter } from '@/api/projects';
import { dbParamToInputField } from '@/lib/parameter-adapter';
import { projectDataStore } from '@/lib/project-data/store';
import { jobRuntime } from '@/lib/jobs/runtime';
import { jobStore } from '@/lib/jobs/store';
import {
  chooseAlternative,
  editRowValue,
  flagRow,
  retryRow,
  revertCorrectionRow,
  saveRow,
} from './actions';

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
    id: 'pp-1',
    parameter_key: 'U_MAX',
    parameter_alias: 'U max',
    final_value: 4.2,
    final_unit: 'V',
    is_human_modified: false,
    selected_candidate_id: 'c-new',
    review_action: 'PENDING',
    human_flagged: false,
    active_flag_id: null,
    flag_reason: null,
    latest_correction: {
      correction_id: 'k-1',
      outcome: 'new_value',
      previous_candidate_id: 'c-old',
      new_candidate_id: 'c-new',
      previous_value: '4.3',
      previous_unit: 'V',
      previous_is_human_modified: false,
      reverted_at: null,
      created_at: '2026-11-01T18:30:00+00:00',
    },
    candidates: [
      { id: 'c-new', ai_value: 4.2, unit: 'V', confidence: 0.9 },
      { id: 'c-old', ai_value: 4.3, unit: 'V', confidence: 0.8 },
    ],
    ...over,
  }) as unknown as ProjectParameter;

let server: ProjectParameter[];
let calls: Array<{ method: string; url: string; body: unknown }>;
let responses: Record<string, () => Response>;

function seed(rows: ProjectParameter[]) {
  server = rows;
  const details = { id: PID, alias_id: 'P', documents: [], parameters: rows } as unknown as FullProjectDetails;
  projectDataStore.reset();
  projectDataStore.setDetails(PID, details, rows.map(dbParamToInputField));
}

beforeEach(() => {
  calls = [];
  responses = {};
  jobStore.dispatch({ type: 'hydrate', jobs: [] });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, url, body });
      const path = new URL(url).pathname;
      const custom = responses[`${method} ${path}`];
      if (custom) return custom();
      if (method === 'GET' && path === `/projects/${PID}`) {
        return new Response(JSON.stringify({ id: PID, alias_id: 'P', documents: [], parameters: server }), { status: 200 });
      }
      if (path === '/flagging/ai-flag-parameter') return new Response(JSON.stringify({ message: 'ok', flag_id: 'flag-1' }), { status: 200 });
      return new Response('{}', { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const call = (suffix: string) => calls.find((c) => c.url.endsWith(suffix));

describe('A: flagging needs no reason', () => {
  it('submits flag_reason null when no reason is given', async () => {
    seed([row()]);
    const id = await flagRow(PID, 'U_MAX', USER, '');
    expect(id).toBe('flag-1');
    expect(call('/flagging/ai-flag-parameter')?.body).toEqual({
      user_id: USER,
      parameter_id: 'pp-1',
      ai_metric_candidate_id: 'c-new',
      parent_flag_id: null,
      flag_reason: null,
    });
  });

  it('treats a blank reason as no reason and passes a real one through trimmed', async () => {
    seed([row()]);
    await flagRow(PID, 'U_MAX', USER, '   ');
    expect((call('/flagging/ai-flag-parameter')?.body as { flag_reason: unknown }).flag_reason).toBeNull();
    seed([row()]);
    calls.length = 0;
    await flagRow(PID, 'U_MAX', USER, ' use page 4 ');
    expect((call('/flagging/ai-flag-parameter')?.body as { flag_reason: unknown }).flag_reason).toBe('use page 4');
  });
});

describe('C: revert', () => {
  it('posts the correction id and user, then reloads the project', async () => {
    seed([row()]);
    server = [row({ latest_correction: null, selected_candidate_id: 'c-old', final_value: 4.3 })];
    responses['POST /flagging/revert-correction'] = () =>
      new Response(JSON.stringify({ correction_id: 'k-1', final_value: '4.3' }), { status: 200 });
    const result = await revertCorrectionRow(PID, 'U_MAX', USER);
    expect(result).toEqual({ ok: true });
    expect(call('/flagging/revert-correction')?.body).toEqual({ correction_id: 'k-1', user_id: USER });
    const order = calls.map((c) => `${c.method} ${new URL(c.url).pathname}`);
    expect(order.indexOf(`GET /projects/${PID}`)).toBeGreaterThan(order.indexOf('POST /flagging/revert-correction'));
    expect(projectDataStore.get(PID).fields[0].latestCorrection).toBeNull();
  });

  it('on 409 says the value was changed after the correction', async () => {
    seed([row()]);
    responses['POST /flagging/revert-correction'] = () => new Response(JSON.stringify({ detail: 'row changed' }), { status: 409 });
    const result = await revertCorrectionRow(PID, 'U_MAX', USER);
    expect(result).toEqual({ ok: false, message: "This value was changed after the correction, so it can't be reverted automatically." });
  });

  it('on another error shows a plain message, not the raw body', async () => {
    seed([row()]);
    responses['POST /flagging/revert-correction'] = () => new Response('{"detail":"Unknown user."}', { status: 422 });
    const result = await revertCorrectionRow(PID, 'U_MAX', USER);
    expect(result).toEqual({ ok: false, message: 'Unknown user.' });
  });

  it('does nothing when the rule for Revert does not hold', async () => {
    seed([row({ latest_correction: null })]);
    const result = await revertCorrectionRow(PID, 'U_MAX', USER);
    expect(result).toEqual({ ok: false, message: expect.any(String) });
    expect(call('/flagging/revert-correction')).toBeUndefined();
  });
});

describe('D: per-row actions', () => {
  it('Retry flags the row (hint optional) and runs one single-parameter correction with the hint', async () => {
    seed([row({ latest_correction: null })]);
    const enqueue = vi.spyOn(jobRuntime, 'enqueue').mockResolvedValue({ allowed: true });
    await retryRow(PID, 'U_MAX', USER, 'look at the table on page 4');
    expect((call('/flagging/ai-flag-parameter')?.body as { flag_reason: unknown }).flag_reason).toBe('look at the table on page 4');
    expect(enqueue).toHaveBeenCalledTimes(1);
    const job = enqueue.mock.calls[0][0];
    expect(job.payload).toMatchObject({ kind: 'correction', parameterKey: 'U_MAX', userHint: 'look at the table on page 4' });
  });

  it('Retry works with no hint at all', async () => {
    seed([row({ latest_correction: null })]);
    const enqueue = vi.spyOn(jobRuntime, 'enqueue').mockResolvedValue({ allowed: true });
    await retryRow(PID, 'U_MAX', USER, '');
    expect((call('/flagging/ai-flag-parameter')?.body as { flag_reason: unknown }).flag_reason).toBeNull();
    expect(enqueue.mock.calls[0][0].payload).toMatchObject({ kind: 'correction', userHint: '' });
  });

  it('Pick alternative selects that candidate and saves it', async () => {
    seed([row({ latest_correction: null })]);
    await chooseAlternative(PID, 'U_MAX', 'c-old', USER);
    const put = call('/projects/proj-1/parameters');
    expect(put?.method).toBe('PUT');
    expect((put?.body as { parameters: Array<{ selected_candidate_id: string }> }).parameters[0].selected_candidate_id).toBe('c-old');
  });

  it('Edit saves the value and unit of that row only', async () => {
    seed([row({ latest_correction: null }), row({ id: 'pp-2', parameter_key: 'U_MIN', parameter_alias: 'U min' })]);
    editRowValue(PID, 'U_MAX', '4.15', 'V');
    await saveRow(PID, 'U_MAX', USER);
    const put = call('/projects/proj-1/parameters');
    const sent = (put?.body as { parameters: Array<{ parameter_key: string; final_value: number; final_unit: string; is_human_modified: boolean }> }).parameters;
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ parameter_key: 'U_MAX', final_value: 4.15, final_unit: 'V', is_human_modified: true });
  });
});
