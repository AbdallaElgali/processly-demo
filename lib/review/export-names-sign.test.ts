import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import { FrontendBatteryFileExport } from '@/static/battery-template';

const PLACEHOLDER = '99999999';

const field = (id: string, value: string, alias?: string | null, unit = ''): InputField => ({
  id, dbId: id, label: alias ?? id, parameter_alias: alias ?? null,
  specifications: [{
    id: `${id}-s`, candidateId: `${id}-s`, value, confidence: 90, unit, source: null,
    calculated: false, rule_passed: true, rule_violations: [], requires_review: false,
  }],
  selectedSpecId: `${id}-s`, isFlagged: false, flagReason: null, activeFlagId: null, reviewAction: 'PENDING',
});

const generate = (fields: InputField[]) => new FrontendBatteryFileExport(null).generate(fields, 'P').content;

const names = (xml: string): string[] => [...xml.matchAll(/<Name>([^<]*)<\/Name>/g)].map((m) => m[1]);
const written = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`<Name>${name}</Name>[^<]*<Value>([^<]*)</Value>`))?.[1];

describe('export entry names (owner decision: alias, else canonical key)', () => {
  it('a parameter with an alias is written under the alias, not the key or a fixed _DB name', () => {
    const xml = generate([field('U_MAX', '4.2', 'Upper cut-off voltage')]);
    expect(written(xml, 'Upper cut-off voltage')).toBe('4.2');
    expect(names(xml)).not.toContain('U_MAX');
    expect(names(xml)).not.toContain('U_MAX_DB');
  });

  it('a parameter without an alias is written under its canonical key (no _DB suffix)', () => {
    for (const alias of [null, undefined, '   ']) {
      const xml = generate([field('U_MAX', '4.2', alias)]);
      expect(written(xml, 'U_MAX')).toBe('4.2');
      expect(names(xml)).not.toContain('U_MAX_DB');
    }
  });

  it('a project parameter is written exactly once', () => {
    const all = names(generate([field('U_MAX', '4.2'), field('U_MIN', '2.8')]));
    expect(all.filter((n) => n === 'U_MAX')).toHaveLength(1);
    expect(all.filter((n) => n === 'U_MIN')).toHaveLength(1);
  });

  it('an empty project writes no parameter of its own', () => {
    const all = names(generate([]));
    expect(all).not.toContain('U_MAX');
    expect(all).not.toContain('U_MAX_DB');
  });
});

describe('sign and placeholder (owner decision: no forced sign)', () => {
  it.each(['I_MAX_DCH_PULSE', 'I_MAX_DCH_CONTINUOUS'])('%s: a positive value stays positive', (key) => {
    expect(written(generate([field(key, '300')]), key)).toBe('300');
  });

  it.each(['I_MAX_DCH_PULSE', 'I_MAX_DCH_CONTINUOUS'])('%s: a negative value stays negative', (key) => {
    expect(written(generate([field(key, '-300')]), key)).toBe('-300');
  });

  it('zero stays zero', () => {
    expect(written(generate([field('I_MAX_DCH_PULSE', '0')]), 'I_MAX_DCH_PULSE')).toBe('0');
  });

  it('charge currents are written as stored', () => {
    const xml = generate([field('I_MAX_CHA_PULSE', '200'), field('I_MAX_CHA_CONTINUOUS', '-50')]);
    expect(written(xml, 'I_MAX_CHA_PULSE')).toBe('200');
    expect(written(xml, 'I_MAX_CHA_CONTINUOUS')).toBe('-50');
  });

  it('a cleared value is the same positive placeholder for every parameter', () => {
    const xml = generate([field('I_MAX_DCH_PULSE', ''), field('T_MIN_BODY', ''), field('U_MAX', '')]);
    expect(written(xml, 'I_MAX_DCH_PULSE')).toBe(PLACEHOLDER);
    expect(written(xml, 'T_MIN_BODY')).toBe(PLACEHOLDER);
    expect(written(xml, 'U_MAX')).toBe(PLACEHOLDER);
  });
});
