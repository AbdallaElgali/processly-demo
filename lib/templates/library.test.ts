import { describe, expect, it } from 'vitest';
import type { ExtractionTemplateBase } from '@/api/templates';
import { projectTemplateOptions, ruleCountLabel } from './library';

const tpl = (over: Partial<ExtractionTemplateBase> = {}): ExtractionTemplateBase => ({
  id: 't1', name: 'Mine', user_id: 'me', customer_id: null, is_system_default: false, is_global: false, created_at: '2026-01-01', ...over,
});

describe('ruleCountLabel', () => {
  it('counts, and shows nothing while unknown', () => {
    expect(ruleCountLabel(undefined)).toBe('');
    expect(ruleCountLabel(0)).toBe('0 rules');
    expect(ruleCountLabel(1)).toBe('1 rule');
    expect(ruleCountLabel(27)).toBe('27 rules');
  });
});

describe('projectTemplateOptions', () => {
  const list = [tpl({ id: 'sys', name: 'System default', is_system_default: true, user_id: null }), tpl({ id: 'mine' })];

  it('preselects the user default when it is still in the list', () => {
    expect(projectTemplateOptions(list, { sys: 27, mine: 3 }, 'mine').selectedId).toBe('mine');
  });
  it('falls back to the system default when the default is unset or gone', () => {
    expect(projectTemplateOptions(list, {}, null).selectedId).toBe('sys');
    expect(projectTemplateOptions(list, {}, 'deleted').selectedId).toBe('sys');
  });
  it('shows each template with its rule count and marks the default', () => {
    const { options } = projectTemplateOptions(list, { sys: 27, mine: 3 }, 'mine');
    expect(options).toEqual([
      { id: 'sys', name: 'System default', rules: '27 rules', isDefault: false, isCustomerDefault: false },
      { id: 'mine', name: 'Mine', rules: '3 rules', isDefault: true, isCustomerDefault: false },
    ]);
  });
});

describe('customer default template (S4)', () => {
  const list = [tpl({ id: 'sys', is_system_default: true }), tpl({ id: 'mine' }), tpl({ id: 'cust' })];
  it('preselects the customer default over my default', () => {
    const r = projectTemplateOptions(list, {}, 'mine', 'cust');
    expect(r.selectedId).toBe('cust');
    expect(r.options.find((o) => o.id === 'cust')?.isCustomerDefault).toBe(true);
    expect(r.options.find((o) => o.id === 'mine')?.isDefault).toBe(true);
  });
  it('without a customer default, keeps the user default', () => {
    expect(projectTemplateOptions(list, {}, 'mine', null).selectedId).toBe('mine');
    expect(projectTemplateOptions(list, {}, 'mine').selectedId).toBe('mine');
  });
  it('ignores a customer default the user cannot see', () => {
    expect(projectTemplateOptions(list, {}, 'mine', 'gone').selectedId).toBe('mine');
  });
  it('falls back to the system default', () => {
    expect(projectTemplateOptions(list, {}, null, null).selectedId).toBe('sys');
  });
});
