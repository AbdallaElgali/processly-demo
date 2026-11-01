import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import { FrontendBatteryFileExport, missingExportKeys } from '@/static/battery-template';

const field = (id: string, value: string, alias?: string): InputField => ({
  id,
  dbId: id,
  label: alias ?? id,
  parameter_alias: alias ?? null,
  specifications: [{
    id: `${id}-s`, candidateId: `${id}-s`, value, confidence: 90, unit: '', source: null,
    calculated: false, rule_passed: true, rule_violations: [], requires_review: false,
  }],
  selectedSpecId: `${id}-s`,
  isFlagged: false,
  flagReason: null,
  activeFlagId: null,
  reviewAction: 'PENDING',
});

const valueOf = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`<Name>${name}</Name>[^<]*<Value>([^<]*)</Value>`))?.[1];

describe('.battery export (D8, AM7)', () => {
  it('lists the project parameters with no numeric value, in project order', () => {
    const fields = [field('U_MAX', '4.2'), field('U_MIN', ''), field('C_NOMINAL_AH', 'n/a')];
    expect(missingExportKeys(fields)).toEqual(['U_MIN', 'C_NOMINAL_AH']);
  });

  it('writes discharge currents with the sign they are stored with', () => {
    const { content } = new FrontendBatteryFileExport(null).generate(
      [field('I_MAX_DCH_PULSE', '-300'), field('I_MAX_DCH_CONTINUOUS', '-150')],
      'P',
    );
    expect(valueOf(content, 'I_MAX_DCH_PULSE')).toBe('-300');
    expect(valueOf(content, 'I_MAX_DCH_CONTINUOUS')).toBe('-150');
  });

  it('writes no entry for a parameter the project does not have', () => {
    const { content } = new FrontendBatteryFileExport(null).generate([], 'P');
    expect(valueOf(content, 'U_MAX')).toBeUndefined();
    expect(valueOf(content, 'U_MAX_DB')).toBeUndefined();
    expect(valueOf(content, 'I_MAX_DCH_30S_DB')).toBeUndefined();
  });
});
