import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import {
  BATTERY_EXPORT_KEYS,
  FrontendBatteryFileExport,
  missingExportKeys,
} from '@/static/battery-template';

const field = (id: string, value: string, label = id): InputField => ({
  id,
  dbId: id,
  label,
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
  xml.match(new RegExp(`<Name>${BATTERY_EXPORT_KEYS.find((e) => e.key === name)?.exportName ?? name}</Name>\\s*<Value>([^<]*)</Value>`))?.[1];

describe('.battery export (D8, AM7)', () => {
  it('lists every mapped key with no numeric value, in key-map order', () => {
    const fields = [field('U_MAX', '4.2'), field('U_MIN', ''), field('C_NOMINAL_AH', 'n/a')];
    const missing = missingExportKeys(fields);
    expect(missing).toContain('U_MIN');
    expect(missing).toContain('C_NOMINAL_AH');
    expect(missing).not.toContain('U_MAX');
    expect(missing).toHaveLength(BATTERY_EXPORT_KEYS.length - 1);
  });

  it('writes discharge currents with the sign they are stored with (no double negation)', () => {
    const { content } = new FrontendBatteryFileExport().generate(
      [field('I_MAX_DCH_PULSE', '-300'), field('I_MAX_DCH_CONTINUOUS', '-150')],
      'P',
    );
    expect(valueOf(content, 'I_MAX_DCH_PULSE')).toBe('-300');
    expect(valueOf(content, 'I_MAX_DCH_CONTINUOUS')).toBe('-150');
  });

  it('falls back to the explicit export name when the project lacks the parameter', () => {
    const { content } = new FrontendBatteryFileExport().generate([], 'P');
    expect(valueOf(content, 'I_MAX_DCH_30S_DB')).toBe('99999999');
    expect(valueOf(content, 'U_MAX_DB')).toBe('99999999');
  });
});
