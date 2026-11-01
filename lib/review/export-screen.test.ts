import { describe, expect, it } from 'vitest';
import type { InputField } from '@/types';
import type { ProjectParameter } from '@/api/projects';
import { dbParamToInputField } from '@/lib/parameter-adapter';
import { rowState } from '@/lib/review/rowState';
import {
  FrontendBatteryFileExport,
  exportName,
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

const generate = (fields: InputField[]) => new FrontendBatteryFileExport(null).generate(fields, 'P').content;

/** Reads the written <Value> of an entry, by entry name (alias, else key). */
const written = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`<Name>${name}</Name>[^<]*<Value>([^<]*)</Value>`))?.[1];

/** The unit written for an entry, if any. */
const writtenUnit = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`<Name>${name}</Name>[^<]*<Value>[^<]*</Value>[^<]*(?:<Unit>([^<]*)</Unit>)?`))?.[1];

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

  it('(h) no safety voltage is derived: a cleared one is the placeholder, a missing one is not written', () => {
    const fields = fieldsOf(
      param('U_MAX'),
      param('U_MAX_SAFETY', { is_human_modified: true, review_action: 'MODIFIED' }),
      param('U_MIN', { candidates: [candidate({ id: 'm', ai_value: 2.8 })] }),
    );
    const xml = generate(fields);
    expect(written(xml, 'U_MAX')).toBe('4.25');
    expect(written(xml, 'U_MAX_SAFETY')).toBe(PLACEHOLDER);
    expect(written(xml, 'U_MIN')).toBe('2.8');
    expect(written(xml, 'U_MIN_SAFETY')).toBeUndefined();
    expect(written(xml, 'U_MIN_SAFETY_DB')).toBeUndefined();
    expect(missingExportKeys(fields)).toEqual(['U_MAX_SAFETY']);
  });

  it.each([
    ['C_NOMINAL_AH', 'mAh', 3200, '3200'],
    ['E_NOMINAL_WH', 'kWh', 12.5, '12.5'],
    ['U_MAX', 'mV', 4250, '4250'],
    ['I_MAX_CHA_PULSE', 'mA', 1500, '1500'],
    ['I_MAX_DCH_PULSE', 'mA', -300000, '-300000'],
    ['T_MAX_BODY', '°C', 60, '60'],
    ['T_MIN_BODY', 'K', 5, '5'],
    ['I_MAX_CHA_PULSE', 'C', 2, '2'],
    ['EOL_SOH_NOM', '%', 80, '80'],
    ['U_MAX', '', 4.2, '4.2'],
  ])('%s with unit "%s" and value %s is written as %s, unit as shown, never converted', (key, unit, value, expected) => {
    const fields = fieldsOf(param(key, { candidates: [candidate({ ai_value: value, unit })] }));
    const xml = generate(fields);
    expect(written(xml, key)).toBe(expected);
    expect(writtenUnit(xml, key)).toBe((rowState(fields[0]).selected?.unit || undefined) as string | undefined);
    expect(missingExportKeys(fields)).not.toContain(key);
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

  it('the report lists exactly the parameters written as the placeholder', () => {
    const fields = fieldsOf(
      param('U_MAX'),
      param('U_MIN', { is_human_modified: true, review_action: 'MODIFIED' }),
      param('T_MIN_BODY', { candidates: [] }),
    );
    const xml = generate(fields);
    expect(exportReport(fields).missing).toEqual(['U_MIN', 'T_MIN_BODY']);
    for (const f of fields) {
      const isMissing = exportReport(fields).missing.includes(exportName(f));
      expect(written(xml, exportName(f)) === PLACEHOLDER, f.id).toBe(isMissing);
    }
  });
});

describe('export equals the review screen state (owner export rule)', () => {
  const cases: [string, ProjectParameter, string, string, string | undefined][] = [
    // [case, parameter, entry name, value shown on the review row ('' = none), unit shown]
    ['negative value', param('T_MIN_BODY', { parameter_alias: 'Min body temp', candidates: [candidate({ ai_value: -20, unit: '°C' })] }), 'Min body temp', '-20', '°C'],
    ['positive discharge current stays positive', param('I_MAX_DCH_PULSE', { parameter_alias: 'Pulse discharge', candidates: [candidate({ ai_value: 300, unit: 'A' })] }), 'Pulse discharge', '300', 'A'],
    ['unit that is not converted', param('C_NOMINAL_AH', { parameter_alias: 'Capacity', candidates: [candidate({ ai_value: 3200, unit: 'mAh', expected_unit: 'Ah' })] }), 'Capacity', '3200', 'mAh'],
    ['alias as the name', param('U_MAX', { parameter_alias: 'Upper cut-off voltage' }), 'Upper cut-off voltage', '4.25', 'V'],
    ['missing alias falls back to the canonical key', param('U_MAX', { parameter_alias: null }), 'U_MAX', '4.25', 'V'],
    ['cleared value', param('U_MAX', { parameter_alias: 'Cleared one', is_human_modified: true, review_action: 'MODIFIED' }), 'Cleared one', '', undefined],
  ];

  it.each(cases)('%s', (_n, p, name, shownValue, shownUnit) => {
    const [f] = fieldsOf(p);
    const shown = rowState(f).selected;
    // what the review row shows
    expect(displayed(f) ?? '').toBe(shownValue);
    if (shownValue) expect(shown?.unit).toBe(shownUnit);
    // what the file holds
    expect(exportName(f)).toBe(name);
    const xml = generate([f]);
    expect(written(xml, name)).toBe(shownValue || PLACEHOLDER);
    expect(writtenUnit(xml, name)).toBe(shownUnit);
    expect(missingExportKeys([f]).includes(name)).toBe(shownValue === '');
  });
});
