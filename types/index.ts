export interface FieldType {
  id: string;
  label: string;
  unit: string | null;
}


export interface Specification {
  id: string;
  value: string;
  confidence: number | null;
  unit: string | null;

  source: {
            documentId: string | null;
            textSnippet: string | null;
            reason: string | null;

            // PDf
            pageNumber: number | null;
            boundingBox: { x: number; y: number; width: number; height: number } | null;

            // excel
            tableName: string | null;
            cellCoordinates: { row: number; column: number} | null;
          } | null;

  calculated?: boolean;
  source_confidence?: number | null;
  rule_passed?: boolean;
  rule_violations?: string[];
  requires_review?: boolean;
}

export interface InputField {
  id: string; // The unique identifier for the field (e.g., 'U_MIN')
  type: string;
  label: string;
  specifications: Specification[];
  selectedSpecId?: string; // NEW: Tracks which specification is currently active
}
export const SCHEMA_GROUPS = [
  {
    group: "Voltage Specs",
    fields: [
      { id: "U_MIN", label: "End-of-discharge voltage", unit: "V" },
      { id: "U_MAX", label: "End-of-charge voltage", unit: "V" },
      { id: "U_MIN_DYN", label: "Discharge cut-off (Dynamic)", unit: "V" },
      { id: "U_MAX_DYN", label: "Charge cut-off (Dynamic)", unit: "V" },
      { id: "U_MIN_PULSE", label: "Lower voltage limit (Pulse)", unit: "V" },
      { id: "U_MAX_PULSE", label: "Upper voltage limit (Pulse)", unit: "V" },
      { id: "U_MIN_SAFETY", label: "Min Safety Limit (Shutdown)", unit: "V" },
      { id: "U_MAX_SAFETY", label: "Max Safety Limit (Shutdown)", unit: "V" },
    ]
  },
  {
    group: "Current Specs",
    fields: [
      { id: "I_MAX_CHA_CONTINUOUS", label: "Max Continuous Charge", unit: "A" },
      { id: "I_MAX_DCH_CONTINUOUS", label: "Max Continuous Discharge", unit: "A" },
      { id: "I_MAX_CHA_PULSE", label: "Max Charge Current (Pulse)", unit: "A" },
      { id: "I_MAX_DCH_PULSE", label: "Max Discharge Current (Pulse)", unit: "A" },
    ]
  },
  {
    group: "Temperature Specs",
    fields: [
      { id: "T_MIN_BODY", label: "Min Body Temp", unit: "°C" },
      { id: "T_MAX_BODY", label: "Max Body Temp", unit: "°C" },
      { id: "T_MIN_BODY_SAFETY", label: "Min Safety Body Temp", unit: "°C" },
      { id: "T_MAX_BODY_SAFETY", label: "Max Safety Body Temp", unit: "°C" },
      { id: "T_MIN_TERMINAL", label: "Min Terminal Temp", unit: "°C" },
      { id: "T_MAX_TERMINAL", label: "Max Terminal Temp", unit: "°C" },
      { id: "T_MIN_TERMINAL_SAFETY", label: "Min Safety Terminal Temp", unit: "°C" },
      { id: "T_MAX_TERMINAL_SAFETY", label: "Max Safety Terminal Temp", unit: "°C" },
    ]
  },
  {
    group: "Capacity Specs",
    fields: [
      { id: "C_NOMINAL_AH", label: "Nominal Capacity", unit: "Ah" },
      { id: "E_NOMINAL_WH", label: "Nominal Energy", unit: "Wh" },
      { id: "EOL_FCE", label: "EOL: Full Charge Equivalents", unit: "" },
      { id: "EOL_CYCLES", label: "EOL: Number of Cycles", unit: "" },
      { id: "EOL_SOH_NOM", label: "EOL: SOH (Nominal)", unit: "%" },
      { id: "EOL_SOH_REAL", label: "EOL: SOH (Measured)", unit: "%" },
      { id: "EOL_RI", label: "EOL: Internal Resistance Increase", unit: "%" },
    ]
  }
];


export interface PDFSource {
  documentId: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  pageNumber: number;
  textSnippet: string;
}

export interface ExcelSource {
  documentId: string;  // represents the fileId 
  tableName: string;
  cellCoordinates: { row: number; column: number };
}
