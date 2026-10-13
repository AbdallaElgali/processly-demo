import { describe, expect, it } from 'vitest';
import type { CanonicalParameter, ExtractionTemplateBase, TemplateRule } from '@/api/templates';
import { buildRuleUpsert, draftFromRule, parametersWithoutRule, templateAccess, templateScope, validateRuleAlias } from './rules';

const tpl = (over: Partial<ExtractionTemplateBase> = {}): ExtractionTemplateBase => ({
  id: 't1', name: 'Mine', user_id: 'me', customer_id: null, is_system_default: false, is_global: false, created_at: '2026-01-01', ...over,
});
const rule = (over: Partial<TemplateRule> = {}): TemplateRule => ({
  id: 'r1', template_id: 't1', parameter_id: 'p1', canonical_name: 'U_MIN', custom_alias: 'Min voltage', is_active: true,
  description_override: null, ai_instructions: null, expected_unit_override: null, ...over,
});

describe('templateAccess', () => {
  it('lets a user edit their own template only', () => {
    expect(templateAccess(tpl(), 'me').editable).toBe(true);
    expect(templateAccess(tpl({ user_id: 'other' }), 'me')).toMatchObject({ editable: false, reason: expect.stringMatching(/someone else/) });
    expect(templateAccess(tpl(), undefined).editable).toBe(false);
  });
  it('makes the system default read-only even when the user is its owner', () => {
    expect(templateAccess(tpl({ is_system_default: true }), 'me')).toMatchObject({ editable: false, reason: expect.stringMatching(/System default/) });
  });
});

describe('templateScope', () => {
  it('names the template the way a reviewer would', () => {
    expect(templateScope(tpl({ is_system_default: true }), 'me')).toBe('System');
    expect(templateScope(tpl(), 'me')).toBe('Personal');
    expect(templateScope(tpl({ is_global: true }), 'me')).toBe('Global');
    expect(templateScope(tpl({ user_id: 'other', is_global: true }), 'me')).toBe('Global');
    expect(templateScope(tpl({ user_id: 'other' }), 'me')).toBe('Shared');
  });
});

describe('parametersWithoutRule', () => {
  it('offers only parameters the template has no rule for', () => {
    const canonical = [{ id: 'p1' }, { id: 'p2' }] as CanonicalParameter[];
    expect(parametersWithoutRule(canonical, [rule()]).map((p) => p.id)).toEqual(['p2']);
  });
});

describe('validateRuleAlias', () => {
  const rules = [rule(), rule({ id: 'r2', parameter_id: 'p2', custom_alias: 'Max voltage' })];
  it('rejects empty, over-long and duplicate aliases', () => {
    expect(validateRuleAlias(' ', rules)).toMatch(/empty/);
    expect(validateRuleAlias('x'.repeat(101), rules)).toMatch(/100/);
    expect(validateRuleAlias('Max voltage', rules)).toMatch(/already uses/);
  });
  it('lets a rule keep its own alias', () => {
    expect(validateRuleAlias('Min voltage', rules, 'r1')).toBeNull();
    expect(validateRuleAlias('Max voltage', rules, 'r1')).toMatch(/already uses/);
  });
});

describe('buildRuleUpsert', () => {
  it('round-trips the expected unit override, which the upsert would otherwise erase', () => {
    const body = buildRuleUpsert(draftFromRule(rule({ expected_unit_override: 'V' })));
    expect(body.expected_unit_override).toBe('V');
  });
  it('sends a blank text as null, trims, and always sends every field', () => {
    const body = buildRuleUpsert({ parameterId: 'p1', alias: ' A ', description: '  ', aiInstructions: 'x', expectedUnit: '', active: false });
    expect(body).toEqual({
      parameter_id: 'p1', custom_alias: 'A', is_active: false,
      description_override: null, ai_instructions: 'x', expected_unit_override: null,
    });
  });
});
