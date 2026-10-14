import { InputField } from '@/types';
import { hasValue, selectedSpec } from '@/lib/review/rowState';

/**
 * `.battery` export (decision D8, AM7).
 *
 * A fixed downstream format, so it has its OWN explicit key map: which project
 * parameter feeds which exported entry. It is deliberately independent of the
 * category grouping and of the removed SCHEMA_GROUPS.
 *
 * `exportName` is the entry name written when the project has no such
 * parameter. When it does, the parameter's label is written instead -- that
 * is the pre-existing behaviour, kept unchanged in step 8 and recorded as an
 * open question (the known-good key files use the `_DB` names).
 *
 * Sign convention: discharge currents (I_MAX_DCH_*) are written exactly as
 * stored. This exporter never negates them (AM7 checked for a double
 * negation; there is none). Whether the downstream tool expects them negative
 * is an open question for the owner -- do not change it without asking.
 */
export const BATTERY_EXPORT_KEYS: ReadonlyArray<{ key: string; exportName: string }> = [
  { key: 'C_NOMINAL_AH', exportName: 'C_NOMINAL_AH_DB' },
  { key: 'E_NOMINAL_WH', exportName: 'E_NOMINAL_WH_DB' },
  { key: 'EOL_SOH_NOM', exportName: 'EOL' },
  { key: 'I_MAX_CHA_PULSE', exportName: 'I_MAX_CHA_30S_DB' },
  { key: 'I_MAX_CHA_CONTINUOUS', exportName: 'I_MAX_CHA_CONTINUOUS_DB' },
  { key: 'I_MAX_DCH_PULSE', exportName: 'I_MAX_DCH_30S_DB' },
  { key: 'I_MAX_DCH_CONTINUOUS', exportName: 'I_MAX_DCH_CONTINUOUS_DB' },
  { key: 'T_MAX_BODY', exportName: 'T_MAX_DB' },
  { key: 'T_MAX_BODY_SAFETY', exportName: 'T_MAX_SAFETY_DB' },
  { key: 'T_MAX_TERMINAL', exportName: 'T_MAX_TERMINAL_DB' },
  { key: 'T_MAX_TERMINAL_SAFETY', exportName: 'T_MAX_TERMINAL_SAFETY_DB' },
  { key: 'T_MIN_BODY', exportName: 'T_MIN_DB' },
  { key: 'T_MIN_BODY_SAFETY', exportName: 'T_MIN_SAFETY_DB' },
  { key: 'T_MIN_TERMINAL', exportName: 'T_MIN_TERMINAL_DB' },
  { key: 'T_MIN_TERMINAL_SAFETY', exportName: 'T_MIN_TERMINAL_SAFETY_DB' },
  { key: 'U_MAX', exportName: 'U_MAX_DB' },
  { key: 'U_MAX_SAFETY', exportName: 'U_MAX_SAFETY_DB' },
  { key: 'U_MIN', exportName: 'U_MIN_DB' },
  { key: 'U_MIN_SAFETY', exportName: 'U_MIN_SAFETY_DB' },
];

const EXPORT_NAME_BY_KEY = new Map(BATTERY_EXPORT_KEYS.map((e) => [e.key, e.exportName]));

/**
 * Exact decimal scaling: moves the decimal point of a plain or exponent-form
 * decimal string by `shift` places, so 3200 with shift -3 is "3.2" and never
 * 3.2000000000000002. Returns null when the text is not a finite decimal.
 */
export function scaleDecimal(text: string, shift: number): number | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (!m || (!m[2] && !m[3])) return null;
  const [, sign, intPart = '', fracPart = '', exp = '0'] = m;
  const digits = intPart + fracPart;
  const point = intPart.length + Number(exp) + shift; // position of the decimal point within `digits`
  let out: string;
  if (point <= 0) out = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length);
  else out = `${digits.slice(0, point)}.${digits.slice(point)}`;
  const n = Number(`${sign}${out}`);
  return Number.isFinite(n) ? n : null;
}

