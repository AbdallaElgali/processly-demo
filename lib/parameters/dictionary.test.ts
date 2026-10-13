import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalParameter } from '@/api/templates';
import {
  BUILTIN_NOTE, CATEGORY_CHOICES, NEW_PARAMETER_EXPORT_NOTE, buildCreateParameterBody, canEditParameter,
  groupDictionary, markBuiltin, resetBuiltinMarks, validateParameterName,
} from './dictionary';

const p = (over: Partial<CanonicalParameter> = {}): CanonicalParameter => ({
  id: 'p1', name: 'U_MIN', category: 'Voltage', default_description: 'd', expected_unit: 'V', ...over,
});

describe('validateParameterName', () => {
  it.each(['U_OCV_REST', 'A', 'X1_2', 'A'.repeat(50)])('accepts %s', (n) => expect(validateParameterName(n)).toBeNull());
  it.each(['', 'u_ocv', '1ABC', 'A-B', 'A B', '_A', 'A'.repeat(51)])('rejects "%s"', (n) => expect(validateParameterName(n)).toMatch(/UPPER_SNAKE_CASE/));
});

describe('category choices', () => {
  it('are exactly the five backend values, with the app labels', () => {
    expect(CATEGORY_CHOICES).toEqual([
      { value: 'Voltage', label: 'Voltage' },
      { value: 'Current', label: 'Current' },
      { value: 'Temperature', label: 'Temperature' },
      { value: 'Capacity', label: 'Capacity' },
      { value: 'End_Of_Life', label: 'End of life' },
    ]);
  });
});

describe('buildCreateParameterBody', () => {
  it('trims, and sends a blank unit as null', () => {
    expect(buildCreateParameterBody({ name: ' U_OCV_REST ', category: 'Voltage', unit: ' ', description: ' Rest voltage ' })).toEqual({
      name: 'U_OCV_REST', category: 'Voltage', expected_unit: null, default_description: 'Rest voltage',
    });
  });
  it('keeps a unit', () => {
    expect(buildCreateParameterBody({ name: 'A', category: 'Current', unit: 'mV', description: 'x' }).expected_unit).toBe('mV');
  });
});

describe('the export note', () => {
  it('says new parameters are not in the .battery export yet', () => {
    expect(NEW_PARAMETER_EXPORT_NOTE).toBe('New parameters are not written to the .battery export yet.');
    expect(BUILTIN_NOTE).toMatch(/built-in/);
  });
});

describe('canEditParameter', () => {
  beforeEach(resetBuiltinMarks);
  it('offers Edit when the list does not say', () => {
    expect(canEditParameter(p())).toBe(true);
  });
  it('hides Edit for a built-in parameter when the list has is_builtin', () => {
    expect(canEditParameter({ ...p(), is_builtin: true })).toBe(false);
    expect(canEditParameter({ ...p(), is_builtin: false })).toBe(true);
  });
  it('stops offering Edit for a parameter after its 409, for the session', () => {
    markBuiltin('p1');
    expect(canEditParameter(p())).toBe(false);
    expect(canEditParameter(p({ id: 'p2' }))).toBe(true);
  });
});

describe('groupDictionary', () => {
  it('groups by category in the app order, sorted by name, Other last', () => {
    const groups = groupDictionary([
      p({ id: '1', name: 'B', category: 'Current' }),
      p({ id: '2', name: 'A', category: 'Voltage' }),
      p({ id: '3', name: 'C', category: 'Voltage' }),
      p({ id: '4', name: 'Z', category: null }),
      p({ id: '5', name: 'Y', category: 'End_Of_Life' }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Voltage', 'Current', 'End of life', 'Other']);
    expect(groups[0].parameters.map((x) => x.name)).toEqual(['A', 'C']);
  });
  it('does not list a category with no parameters', () => {
    expect(groupDictionary([p()]).map((g) => g.label)).toEqual(['Voltage']);
  });
});

describe('parameter routes', () => {
  let calls: { url: string; method: string; body: unknown }[];
  let reply: { status: number; body: unknown };
  beforeEach(() => {
    calls = [];
    reply = { status: 201, body: p({ id: 'new', name: 'U_OCV_REST' }) };
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs the create body to /extraction-templates/parameters', async () => {
    const { createCanonicalParameter } = await import('@/api/templates');
    const made = await createCanonicalParameter({ name: 'U_OCV_REST', category: 'Voltage', expected_unit: null, default_description: 'x' });
    expect(calls[0]).toMatchObject({ method: 'POST', body: { name: 'U_OCV_REST', category: 'Voltage' } });
    expect(calls[0].url).toMatch(/\/extraction-templates\/parameters$/);
    expect(made.id).toBe('new');
  });

  it('shows the backend 409 text', async () => {
    const { createCanonicalParameter } = await import('@/api/templates');
    const { errorMessage } = await import('@/lib/errors');
    reply = { status: 409, body: { detail: "A parameter named 'U_MIN' already exists." } };
    const err = await createCanonicalParameter({ name: 'U_MIN', category: 'Voltage', expected_unit: null, default_description: 'x' }).catch((e) => e);
    expect(errorMessage(err)).toBe("A parameter named 'U_MIN' already exists.");
  });

  it('shows the first message of a 422 detail list', async () => {
    const { createCanonicalParameter } = await import('@/api/templates');
    const { errorMessage } = await import('@/lib/errors');
    reply = { status: 422, body: { detail: [{ msg: 'name must be 1-50 characters of A-Z, 0-9 and _, starting with a letter (e.g. U_OCV_REST)' }] } };
    const err = await createCanonicalParameter({ name: 'x', category: 'Voltage', expected_unit: null, default_description: 'x' }).catch((e) => e);
    expect(errorMessage(err)).toMatch(/starting with a letter/);
  });

  it('PUTs only the keys sent, and a 409 carries its status', async () => {
    const { updateCanonicalParameter } = await import('@/api/templates');
    const { errorMessage } = await import('@/lib/errors');
    reply = { status: 409, body: { detail: "'U_MIN' is a built-in parameter: its description and unit come from code and are reset on every start." } };
    const err = await updateCanonicalParameter('p1', { default_description: 'new' }).catch((e) => e);
    expect(calls[0]).toMatchObject({ method: 'PUT', body: { default_description: 'new' } });
    expect(calls[0].url).toMatch(/\/extraction-templates\/parameters\/p1$/);
    expect((err as { status?: number }).status).toBe(409);
    expect(errorMessage(err)).toMatch(/built-in parameter/);
  });
});

describe('duplicate rule name', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows the backend 409 text', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ detail: "Another rule in this template is already named 'Min voltage'." }), { status: 409 }));
    const { upsertTemplateRule } = await import('@/api/templates');
    const { errorMessage } = await import('@/lib/errors');
    const err = await upsertTemplateRule('t', { parameter_id: 'p', custom_alias: 'Min voltage' }).catch((e) => e);
    expect(errorMessage(err)).toContain("Another rule in this template is already named 'Min voltage'.");
  });
});
