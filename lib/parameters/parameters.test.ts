import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import type { CanonicalParameter } from '@/api/templates';
import { ALIAS_MAX, buildParameterPatch, matchesQuery, metaOf, parametersNotInProject, validateAlias } from './meta';
import { errorMessage } from '@/lib/errors';

const field = (over: Partial<InputField> = {}): InputField => ({
  id: 'U_MIN',
  dbId: 'row-1',
  label: 'Min voltage',
  parameter_alias: 'Min voltage',
  description_override: null,
  ai_instructions: null,
  specifications: [],
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
  ...over,
});
const canon = (name: string, over: Partial<CanonicalParameter> = {}): CanonicalParameter => ({
  id: name, name, category: 'Voltage', default_description: null, expected_unit: null, ...over,
});

describe('metaOf', () => {
  it('falls back to the label, then the key, when there is no alias', () => {
    expect(metaOf(field({ parameter_alias: null })).alias).toBe('Min voltage');
    expect(metaOf(field({ parameter_alias: null, label: '' })).alias).toBe('U_MIN');
  });
  it('turns missing texts into empty strings', () => {
    expect(metaOf(field())).toEqual({ alias: 'Min voltage', description: '', aiInstructions: '' });
  });
});

describe('validateAlias', () => {
  it('rejects blank and over-long aliases', () => {
    expect(validateAlias('   ')).toMatch(/empty/);
    expect(validateAlias('x'.repeat(ALIAS_MAX + 1))).toMatch(/50/);
    expect(validateAlias('x'.repeat(ALIAS_MAX))).toBeNull();
  });
});

describe('buildParameterPatch (the backend COALESCEs: null leaves a column alone)', () => {
  const current = { alias: 'Min voltage', description: 'old', aiInstructions: '' };

  it('returns null when nothing changed, ignoring surrounding whitespace', () => {
    expect(buildParameterPatch(current, { ...current, alias: '  Min voltage ' })).toBeNull();
  });
  it('sends only what changed and null for the rest', () => {
    expect(buildParameterPatch(current, { ...current, aiInstructions: 'Use the table' })).toEqual({
      parameter_alias: null,
      description_override: null,
      ai_instructions: 'Use the table',
    });
  });
  it('clears a text by sending an empty string, never null', () => {
    expect(buildParameterPatch(current, { ...current, description: '  ' })).toEqual({
      parameter_alias: null,
      description_override: '',
      ai_instructions: null,
    });
  });
});

describe('matchesQuery', () => {
  it('matches key, alias, own text and the dictionary default, ignoring case', () => {
    const f = field({ description_override: 'Cut-off at low state of charge' });
    expect(matchesQuery(f, undefined, 'u_min')).toBe(true);
    expect(matchesQuery(f, undefined, 'MIN VOLT')).toBe(true);
    expect(matchesQuery(f, undefined, 'state of charge')).toBe(true);
    expect(matchesQuery(field(), canon('U_MIN', { default_description: 'Lower voltage limit' }), 'lower voltage')).toBe(true);
    expect(matchesQuery(f, undefined, 'temperature')).toBe(false);
    expect(matchesQuery(f, undefined, '   ')).toBe(true);
  });
});

describe('parametersNotInProject', () => {
  it('lists dictionary entries the project lacks', () => {
    const list = parametersNotInProject([canon('U_MIN'), canon('U_MAX'), canon('T_MAX')], [field({ id: 'U_MIN' })]);
    expect(list.map((p) => p.name)).toEqual(['U_MAX', 'T_MAX']);
  });
});

describe('errorMessage', () => {
  it('unwraps the backend detail', () => {
    expect(errorMessage(new Error('{"detail":"duplicate alias"}'))).toBe('duplicate alias');
    expect(errorMessage(new Error('{"detail":[{"msg":"field required"}]}'))).toBe('field required');
  });
  it('keeps plain text and falls back when empty', () => {
    expect(errorMessage(new Error('Failed to fetch'))).toBe('Failed to fetch');
    expect(errorMessage(undefined, 'nope')).toBe('nope');
  });
});
