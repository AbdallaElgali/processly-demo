import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import { BATTERY_EXPORT_KEYS, FrontendBatteryFileExport } from '@/static/battery-template';

const PLACEHOLDER = '99999999';

const field = (id: string, value: string, label = id): InputField => ({
  id, dbId: id, label,
  specifications: [{
    id: `${id}-s`, candidateId: `${id}-s`, value, confidence: 90, unit: '', source: null,
    calculated: false, rule_passed: true, rule_violations: [], requires_review: false,
  }],
  selectedSpecId: `${id}-s`, isFlagged: false, flagReason: null, activeFlagId: null, reviewAction: 'PENDING',
});

const generate = (fields: InputField[]) => new FrontendBatteryFileExport().generate(fields, 'P').content;

const names = (xml: string): string[] => [...xml.matchAll(/<Name>([^<]*)<\/Name>/g)].map((m) => m[1]);
const written = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`<Name>${name}</Name>\\s*<Value>([^<]*)</Value>`))?.[1];

const nameOf = (key: string) => BATTERY_EXPORT_KEYS.find((e) => e.key === key)!.exportName;

describe('export entry names (owner decision 2026-10-15)', () => {
  it('every mapped key appears exactly once under its exportName, even with custom labels', () => {
    const fields = BATTERY_EXPORT_KEYS.map(({ key }) => field(key, '1', `My label for ${key}`));
    const xml = generate(fields);
    const all = names(xml);
    for (const { exportName } of BATTERY_EXPORT_KEYS) {
      expect(all.filter((n) => n === exportName), exportName).toHaveLength(1);
    }
    expect(all.some((n) => n.startsWith('My label'))).toBe(false);
  });

  it('a parameter the project added with a custom alias still uses the key-file name', () => {
    const xml = generate([field('U_MAX', '4.2', 'Upper cut-off voltage')]);
    expect(written(xml, 'U_MAX_DB')).toBe('4.2');
    expect(xml).not.toContain('Upper cut-off voltage');
  });

  it('writes the key-file names with an empty project too', () => {
    const all = names(generate([]));
    for (const { exportName } of BATTERY_EXPORT_KEYS) expect(all).toContain(exportName);
  });
});

describe('discharge current sign (owner decision 2026-10-15)', () => {
  it.each(['I_MAX_DCH_PULSE', 'I_MAX_DCH_CONTINUOUS'])('%s: positive in the project is written negative', (key) => {
    expect(written(generate([field(key, '300')]), nameOf(key))).toBe('-300');
  });

  it.each(['I_MAX_DCH_PULSE', 'I_MAX_DCH_CONTINUOUS'])('%s: already negative is not double-negated', (key) => {
    expect(written(generate([field(key, '-300')]), nameOf(key))).toBe('-300');
  });

  it('zero stays zero (not -0)', () => {
    expect(written(generate([field('I_MAX_DCH_PULSE', '0')]), nameOf('I_MAX_DCH_PULSE'))).toBe('0');
  });

  it('charge currents are written as stored', () => {
    const xml = generate([field('I_MAX_CHA_PULSE', '200'), field('I_MAX_CHA_CONTINUOUS', '-50')]);
    expect(written(xml, nameOf('I_MAX_CHA_PULSE'))).toBe('200');
    expect(written(xml, nameOf('I_MAX_CHA_CONTINUOUS'))).toBe('-50');
  });

  it('the discharge placeholder stays positive; T_MIN placeholder stays negative', () => {
    const xml = generate([]);
    expect(written(xml, nameOf('I_MAX_DCH_PULSE'))).toBe(PLACEHOLDER);
    expect(written(xml, nameOf('I_MAX_DCH_CONTINUOUS'))).toBe(PLACEHOLDER);
    expect(written(xml, nameOf('T_MIN_BODY'))).toBe(`-${PLACEHOLDER}`);
  });

  it('a cleared discharge row writes the positive placeholder', () => {
    expect(written(generate([field('I_MAX_DCH_PULSE', '')]), nameOf('I_MAX_DCH_PULSE'))).toBe(PLACEHOLDER);
  });
});
