/**
 * Quick preview of the battery export: prints every parameter as a table and
 * shows what changed since the last run.
 *
 *   npx tsx scripts\export-preview.ts
 *
 * First run saves a baseline (export-preview.baseline.json). After you change
 * the exporter, run again to see added / removed / changed parameters.
 * Delete the baseline file to start over.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InputField } from '../../types/index';
import { FrontendBatteryFileExport } from '../../static/battery-template';

// --- dummy input: one accepted candidate per parameter ----------------------
function field(id: string, value: string, unit: string, category = 'Other'): InputField {
  return {
    id,
    dbId: `pp-${id}`,
    label: id,
    category,
    specifications: [{
      id: `cand-${id}`, candidateId: `cand-${id}`, value, unit, confidence: 90, source: null,
      calculated: false, rule_passed: true, rule_violations: [], requires_review: false,
    }],
    selectedSpecId: `cand-${id}`,
    isFlagged: false,
    flagReason: null,
    activeFlagId: null,
    reviewAction: 'ACCEPTED',
  };
}

const FIELDS: InputField[] = [
  field('U_MIN', '2.5', 'V', 'Voltage'),
  field('U_MAX', '4.2', 'V', 'Voltage'),
  field('U_MIN_SAFETY', '2.3', 'V', 'Voltage'),
  field('U_MAX_SAFETY', '4.25', 'V', 'Voltage'),
  field('I_MAX_CHA_CONTINUOUS', '60', 'A', 'Current'),
  field('I_MAX_DCH_CONTINUOUS', '120', 'A', 'Current'),
  field('I_MAX_CHA_PULSE', '180', 'A', 'Current'),
  field('I_MAX_DCH_PULSE', '300', 'A', 'Current'),
  field('T_MAX_BODY', '55', '°C', 'Temperature'),
  field('T_MIN_BODY', '-20', '°C', 'Temperature'),
  field('C_NOMINAL_AH', '60', 'Ah', 'Capacity'),
  field('E_NOMINAL_WH', '219', 'Wh', 'Capacity'),
  field('EOL_SOH_NOM', '80', '%', 'Capacity'),
  // Not in the current export. Should show up once the export is dynamic:
  field('U_MIN_DYN', '2.8', 'V', 'Voltage'),
  field('R_INT_25C', '1.8', 'mOhm', 'Resistance'),
  // Empty value/ unit should be exported as placeholder
    field('U_MIN_SAFETY_DYN', '', '', 'Voltage'),
    field('I_MAX_DCH_PULSE_DYN', '', '', 'Current'),
    field('T_MAX_BODY_DYN', '', '', 'Temperature'),
];

// --- generate + parse -------------------------------------------------------
const { content, filename } = new FrontendBatteryFileExport(null, { devTestMode: true }).generate(FIELDS, 'Preview');
writeFileSync(join(__dirname, filename), content, 'utf8');

type Row = { name: string; value: string; unit: string };
const rows: Row[] = [...content.matchAll(/<BatteryParameter>([\s\S]*?)<\/BatteryParameter>/g)].map(m => {
  const tag = (t: string) => m[1].match(new RegExp(`<${t}>(.*?)</${t}>`))?.[1] ?? '';
  return { name: tag('Name'), value: tag('Value'), unit: tag('Unit') };
});

console.log(`\n${filename}: ${rows.length} parameters\n`);
console.table(rows);

// --- diff against last saved run --------------------------------------------
const baselinePath = join(__dirname, 'export-preview.baseline.json');
if (!existsSync(baselinePath)) {
  writeFileSync(baselinePath, JSON.stringify(rows, null, 2));
  console.log(`Baseline saved -> ${baselinePath}`);
} else {
  const before = new Map((JSON.parse(readFileSync(baselinePath, 'utf8')) as Row[]).map(r => [r.name, r]));
  const after = new Map(rows.map(r => [r.name, r]));
  const added = rows.filter(r => !before.has(r.name));
  const removed = [...before.values()].filter(r => !after.has(r.name));
  const changed = rows.filter(r => before.has(r.name) && before.get(r.name)!.value !== r.value);

  console.log('\nCompared to baseline:');
  added.forEach(r => console.log(`  + ${r.name} = ${r.value} ${r.unit}`));
  removed.forEach(r => console.log(`  - ${r.name}`));
  changed.forEach(r => console.log(`  ~ ${r.name}: ${before.get(r.name)!.value} -> ${r.value}`));
  if (!added.length && !removed.length && !changed.length) console.log('  (no differences)');
}