import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import type { ProjectParameter } from '@/api/projects';
import { dbParamToInputField } from '@/lib/parameter-adapter';
import { rowState } from '@/lib/review/rowState';
import {
  BATTERY_EXPORT_KEYS,
  FrontendBatteryFileExport,
  exportReport,
  missingExportKeys,
} from '@/static/battery-template';

const PLACEHOLDER = '99999999';

const candidate = (over: Record<string, unknown> = {}) => ({
  id: 'c1', ai_value: 4.25, expected_unit: 'V', unit: 'V', confidence: 0.9,
  source_document_id: 'doc-1', source_page_number: 2, source_text_snippet: 'x',
  extraction_logic: 'because', rule_violations: [], requires_review: false, run_number: 1, ...over,
});

const param = (key: string, over: Record<string, unknown> = {}): ProjectParameter =>
  ({
    id: `pp-${key}`, parameter_key: key, parameter_alias: key, parameter_id: `p-${key}`,
    final_value: null, final_unit: null, selected_candidate_id: null,
    is_human_modified: false, review_action: 'PENDING', candidates: [candidate()],
    ...over,
  }) as unknown as ProjectParameter;

const fieldsOf = (...params: ProjectParameter[]): InputField[] => params.map(dbParamToInputField);

const generate = (fields: InputField[]) => new FrontendBatteryFileExport().generate(fields, 'P').content;

/** Reads the written <Value> of an entry, by entry name. */
const written = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`<Name>${BATTERY_EXPORT_KEYS.find((e) => e.key === name)?.exportName ?? name}</Name>\\s*<Value>([^<]*)</Value>`))?.[1];

const placeholderFor = (key: string) => (key.startsWith('T_MIN_') ? `-${PLACEHOLDER}` : PLACEHOLDER);

/** What the review row displays for a field: its value, or nothing. */
const displayed = (f: InputField): string | null => {
  const v = rowState(f).selected?.value;
  return v === undefined || v === null || String(v).trim() === '' ? null : String(v);
};

