export type BoundingBox = { x: number; y: number; width: number; height: number };

export interface SchemaField {
  id: string;
  label: string;
  unit: string;
}

export interface SpecificationSource {
  documentId: string | null;
  textSnippet: string | null;
  reason: string | null;
  pageNumber: number | null;
  boundingBox: BoundingBox | null;
  tableName: string | null;
  cellCoordinates: { row: number; column: number } | null;
}

export interface Specification {
  id: string;
  value: string;
  confidence: number | null;
  unit: string | null;
  source: SpecificationSource | null;
  calculated: boolean;
  rule_passed: boolean;
  rule_violations: string[];
  requires_review: boolean;
}

export interface InputField {
  id: string;
  label: string;
  specifications: Specification[];
  selectedSpecId?: string;
  isFlagged?: boolean;
  flagReason?: string;
}

export const SCHEMA_GROUPS: { group: string; fields: SchemaField[] }[] = [
  {
    group: "Voltage Specs",
    fields: [
      { id: "U_MIN", label: "U_MIN", unit: "V" },
      { id: "U_MAX", label: "U_MAX", unit: "V" },
      { id: "U_MIN_DYN", label: "U_MIN_DYN", unit: "V" },
      { id: "U_MAX_DYN", label: "U_MAX_DYN", unit: "V" },
      { id: "U_MIN_PULSE", label: "U_MIN_PULSE", unit: "V" },
      { id: "U_MAX_PULSE", label: "U_MAX_PULSE", unit: "V" },
      { id: "U_MIN_SAFETY", label: "U_MIN_SAFETY", unit: "V" },
      { id: "U_MAX_SAFETY", label: "U_MAX_SAFETY", unit: "V" },
    ]
  },
  {
    group: "Current Specs",
    fields: [
      { id: "I_MAX_CHA_CONTINUOUS", label: "I_MAX_CHA_CONTINUOUS", unit: "A" },
      { id: "I_MAX_DCH_CONTINUOUS", label: "I_MAX_DCH_CONTINUOUS", unit: "A" },
      { id: "I_MAX_CHA_PULSE", label: "I_MAX_CHA_PULSE", unit: "A" },
      { id: "I_MAX_DCH_PULSE", label: "I_MAX_DCH_PULSE", unit: "A" },
    ]
  },
  {
    group: "Temperature Specs",
    fields: [
      { id: "T_MIN_BODY", label: "T_MIN_BODY", unit: "°C" },
      { id: "T_MAX_BODY", label: "T_MAX_BODY", unit: "°C" },
      { id: "T_MIN_BODY_SAFETY", label: "T_MIN_BODY_SAFETY", unit: "°C" },
      { id: "T_MAX_BODY_SAFETY", label: "T_MAX_BODY_SAFETY", unit: "°C" },
      { id: "T_MIN_TERMINAL", label: "T_MIN_TERMINAL", unit: "°C" },
      { id: "T_MAX_TERMINAL", label: "T_MAX_TERMINAL", unit: "°C" },
      { id: "T_MIN_TERMINAL_SAFETY", label: "T_MIN_TERMINAL_SAFETY", unit: "°C" },
      { id: "T_MAX_TERMINAL_SAFETY", label: "T_MAX_TERMINAL_SAFETY", unit: "°C" },
    ]
  },
  {
    group: "Capacity Specs",
    fields: [
      { id: "C_NOMINAL_AH", label: "C_NOMINAL_AH", unit: "Ah" },
      { id: "E_NOMINAL_WH", label: "E_NOMINAL_WH", unit: "Wh" },
      { id: "EOL_FCE", label: "EOL_FCE", unit: "" },
      { id: "EOL_CYCLES", label: "EOL_CYCLES", unit: "" },
      { id: "EOL_SOH_NOM", label: "EOL_SOH_NOM", unit: "%" },
      { id: "EOL_SOH_REAL", label: "EOL_SOH_REAL", unit: "%" },
      { id: "EOL_RI", label: "EOL_RI", unit: "%" },
    ]
  }
];

// PDFSource and ExcelSource represent the resolved highlight target passed to viewers.
// Fields that may be absent at runtime are explicitly nullable.
export interface PDFSource {
  documentId: string;
  pageNumber: number;
  boundingBox: BoundingBox | null;
  textSnippet: string | null;
}

export interface ExcelSource {
  documentId: string;
  tableName: string | null;
  cellCoordinates: { row: number; column: number } | null;
  pageNumber: number | null;
  boundingBox: BoundingBox | null;
  textSnippet: string | null;
}

// ActiveHighlight is the runtime type flowing from a Specification source
// through DocumentManager into the document viewers.
export type ActiveHighlight = SpecificationSource | null;
