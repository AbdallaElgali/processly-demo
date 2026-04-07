// src/utils/batteryFileExport.ts
import { InputField } from '@/types'; // Adjust this import to your actual types path

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

  /**
   * Helper to extract the active value from your UI fields array.
   * Make sure the 'fieldId' matches the IDs defined in your SCHEMA_GROUPS.
   */
  private getFieldValue(fields: InputField[], fieldId: string): number | null {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return null;

    const activeSpec = field.selectedSpecId 
      ? field.specifications.find(s => s.id === field.selectedSpecId)
      : field.specifications[0];

    if (activeSpec && activeSpec.value !== '') {
      const numValue = Number(activeSpec.value);
      return isNaN(numValue) ? null : numValue;
    }
    return null;
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
    const config = this.defaultConfig; // Using defaults as UI doesn't have these yet
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

    // --- EXACT MAPPING TO SCHEMA_GROUPS IDs ---
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
      { name: 'C_NOMINAL_AH_DB', value: capacityAh ?? placeholder, unit: 'Ah', valueType: 'battery_const', color: 'Gray', comment: 'Nennkapazität des Prüflings laut Datenblatt' },

      // Cycle count
      { name: 'CYCLE_COUNT_DB', value: 1, valueType: 'battery_variable', color: 'ff0080ff' },

      // Energy parameters
      { name: 'E_MEASURED_WH_DB', value: placeholder, unit: 'Wh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_MEASURED_WH_INITIAL', value: placeholder, unit: 'Wh', valueType: 'battery_variable', color: 'Gray' },
      { name: 'E_NOMINAL_WH_DB', value: energyWh ?? placeholder, unit: 'Wh', valueType: 'battery_const', color: 'Gray' },

      // Energy throughput parameters
      { name: 'E_THROUGHPUT_ACC_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_THROUGHPUT_BAL_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_THROUGHPUT_NEG_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },
      { name: 'E_THROUGHPUT_POS_DB', value: 0, unit: 'kWh', valueType: 'battery_variable', color: 'Purple' },

      // EOL/EOT parameters
      { name: 'EOL', value: eolSohNom ?? placeholder, unit: '%', valueType: 'battery_const', color: 'Gray' },
      { name: 'EOT', value: eotValue, unit: '%', valueType: 'battery_const', color: 'Gray' },

      // Current parameters
      { name: 'I_MAX_CHA_30S_DB', value: iMaxChaPulse ?? placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' },
      { name: 'I_MAX_CHA_CONTINUOUS_DB', value: iMaxChaCont ?? placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' },
      { name: 'I_MAX_DCH_30S_DB', value: iMaxDchPulse ? -iMaxDchPulse : -placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' },
      { name: 'I_MAX_DCH_CONTINUOUS_DB', value: iMaxDchCont ? -iMaxDchCont : -placeholder, unit: 'A', valueType: 'battery_const', color: 'Gray' },

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
      { name: 'T_MAX_DB', value: tMaxBody ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MAX_SAFETY_DB', value: tMaxBodySafety ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MAX_TERMINAL_DB', value: tMaxTerminal ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MAX_TERMINAL_SAFETY_DB', value: tMaxTerminalSafety ?? placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MIN_DB', value: tMinBody ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MIN_SAFETY_DB', value: tMinBodySafety ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MIN_TERMINAL_DB', value: tMinTerminal ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 'T_MIN_TERMINAL_SAFETY_DB', value: tMinTerminalSafety ?? -placeholder, unit: '°C', valueType: 'battery_const', color: 'Gray' },
      { name: 't_TESTING_DAYS', value: 0, unit: 'd', valueType: 'battery_variable', color: 'Gray' },
      { name: 'vorherigerTesttyp', value: 0, valueType: 'battery_variable', color: 'Gray' },

      // Voltage parameters
      { name: 'U_MAX_DB', value: uMax ?? placeholder, unit: 'V', valueType: 'battery_const', color: 'Gray' },
      { name: 'U_MAX_SAFETY_DB', value: uMaxSafety ?? (uMax ? uMax + 0.02 : placeholder), unit: 'V', valueType: 'battery_const', color: 'Gray' },
      { name: 'U_MIN_DB', value: uMin ?? placeholder, unit: 'V', valueType: 'battery_const', color: 'Gray' },
      { name: 'U_MIN_SAFETY_DB', value: uMinSafety ?? (uMin ? uMin - 0.02 : placeholder), unit: 'V', valueType: 'battery_const', color: 'Gray' },

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