describe('export matches the review screen (FE-R2)', () => {
  it.each([
    ['(a) reviewer-cleared', param('U_MAX', { is_human_modified: true, review_action: 'MODIFIED' })],
    ['(b) legacy: cleared but selected_candidate_id still set', param('U_MAX', { is_human_modified: true, review_action: 'MODIFIED', selected_candidate_id: 'c1' })],
    ['(d) AI row with no value', param('U_MAX', { candidates: [candidate({ ai_value: null, extraction_logic: 'NOT_FOUND' })] })],
    ['(e) never extracted', param('U_MAX', { candidates: [] })],
  ])('%s is written as the placeholder and listed', (_n, p) => {
    const fields = fieldsOf(p);
    expect(displayed(fields[0])).toBeNull();
    expect(written(generate(fields), 'U_MAX')).toBe(PLACEHOLDER);
    expect(missingExportKeys(fields)).toContain('U_MAX');
  });

  it('(c) AI-only row writes the candidate the row shows', () => {
    const fields = fieldsOf(param('U_MAX'));
    expect(displayed(fields[0])).toBe('4.25');
    expect(written(generate(fields), 'U_MAX')).toBe('4.25');
    expect(missingExportKeys(fields)).not.toContain('U_MAX');
  });

  it('(f) human row with a typed value writes that value', () => {
    const fields = fieldsOf(param('U_MAX', { is_human_modified: true, review_action: 'MODIFIED', final_value: 4.1, final_unit: 'V', selected_candidate_id: 'c1' }));
    expect(displayed(fields[0])).toBe('4.1');
    expect(written(generate(fields), 'U_MAX')).toBe('4.1');
  });

  it('(g) human row that selected an AI candidate writes that candidate', () => {
    const fields = fieldsOf(param('U_MAX', {
      is_human_modified: false, review_action: 'ACCEPTED', selected_candidate_id: 'c2', final_value: 4.3, final_unit: 'V',
      candidates: [candidate(), candidate({ id: 'c2', ai_value: 4.3 })],
    }));
    expect(displayed(fields[0])).toBe('4.3');
    expect(written(generate(fields), 'U_MAX')).toBe('4.3');
  });

  it('(h) a cleared safety voltage is the placeholder, never U_MAX + 0.02 / U_MIN - 0.02', () => {
    const fields = fieldsOf(
      param('U_MAX'),
      param('U_MAX_SAFETY', { is_human_modified: true, review_action: 'MODIFIED' }),
      param('U_MIN', { candidates: [candidate({ id: 'm', ai_value: 2.8 })] }),
    );
    const xml = generate(fields);
    expect(written(xml, 'U_MAX')).toBe('4.25');
    expect(written(xml, 'U_MAX_SAFETY')).toBe(PLACEHOLDER);
    // no U_MIN_SAFETY row at all: also the placeholder
    expect(written(xml, 'U_MIN_SAFETY_DB')).toBe(PLACEHOLDER);
    expect(missingExportKeys(fields)).toEqual(expect.arrayContaining(['U_MAX_SAFETY', 'U_MIN_SAFETY']));
  });

  it('(i) mAh is written in Ah without floating artefacts', () => {
    const fields = fieldsOf(param('C_NOMINAL_AH', { candidates: [candidate({ ai_value: 3200, unit: 'mAh', expected_unit: 'Ah' })] }));
    expect(written(generate(fields), 'C_NOMINAL_AH')).toBe('3.2');
    expect(missingExportKeys(fields)).not.toContain('C_NOMINAL_AH');
  });

  it.each([
    ['E_NOMINAL_WH', 'kWh', 12.5, '12500'],
    ['E_NOMINAL_WH', 'mWh', 250000, '250'],
    ['U_MAX', 'mV', 4250, '4.25'],
    ['U_MAX', ' v ', 4.2, '4.2'],
    ['I_MAX_CHA_PULSE', 'mA', 1500, '1.5'],
    ['I_MAX_DCH_PULSE', 'mA', -300000, '-300'],
    ['C_NOMINAL_AH', 'AH', 2.5, '2.5'],
    ['C_NOMINAL_AH', 'mAh', 0.1, '0.0001'],
    ['T_MAX_BODY', 'degC', 60, '60'],
    ['T_MAX_BODY', '°C', 60, '60'],
    ['T_MIN_BODY', 'C', -20, '-20'],
    ['EOL_SOH_NOM', '%', 80, '80'],
    ['U_MAX', '', 4.2, '4.2'],
  ])('%s with unit "%s" and value %s is written as %s', (key, unit, value, expected) => {
    const fields = fieldsOf(param(key, { candidates: [candidate({ ai_value: value, unit })] }));
    expect(written(generate(fields), key)).toBe(expected);
    expect(missingExportKeys(fields)).not.toContain(key);
  });

  it('(j) an unconvertible unit is the placeholder and is reported with its unit', () => {
    const fields = fieldsOf(
      param('C_NOMINAL_AH', { candidates: [candidate({ ai_value: 3.2, unit: 'Wh' })] }),
      param('T_MIN_BODY', { candidates: [candidate({ ai_value: 5, unit: 'K' })] }),
      param('I_MAX_CHA_PULSE', { candidates: [candidate({ ai_value: 2, unit: 'C' })] }),
    );
    const xml = generate(fields);
    expect(written(xml, 'C_NOMINAL_AH')).toBe(PLACEHOLDER);
    expect(written(xml, 'T_MIN_BODY')).toBe(`-${PLACEHOLDER}`);
    // "C" is a temperature only for T_* keys; for a current it is a C-rate and is not converted
    expect(written(xml, 'I_MAX_CHA_PULSE')).toBe(PLACEHOLDER);
    expect(exportReport(fields).unconvertible).toEqual([
      { key: 'C_NOMINAL_AH', unit: 'Wh' },
      { key: 'I_MAX_CHA_PULSE', unit: 'C' },
      { key: 'T_MIN_BODY', unit: 'K' },
    ]);
    expect(missingExportKeys(fields)).toEqual(expect.arrayContaining(['C_NOMINAL_AH', 'T_MIN_BODY', 'I_MAX_CHA_PULSE']));
  });

  it('keeps the stored sign of discharge currents', () => {
    const fields = fieldsOf(param('I_MAX_DCH_PULSE', { candidates: [candidate({ ai_value: -300, unit: 'A' })] }));
    expect(written(generate(fields), 'I_MAX_DCH_PULSE')).toBe('-300');
  });

  it('whitespace is not a value', () => {
    const fields = fieldsOf(param('U_MAX', { candidates: [candidate({ ai_value: '  ' })] }));
    expect(written(generate(fields), 'U_MAX')).toBe(PLACEHOLDER);
    expect(missingExportKeys(fields)).toContain('U_MAX');
  });

  it('every key missingExportKeys returns is the placeholder; every other mapped key is a real value', () => {
    const fields = fieldsOf(
      param('U_MAX'),
      param('U_MIN', { is_human_modified: true, review_action: 'MODIFIED', selected_candidate_id: 'c1' }),
      param('C_NOMINAL_AH', { candidates: [candidate({ ai_value: 3200, unit: 'mAh' })] }),
      param('E_NOMINAL_WH', { candidates: [candidate({ ai_value: 10, unit: 'Ah' })] }),
      param('T_MAX_BODY', { candidates: [candidate({ ai_value: 55, unit: '°C' })] }),
      param('T_MIN_BODY', { candidates: [] }),
      param('I_MAX_CHA_PULSE', { candidates: [candidate({ ai_value: 100, unit: 'A' })] }),
    );
    const xml = generate(fields);
    const missing = new Set(missingExportKeys(fields));
    expect(missing.size).toBeGreaterThan(0);
    for (const { key, exportName } of BATTERY_EXPORT_KEYS) {
      const v = written(xml, key) ?? written(xml, exportName);
      expect(v, key).toBeDefined();
      if (missing.has(key)) expect(v, key).toBe(placeholderFor(key));
      else {
        expect(v, key).not.toBe(placeholderFor(key));
        const f = fields.find((x) => x.id === key)!;
        expect(Number.isFinite(Number(v)), key).toBe(true);
        expect(displayed(f), key).not.toBeNull();
      }
    }
    // the dialog's two lists together are exactly the placeholder keys
    const report = exportReport(fields);
    expect(new Set([...report.missing, ...report.unconvertible.map((u) => u.key)])).toEqual(missing);
  });
});
