import { InputField } from '@/types';
import { hasValue, selectedSpec } from '@/lib/review/rowState';

/**
 * `.battery` export (decision D8, AM7).
 *
 * The file has two kinds of entries:
 *
 * 1. Project parameters: exactly the parameters of the project, nothing
 *    hardcoded. Each one is written with the value selected in the review,
 *    whatever its origin (AI candidate or typed in by a person).
 *    - Name: the parameter's alias (`project_parameters.parameter_alias`, unique
 *      per project), falling back to its key. To match the bench's names
 *      (`U_MAX_DB`, `EOL`, ...), set the alias in the template.
 *    - Value and unit: exactly as reviewed. The export never converts a unit
 *      or changes a sign; the backend and the reviewing user own both
 *      (owner decision 2026-10-25).
 *    - No value: written as the placeholder.
 *
 * 2. Bench entries (VVT IDs, throughputs, SOC/SOH, Ri, ...): not project data;
 *    static defaults the test bench fills in at runtime. A project parameter
 *    whose name clashes with one is skipped and reported.
 */

/** Entry names written by the bench section; a project parameter may not reuse one. */
const BENCH_NAMES = new Set([
  '_DUT_ID_VVT', '_PB_ID', '_PIN', '_SOC_HIGH', '_SOC_LOW', '_T_CYCLE_C',
  'C_MEASURED_AH_DB', 'C_MEASURED_AH_INITIAL', 'CYCLE_COUNT_DB',
  'E_MEASURED_WH_DB', 'E_MEASURED_WH_INITIAL',
  'E_THROUGHPUT_ACC_DB', 'E_THROUGHPUT_BAL_DB', 'E_THROUGHPUT_NEG_DB', 'E_THROUGHPUT_POS_DB',
  'EOT', 'PACKAGE_COUNT_DB',
  'Q_THROUGHPUT_ACC_DB', 'Q_THROUGHPUT_BAL_DB', 'Q_THROUGHPUT_NEG_DB', 'Q_THROUGHPUT_POS_DB',
  'SOC_BENCH', 'SOC_BENCH_NOMINAL', 'SOH_C', 'SOH_E', 't_CYCLE_DAYS', 't_TESTING_DAYS', 'vorherigerTesttyp',
  'VVT_ID_BEREIT', 'VVT_ID_ENDE', 'VVT_ID_LAEUFT', 'VVT_ID_STILLSTAND',
  ...['cha', 'dch'].flatMap((d) =>
    ['30p', '50p'].flatMap((s) => ['1s', '10s', '20s', '30s', '180s'].map((t) => `Ri_${d}_${s}_xC_T25_${t}`)),
  ),
]);

/** The entry name a project parameter is written under. */
export function exportName(field: InputField): string {
  return field.parameter_alias?.trim() || field.id;
}

/**
 * Strict decimal parsing: plain or exponent-form decimal string to a number,
 * or null when the text is not a finite decimal ("4.2V", "1,5" -> null).
 * Never parseFloat, which reads "1,5" as 1.
 */
export function parseDecimal(text: string): number | null {
  const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.exec(text.trim());
  if (!m) return null;
  const n = Number(text.trim());
  return Number.isFinite(n) ? n : null;
}

export type ExportValue =
  | { kind: 'value'; value: number; unit: string | null }
  | { kind: 'missing' };

/**
 * The value a parameter is written with. It is decided from the SAME
 * specification the review row displays (`selectedSpec`), with no fallback of
 * its own: no value there means no value in the file.
 */
export function exportValue(field: InputField): ExportValue {
  const spec = selectedSpec(field);
  if (!hasValue(spec)) return { kind: 'missing' };
  const n = parseDecimal(String(spec!.value));
  if (n === null) return { kind: 'missing' };
  const unit = String(spec!.unit ?? '').trim();
  return { kind: 'value', value: n, unit: unit || null };
}

/** The project parameters the export writes, in review order (bench-name clashes left out). */
export function exportFields(fields: InputField[]): InputField[] {
  return fields.filter((f) => !BENCH_NAMES.has(exportName(f)));
}

export interface ExportReport {
  /** Parameters written as the placeholder (no usable value), in export order. */
  missing: string[];
  /** Parameters skipped because their name clashes with a bench entry. */
  conflicting: string[];
}

/** Everything the pre-export dialog lists. */
export function exportReport(fields: InputField[]): ExportReport {
  return {
    missing: exportFields(fields).filter((f) => exportValue(f).kind === 'missing').map(exportName),
    conflicting: fields.filter((f) => BENCH_NAMES.has(exportName(f))).map(exportName),
  };
}

