import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractionTemplateBase, TemplateRule } from '@/api/templates';
import { errorMessage } from '@/lib/errors';
import { SAVE_AS_TEMPLATE_AVAILABLE, copyName, ruleCopies, templateAccess } from './rules';

const tpl = (over: Partial<ExtractionTemplateBase> = {}): ExtractionTemplateBase => ({
  id: 't1', name: 'System default', user_id: null, customer_id: null, is_system_default: true, is_global: true, created_at: '2026-01-01', ...over,
});
const rule = (over: Partial<TemplateRule> = {}): TemplateRule => ({
  id: 'r1', template_id: 't1', parameter_id: 'p1', canonical_name: 'U_MIN', custom_alias: 'Min voltage', is_active: true,
  description_override: 'desc', ai_instructions: 'ai', expected_unit_override: 'V', ...over,
});

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let respond: (c: Call) => { status: number; body: unknown };
beforeEach(() => {
  calls = [];
  respond = () => ({ status: 200, body: {} });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call = { url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const r = respond(call);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('save project as template (3.3)', () => {
  it('is switched on', () => {
    expect(SAVE_AS_TEMPLATE_AVAILABLE).toBe(true);
  });

  it('posts project_id, user_id and the name', async () => {
    const { createTemplateFromProject } = await import('@/api/templates');
    respond = () => ({ status: 201, body: tpl({ is_system_default: false, id: 'new' }) });
    const made = await createTemplateFromProject({ project_id: 'pid', user_id: 'uid', new_template_name: 'Mine' });
    expect(calls[0].url).toMatch(/\/extraction-templates\/from-project$/);
    expect(calls[0].body).toEqual({ project_id: 'pid', user_id: 'uid', new_template_name: 'Mine' });
    expect(made.id).toBe('new');
  });

  it.each([
    [404, 'Project not found'],
    [422, 'The project has no parameters to copy'],
    [422, 'Unknown user_id'],
  ])('shows the backend text for %i: %s', async (status, detail) => {
    const { createTemplateFromProject } = await import('@/api/templates');
    respond = () => ({ status, body: { detail } });
    const err = await createTemplateFromProject({ project_id: 'p', user_id: 'u', new_template_name: 'n' }).catch((e) => e);
    expect(errorMessage(err)).toContain(detail);
  });
});

describe('the system default is copied, not edited (3.4)', () => {
  it('offers a copy for the system default only', () => {
    expect(templateAccess(tpl(), 'me')).toMatchObject({ editable: false, copyable: true });
    expect(templateAccess(tpl({ is_system_default: false, user_id: 'me' }), 'me')).toMatchObject({ editable: true, copyable: false });
    expect(templateAccess(tpl({ is_system_default: false, user_id: 'other' }), 'me')).toMatchObject({ editable: false, copyable: false });
  });

  it('names the copy and copies every column of every rule', () => {
    expect(copyName('System default')).toBe('System default (copy)');
    const copies = ruleCopies([rule(), rule({ id: 'r2', parameter_id: 'p2', is_active: false, description_override: null, expected_unit_override: null })]);
    expect(copies).toEqual([
      { parameter_id: 'p1', custom_alias: 'Min voltage', is_active: true, description_override: 'desc', ai_instructions: 'ai', expected_unit_override: 'V' },
      { parameter_id: 'p2', custom_alias: 'Min voltage', is_active: false, description_override: null, ai_instructions: 'ai', expected_unit_override: null },
    ]);
  });

  it('saveTemplateCopy creates the template, then upserts each rule into it', async () => {
    const { saveTemplateCopy } = await import('@/lib/templates/copy');
    respond = (c) => (c.method === 'POST' ? { status: 201, body: tpl({ id: 'copy', is_system_default: false, user_id: 'me' }) } : { status: 200, body: {} });
    const made = await saveTemplateCopy('me', tpl(), [rule(), rule({ id: 'r2', parameter_id: 'p2' })]);
    expect(made.id).toBe('copy');
    expect(calls[0].body).toEqual({ name: 'System default (copy)', user_id: 'me', is_global: false });
    expect(calls.slice(1).map((c) => [c.method, c.url.split('/extraction-templates')[1]])).toEqual([['PUT', '/copy/rules'], ['PUT', '/copy/rules']]);
    expect((calls[1].body as { parameter_id: string }).parameter_id).toBe('p1');
  });

  it('if the backend still answers 403, its text is shown', async () => {
    const { deleteTemplate } = await import('@/api/templates');
    const detail = 'The system default template cannot be changed or deleted. Save a copy as your own template instead.';
    respond = () => ({ status: 403, body: { detail } });
    expect(errorMessage(await deleteTemplate('t1').catch((e) => e))).toContain(detail);
  });
});