/** Unit (lower-case, trimmed) -> decimal shift to the fixed exported unit. */
const UNIT_SHIFTS: Record<string, Record<string, number>> = {
  C_NOMINAL_AH: { ah: 0, mah: -3 },
  E_NOMINAL_WH: { wh: 0, mwh: -3, kwh: 3 },
  EOL_SOH_NOM: { '%': 0 },
};
const unitShifts = (key: string): Record<string, number> => {
  if (UNIT_SHIFTS[key]) return UNIT_SHIFTS[key];
  if (key.startsWith('I_MAX_')) return { a: 0, ma: -3 };
  if (key.startsWith('T_')) return { '°c': 0, degc: 0, c: 0 };
  if (key.startsWith('U_')) return { v: 0, mv: -3 };
  return {};
};

export type ExportValue =
  | { kind: 'value'; value: number }
  | { kind: 'missing' }
  | { kind: 'unit'; unit: string };

/**
 * The value a mapped key is written with. It is decided from the SAME
 * specification the review row displays (`selectedSpec`), with no fallback of
 * its own: no value there means no value in the file.
 */
export function exportValue(fields: InputField[], key: string): ExportValue {
  const field = fields.find((f) => f.id === key);
  const spec = field ? selectedSpec(field) : undefined;
  if (!hasValue(spec)) return { kind: 'missing' };
  const text = String(spec!.value).trim();
  const unit = String(spec!.unit ?? '').trim();
  if (unit === '') {
    const n = scaleDecimal(text, 0);
    return n === null ? { kind: 'missing' } : { kind: 'value', value: n };
  }
  const shift = unitShifts(key)[unit.toLowerCase()];
  if (shift === undefined) return { kind: 'unit', unit };
  const n = scaleDecimal(text, shift);
  return n === null ? { kind: 'missing' } : { kind: 'value', value: n };
}

export interface ExportReport {
  /** Keys with no usable value, in key-map order. */
  missing: string[];
  /** Keys with a value in a unit the exporter cannot convert, in key-map order. */
  unconvertible: { key: string; unit: string }[];
}

/** Everything the pre-export dialog lists: exactly the keys written as the placeholder. */
export function exportReport(fields: InputField[]): ExportReport {
  const report: ExportReport = { missing: [], unconvertible: [] };
  for (const { key } of BATTERY_EXPORT_KEYS) {
    const v = exportValue(fields, key);
    if (v.kind === 'missing') report.missing.push(key);
    else if (v.kind === 'unit') report.unconvertible.push({ key, unit: v.unit });
  }
  return report;
}

/** The mapped keys written as the placeholder, for any reason, in key-map order. */
export function missingExportKeys(fields: InputField[]): string[] {
  return BATTERY_EXPORT_KEYS.filter(({ key }) => exportValue(fields, key).kind !== 'value').map((e) => e.key);
}

export type BatteryParameter = {
  name: string;
  value: string | number;
  unit?: string;
  valueType: 'battery_const' | 'battery_variable';
  color: string;
  comment?: string;
};

export type BatteryFileConfig = {
  type: string;
  numberOfCells: number;
  numberOfSectors: number;
  canMappingActivated: boolean;
};

export class FrontendBatteryFileExport {
  private readonly PLACEHOLDER_VALUE = 99999999;

  private readonly defaultConfig: BatteryFileConfig = {
    type: 'Musterstand',
    numberOfCells: 1,
    numberOfSectors: 2,
    canMappingActivated: false
  };

  /** The value written for a key, or null (placeholder). See `exportValue`. */
  private getFieldValue(fields: InputField[], fieldId: string): number | null {
    const v = exportValue(fields, fieldId);
    return v.kind === 'value' ? v.value : null;
  }

