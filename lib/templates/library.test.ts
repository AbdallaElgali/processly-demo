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
      { id: 'sys', name: 'System default', rules: '27 rules', isDefault: false },
      { id: 'mine', name: 'Mine', rules: '3 rules', isDefault: true },
    ]);
  });
});