/** The parameters written as the placeholder, in export order. */
export function missingExportKeys(fields: InputField[]): string[] {
  return exportReport(fields).missing;
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

  private devTestMode = false;
  private arg: string | null = null;

  init(arg: string | null, opts: { devTestMode?: boolean } = {}): void {
    this.arg = arg;
    this.devTestMode = opts.devTestMode ?? false;
  }

  constructor(...args: Parameters<FrontendBatteryFileExport['init']>) {
    this.init(...args);
  }

  private readonly defaultConfig: BatteryFileConfig = {
    type: 'Musterstand',
    numberOfCells: 1,
    numberOfSectors: 2,
    canMappingActivated: false,
  };

  public generate(fields: InputField[], projectName: string): { content: string; filename: string } {
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
      ...parameters.map((param) => this.generateParameterXml(param)),
      '  </Parameters>',
      '</Battery>',
    ];

    return xmlLines.join('\n');
  }

  /** One project-parameter entry: the reviewed value as is, or the placeholder. */
  private projectParameter(field: InputField): BatteryParameter {
    const v = exportValue(field);
    return {
      name: exportName(field),
      value: v.kind === 'value' ? v.value : this.PLACEHOLDER_VALUE,
      unit: (v.kind === 'value' ? v.unit : null) ?? undefined,
      valueType: 'battery_const',
      color: 'Gray',
      comment: field.description_override ?? undefined,
    };
  }

  private buildParameters(fields: InputField[]): BatteryParameter[] {
    const projectParams = exportFields(fields).map((f) => this.projectParameter(f));

    // Dev mode: project parameters only.
    if (this.devTestMode) return projectParams;

    return [...this.buildBenchParameters(), ...projectParams];
  }

  /** The fixed bench entries: not project data, defaults the bench fills in at runtime. */
  private buildBenchParameters(): BatteryParameter[] {
    const placeholder = this.PLACEHOLDER_VALUE;
    const bench = (name: string, value: number, valueType: BatteryParameter['valueType'], color: string, unit?: string, comment?: string): BatteryParameter =>
      ({ name, value, unit, valueType, color, comment });

    return [
      // VVT-specific parameters (placeholders on the frontend)
      bench('_DUT_ID_VVT', placeholder, 'battery_const', 'Gray', undefined, 'Im VVT hinterlegte DUT-ID'),
      bench('_PB_ID', placeholder, 'battery_const', 'Gray', undefined, 'VVT-ID des Prüfstandsbetreuers'),
      bench('_PIN', placeholder, 'battery_const', 'Gray', undefined, 'Projektidentifikationsnummer aus dem VVT'),

      // SOC
      bench('_SOC_HIGH', placeholder, 'battery_const', 'Teal', '%'),
      bench('_SOC_LOW', placeholder, 'battery_const', 'Teal', '%'),
      bench('_T_CYCLE_C', placeholder, 'battery_const', 'Gray', '°C'),

      // Capacity & cycle count
      bench('C_MEASURED_AH_DB', placeholder, 'battery_variable', 'ff804040', 'Ah'),
      bench('C_MEASURED_AH_INITIAL', placeholder, 'battery_variable', 'Gray', 'Ah'),
      bench('CYCLE_COUNT_DB', 1, 'battery_variable', 'ff0080ff'),

      // Energy
      bench('E_MEASURED_WH_DB', placeholder, 'battery_variable', 'Purple', 'Wh'),
      bench('E_MEASURED_WH_INITIAL', placeholder, 'battery_variable', 'Gray', 'Wh'),
      bench('E_THROUGHPUT_ACC_DB', 0, 'battery_variable', 'Purple', 'kWh'),
      bench('E_THROUGHPUT_BAL_DB', 0, 'battery_variable', 'Purple', 'kWh'),
      bench('E_THROUGHPUT_NEG_DB', 0, 'battery_variable', 'Purple', 'kWh'),
      bench('E_THROUGHPUT_POS_DB', 0, 'battery_variable', 'Purple', 'kWh'),

      // EOT
      bench('EOT', placeholder, 'battery_const', 'Gray', '%'),

      // Package count & charge throughput
      bench('PACKAGE_COUNT_DB', 0, 'battery_variable', 'Maroon'),
      bench('Q_THROUGHPUT_ACC_DB', 0, 'battery_variable', 'ff804040', 'kAh'),
      bench('Q_THROUGHPUT_BAL_DB', 0, 'battery_variable', 'ff804040', 'kAh'),
      bench('Q_THROUGHPUT_NEG_DB', 0, 'battery_variable', 'ff804040', 'kAh'),
      bench('Q_THROUGHPUT_POS_DB', 0, 'battery_variable', 'ff804040', 'kAh'),

      // Internal resistance (Ri)
      ...this.generateRiParameters(),

      // SOC / SOH / time
      bench('SOC_BENCH', 100, 'battery_variable', 'Teal', '%'),
      bench('SOC_BENCH_NOMINAL', 100, 'battery_variable', 'Teal', '%'),
      bench('SOH_C', 100, 'battery_variable', 'Aqua', '%'),
      bench('SOH_E', 100, 'battery_variable', 'Aqua', '%'),
      bench('t_CYCLE_DAYS', 0, 'battery_variable', 'Gray', 'd'),
      bench('t_TESTING_DAYS', 0, 'battery_variable', 'Gray', 'd'),
      bench('vorherigerTesttyp', 0, 'battery_variable', 'Gray'),

      // VVT IDs
      bench('VVT_ID_BEREIT', placeholder, 'battery_const', 'Gray'),
      bench('VVT_ID_ENDE', placeholder, 'battery_const', 'Gray'),
      bench('VVT_ID_LAEUFT', placeholder, 'battery_const', 'Gray'),
      bench('VVT_ID_STILLSTAND', placeholder, 'battery_const', 'Gray'),
    ];
  }

  private generateRiParameters(): BatteryParameter[] {
    const directions = ['cha', 'dch'];
    const socLevels = ['30p', '50p'];
    const durations = ['1s', '10s', '20s', '30s', '180s'];

    return directions.flatMap((direction) =>
      socLevels.flatMap((soc) =>
        durations.map((duration) => ({
          name: `Ri_${direction}_${soc}_xC_T25_${duration}`,
          value: 0,
          unit: 'mOhm',
          valueType: 'battery_variable' as const,
          color: 'Gray',
        })),
      ),
    );
  }

  private generateParameterXml(param: BatteryParameter): string {
    const lines: string[] = [
      '    <BatteryParameter>',
      `      <Name>${this.escapeXml(param.name)}</Name>`,
      `      <Value>${this.escapeXml(String(param.value))}</Value>`,
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