  /**
   * Helper to dynamically get the field label, falling back to a default name if not found.
   */
  private getFieldName(fields: InputField[], fieldId: string): string {
    const field = fields.find(f => f.id === fieldId);
    return field && field.label ? field.label : (EXPORT_NAME_BY_KEY.get(fieldId) ?? fieldId);
  }

  public generate(fields: InputField[], projectName: string): { content: string, filename: string } {
    const filename = this.generateFilename(projectName);
    const xml = this.generateXml(fields);
    return { content: xml, filename };
  }

  private generateFilename(projectName: string): string {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const sanitizedDesignation = (projectName || 'Unknown_Project').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedDesignation}_Battery_V2.01_${dateStr}.battery`;
  }

  private generateXml(fields: InputField[]): string {
    const config = this.defaultConfig; 
    const parameters = this.buildParameters(fields);

    const xmlLines: string[] = [
      '<?xml version="1.0"?>',
      '<Battery xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      `  <Type>${this.escapeXml(config.type)}</Type>`,
      `  <NumberOfCells>${config.numberOfCells}</NumberOfCells>`,
      `  <NumberOfSectors>${config.numberOfSectors}</NumberOfSectors>`,
      `  <CanMappingActivated>${config.canMappingActivated}</CanMappingActivated>`,
      '  <MappedDbcFiles />',
      '  <MappedSignalsStore />',
      '  <DBCFiles />',
      '  <Parameters>',
      ...parameters.map(param => this.generateParameterXml(param)),
      '  </Parameters>',
      '</Battery>'
    ];

    return xmlLines.join('\n');
  }

  private buildParameters(fields: InputField[]): BatteryParameter[] {
    const placeholder = this.PLACEHOLDER_VALUE;

    // Keys must match BATTERY_EXPORT_KEYS above.
    // Capacity & Energy
    const capacityAh = this.getFieldValue(fields, 'C_NOMINAL_AH');
    const energyWh = this.getFieldValue(fields, 'E_NOMINAL_WH');
    const eolSohNom = this.getFieldValue(fields, 'EOL_SOH_NOM'); 
    
    // Voltage
    const uMax = this.getFieldValue(fields, 'U_MAX');
    const uMin = this.getFieldValue(fields, 'U_MIN');
    const uMaxSafety = this.getFieldValue(fields, 'U_MAX_SAFETY');
    const uMinSafety = this.getFieldValue(fields, 'U_MIN_SAFETY');

    // Current (Continuous and Pulse/30s)
    const iMaxChaCont = this.getFieldValue(fields, 'I_MAX_CHA_CONTINUOUS');
    const iMaxDchCont = this.getFieldValue(fields, 'I_MAX_DCH_CONTINUOUS');
    const iMaxChaPulse = this.getFieldValue(fields, 'I_MAX_CHA_PULSE');
    const iMaxDchPulse = this.getFieldValue(fields, 'I_MAX_DCH_PULSE');

    // Temperature (Body & Terminal)
    const tMaxBody = this.getFieldValue(fields, 'T_MAX_BODY');
    const tMinBody = this.getFieldValue(fields, 'T_MIN_BODY');
    const tMaxBodySafety = this.getFieldValue(fields, 'T_MAX_BODY_SAFETY');
    const tMinBodySafety = this.getFieldValue(fields, 'T_MIN_BODY_SAFETY');
    const tMaxTerminal = this.getFieldValue(fields, 'T_MAX_TERMINAL');
    const tMinTerminal = this.getFieldValue(fields, 'T_MIN_TERMINAL');
    const tMaxTerminalSafety = this.getFieldValue(fields, 'T_MAX_TERMINAL_SAFETY');
    const tMinTerminalSafety = this.getFieldValue(fields, 'T_MIN_TERMINAL_SAFETY');

    // Missing database data defaults to placeholders
    const attendantId = placeholder;
    const testingProjectId = placeholder;
    const eotValue = placeholder;
    const vvtIdReady = placeholder;
    const vvtIdRunning = placeholder;
    const vvtIdIdle = placeholder;
    const vvtIdFinished = placeholder;

    return [
      // VVT-specific parameters (Placeholders on Frontend)
      { name: '_DUT_ID_VVT', value: placeholder, valueType: 'battery_const', color: 'Gray', comment: 'Im VVT hinterlegte DUT-ID' },
      { name: '_PB_ID', value: attendantId, valueType: 'battery_const', color: 'Gray', comment: 'VVT-ID des Prüfstandsbetreuers' },
      { name: '_PIN', value: testingProjectId, valueType: 'battery_const', color: 'Gray', comment: 'Projektidentifikationsnummer aus dem VVT' },

      // SOC parameters
      { name: '_SOC_HIGH', value: placeholder, unit: '%', valueType: 'battery_const', color: 'Teal' },
      { name: '_SOC_LOW', value: placeholder, unit: '%', valueType: 'battery_const', color: 'Teal' },
      { name: '_T_CYCLE_C', value: placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },

      // Capacity parameters
      { name: 'C_MEASURED_AH_DB', value: placeholder, unit: 'Ah', valueType: 'battery_variable', color: 'ff804040' },
      { name: 'C_MEASURED_AH_INITIAL', value: placeholder, unit: 'Ah', valueType: 'battery_variable', color: 'Gray' },
      { name: this.getFieldName(fields, 'C_NOMINAL_AH'), value: capacityAh ?? placeholder, unit: 'Ah', valueType: 'battery_const', color: 'Gray', comment: 'Nennkapazität des Prüflings laut Datenblatt' },

      // Cycle count
      { name: 'CYCLE_COUNT_DB', value: 1, valueType: 'battery_variable', color: 'ff0080ff' },

      // Energy parameters
      { name: 'E_MEASURED_WH_DB', value: placeholder, unit: 'Wh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_MEASURED_WH_INITIAL', value: placeholder, unit: 'Wh', valueType: 'battery_variable', color: 'Gray' },
      { name: this.getFieldName(fields, 'E_NOMINAL_WH'), value: energyWh ?? placeholder, unit: 'Wh', valueType: 'battery_const', color: 'Gray' },

      // Energy throughput parameters
      { name: 'E_THROUGHPUT_ACC_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_THROUGHPUT_BAL_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_THROUGHPUT_NEG_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_THROUGHPUT_POS_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },

      // EOL/EOT parameters
      { name: this.getFieldName(fields, 'EOL_SOH_NOM'), value: eolSohNom ?? placeholder, unit: '%', valueType: 'battery_const', color: 'Gray' },
      { name: 'EOT', value: eotValue, unit: '%', valueType: 'battery_const', color: 'Gray' },

      // Current parameters
      { name: this.getFieldName(fields, 'I_MAX_CHA_PULSE'), value: iMaxChaPulse ?? placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'I_MAX_CHA_CONTINUOUS'), value: iMaxChaCont ?? placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'I_MAX_DCH_PULSE'), value: iMaxDchPulse ?? placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' }, // * 
      { name: this.getFieldName(fields, 'I_MAX_DCH_CONTINUOUS'), value: iMaxDchCont ?? placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' }, // * 

      // Package count & Charge throughput
      { name: 'PACKAGE_COUNT_DB', value: 0, valueType: 'battery_variable', color: 'Maroon' },
      { name: 'Q_THROUGHPUT_ACC_DB', value: 0, unit: 'kAh', valueType: 'battery_variable', color: 'ff804040' },
      { name: 'Q_THROUGHPUT_BAL_DB', value: 0, unit: 'kAh', valueType: 'battery_variable', color: 'ff804040' },
      { name: 'Q_THROUGHPUT_NEG_DB', value: 0, unit: 'kAh', valueType: 'battery_variable', color: 'ff804040' },
      { name: 'Q_THROUGHPUT_POS_DB', value: 0, unit: 'kAh', valueType: 'battery_variable', color: 'ff804040' },

      // Internal resistance parameters (Ri)
      ...this.generateRiParameters(),

      // SOC / SOH / Time parameters
      { name: 'SOC_BENCH', value: 100, unit: '%', valueType: 'battery_variable', color: 'Teal' },
      { name: 'SOC_BENCH_NOMINAL', value: 100, unit: '%', valueType: 'battery_variable', color: 'Teal' },
      { name: 'SOH_C', value: 100, unit: '%', valueType: 'battery_variable', color: 'Aqua' },
      { name: 'SOH_E', value: 100, unit: '%', valueType: 'battery_variable', color: 'Aqua' },
      { name: 't_CYCLE_DAYS', value: 0, unit: 'd', valueType: 'battery_variable', color: 'Gray' },

      // Temperature parameters
      { name: this.getFieldName(fields, 'T_MAX_BODY'), value: tMaxBody ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MAX_BODY_SAFETY'), value: tMaxBodySafety ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MAX_TERMINAL'), value: tMaxTerminal ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MAX_TERMINAL_SAFETY'), value: tMaxTerminalSafety ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MIN_BODY'), value: tMinBody ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MIN_BODY_SAFETY'), value: tMinBodySafety ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MIN_TERMINAL'), value: tMinTerminal ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'T_MIN_TERMINAL_SAFETY'), value: tMinTerminalSafety ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 't_TESTING_DAYS', value: 0, unit: 'd', valueType: 'battery_variable', color: 'Gray' },
      { name: 'vorherigerTesttyp', value: 0, valueType: 'battery_variable', color: 'Gray' },

      // Voltage parameters
      { name: this.getFieldName(fields, 'U_MAX'), value: uMax ?? placeholder, unit: 'V', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'U_MAX_SAFETY'), value: uMaxSafety ?? placeholder, unit: 'V', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'U_MIN'), value: uMin ?? placeholder, unit: 'V', valueType: 'battery_const', color: 'Gray' },
      { name: this.getFieldName(fields, 'U_MIN_SAFETY'), value: uMinSafety ?? placeholder, unit: 'V', valueType: 'battery_const', color: 'Gray' },

      // VVT ID parameters
      { name: 'VVT_ID_BEREIT', value: vvtIdReady, valueType: 'battery_const', color: 'Gray' },
      { name: 'VVT_ID_ENDE', value: vvtIdFinished, valueType: 'battery_const', color: 'Gray' },
      { name: 'VVT_ID_LAEUFT', value: vvtIdRunning, valueType: 'battery_const', color: 'Gray' },
      { name: 'VVT_ID_STILLSTAND', value: vvtIdIdle, valueType: 'battery_const', color: 'Gray' }
    ];
  }

  private generateRiParameters(): BatteryParameter[] {
    const directions = ['cha', 'dch'];
    const socLevels = ['30p', '50p'];
    const durations = ['1s', '10s', '20s', '30s', '180s'];

    return directions.flatMap(direction =>
      socLevels.flatMap(soc =>
        durations.map(duration => ({
          name: `Ri_${direction}_${soc}_xC_T25_${duration}`,
          value: 0,
          unit: 'mOhm',
          valueType: 'battery_variable' as const,
          color: 'Gray'
        }))
      )
    );
  }

  private generateParameterXml(param: BatteryParameter): string {
    const lines: string[] = [
      '    <BatteryParameter>',
      `      <Name>${this.escapeXml(param.name)}</Name>`,
      `      <Value>${param.value}</Value>`
    ];

    if (param.unit) {
      lines.push(`      <Unit>${this.escapeXml(param.unit)}</Unit>`);
    }

    lines.push(`      <ValueType>${param.valueType}</ValueType>`);
    lines.push(`      <Color ColorAsString="${this.escapeXml(param.color)}" />`);

    if (param.comment) {
      lines.push(`      <Comment>${this.escapeXml(param.comment)}</Comment>`);
    }

    lines.push('    </BatteryParameter>');

    return lines.join('\n');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}