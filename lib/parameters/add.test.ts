import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InputField } from '@/types';
import type { CanonicalParameter } from '@/api/templates';
import { apiAddProjectParameter } from '@/api/projects';
import { buildAddParameterBody, parametersNotInProject } from './meta';
import { ProjectDataStore } from '@/lib/project-data/store';
import { errorMessage } from '@/lib/errors';

const field = (over: Partial<InputField> = {}): InputField => ({
  id: 'U_MIN', dbId: 'row-1', label: 'Min voltage', specifications: [],
  isFlagged: false, flagReason: null, activeFlagId: null, reviewAction: 'PENDING', ...over,
});
const canon = (id: string, name: string): CanonicalParameter => ({
  id, name, category: 'Voltage', default_description: null, expected_unit: null,
});

describe('parametersNotInProject matches on parameter_id', () => {
  const dictionary = [canon('p-1', 'U_MIN'), canon('p-2', 'U_MAX')];

  it('hides a canonical parameter the project already has, by parameter_id', () => {
    const out = parametersNotInProject(dictionary, [field({ parameterId: 'p-1' })]);
    expect(out.map((p) => p.id)).toEqual(['p-2']);
  });
  it('matches on the id even when the row key differs (an alias-style key)', () => {
    const out = parametersNotInProject(dictionary, [field({ id: 'SOMETHING_ELSE', parameterId: 'p-2' })]);
    expect(out.map((p) => p.id)).toEqual(['p-1']);
  });
  it('falls back to the key only for a row that carries no parameter_id', () => {
    const out = parametersNotInProject(dictionary, [field({ id: 'U_MAX' })]);
    expect(out.map((p) => p.id)).toEqual(['p-1']);
  });
  it('does not assume parameter_id is unique: two rows with one id still hide it once', () => {
    const rows = [field({ parameterId: 'p-1' }), field({ id: 'U_MIN_2', dbId: 'row-2', parameterId: 'p-1' })];
    expect(parametersNotInProject(dictionary, rows).map((p) => p.id)).toEqual(['p-2']);
  });
});

describe('buildAddParameterBody', () => {
  it('sends parameter_id and user_id', () => {
    expect(buildAddParameterBody('p-2', 'u-1')).toEqual({ parameter_id: 'p-2', user_id: 'u-1' });
  });
  it('sends a null user_id when nobody is signed in (the field is optional)', () => {
    expect(buildAddParameterBody('p-2', null)).toEqual({ parameter_id: 'p-2', user_id: null });
  });
});

describe('apiAddProjectParameter', () => {
  const reply = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300, status,
      json: async () => body, text: async () => JSON.stringify(body),
    }));
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs /projects/{id}/parameters (never the old PUT .../add) and returns the 201 row', async () => {
    reply(201, { id: 'row-9', parameter_key: 'U_MAX' });
    const created = await apiAddProjectParameter('proj-1', { parameter_id: 'p-2', user_id: 'u-1' });
    expect(created).toEqual({ id: 'row-9', parameter_key: 'U_MAX' });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toMatch(/\/projects\/proj-1\/parameters$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ parameter_id: 'p-2', user_id: 'u-1' });
    expect(String(url)).not.toMatch(/project-parameter|\/add/);
  });

  it.each([
    [409, 'Parameter U_MAX is already in the project'],
    [422, 'Unknown parameter_id p-2'],
    [404, 'Project not found'],
  ])("shows the backend's detail text for %i", async (status, detail) => {
    reply(status, { detail });
    const err = await apiAddProjectParameter('proj-1', { parameter_id: 'p-2', user_id: null }).catch((e) => e);
    expect(errorMessage(err)).toBe(detail);
  });
});

describe('ProjectDataStore.appendField', () => {
  it('appends without touching other rows, dirty state or details', () => {
    const store = new ProjectDataStore();
    store.setFields('a', [field()]);
    store.appendField('a', field({ id: 'U_MAX', dbId: 'row-2' }));
    expect(store.get('a').fields.map((f) => f.id)).toEqual(['U_MIN', 'U_MAX']);
    expect(store.get('a').dirty).toEqual([]);
  });
  it('writes only to the given project', () => {
    const store = new ProjectDataStore();
    store.setFields('a', [field()]);
    store.setFields('b', [field()]);
    store.appendField('a', field({ id: 'U_MAX', dbId: 'row-2' }));
    expect(store.get('b').fields).toHaveLength(1);
  });
  it('does not add the same row twice (a background reload may already hold it)', () => {
    const store = new ProjectDataStore();
    store.setFields('a', [field()]);
    store.appendField('a', field({ dbId: 'row-1' }));
    expect(store.get('a').fields).toHaveLength(1);
  });
});
