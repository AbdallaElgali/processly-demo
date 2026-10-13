# Frontend TypeScript Models, Types & Schemas

### `.\types\admin.ts`
```typescript

```

### `.\types\audit.ts`
```typescript
// Shared audit/admin dashboard types. Single home for these so the admin hook
// and the audit API client cannot drift (they previously defined them twice with
// differing `permission_type` nullability).

export interface AuditUser {
  user_id: string;
  username: string;
  department: string;
  permission_type: string | null;
}

export interface ProjectMetrics {
  id: string;
  name: string;
  date: string;
  users: AuditUser[];
  f1Score: number;
  totalParams: number;
  aiParams: number;
  acceptedParams: number;
}

export interface ChartDataPoint {
  name: string;
  f1Score: number;
  totalParams: number;
  aiParams: number;
}

export interface DashboardInsights {
  avgF1: string | number;
  avgAcceptanceRate: string | number;
  totalAssistedProjects: number;
  totalAiParams: number;
}

export interface DashboardData {
  chartData: ChartDataPoint[];
  insights: DashboardInsights;
}

export interface GroupInsights {
  totalExtractionRuns: number;
  acceptanceRate: number;
  totalFlags: number;
}


export interface ProjectSummary {
  parameterKey: string;
  finalValue: string | null;
  reviewAction: string;
  isHumanModified: boolean;
  totalCandidates: number;
  totalFlags: number;
  lastAiUpdate: string | null;
  isAiAccepted: boolean;
  totalExtractionRuns: number;
}

export interface FlagDetail {
  flagId: string;
  flagReason: string | null;
  status: string;
  flagType: string | null;
  createdAt: string;
  resolvedByCandidateId: string | null;
}

export interface ParameterLineageEvent {
  candidateId: string;
  extractionRunId: string;
  value: string | null;
  unit: string | null;
  extractionLogic: string | null;
  confidence: number;
  createdAt: string;
  flag: FlagDetail | null;
  isWinner: boolean;
}

export interface ParameterLineageResponse {
  parameterKey: string;
  finalValue: string | null;
  reviewAction: string | null;
  isAiAccepted: boolean;
  events: ParameterLineageEvent[];
}
```

### `.\types\index.ts`
```typescript
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

// Review lifecycle for a parameter. PENDING = untouched AI value,
// MODIFIED = a human edited the value, ACCEPTED = approved (backend-owned).
export type ReviewAction = 'PENDING' | 'MODIFIED' | 'ACCEPTED';

export interface Specification {
  // Stable id used for React keys and `selectedSpecId`. For an AI candidate this
  // equals `candidateId`; for a human-entered value it is a generated UUID.
  id: string;
  // The actual AI metric candidate id in the DB, or null for a human-entered value.
  // This is the value sent to the backend as `selected_candidate_id` / `ai_metric_candidate_id`.
  candidateId: string | null;
  value: string;
  confidence: number | null; // canonical UI scale: 0–100 (converted at the API boundary)
  unit: string | null;
  source: SpecificationSource | null;
  calculated: boolean;
  rule_passed: boolean;
  rule_violations: string[];
  requires_review: boolean;
}

export interface InputField {
  id: string;       // parameter_key (e.g. "U_MIN")
  dbId: string;     // ProjectParameter row id
  label: string;
  specifications: Specification[];
  selectedSpecId?: string;
  isFlagged: boolean;
  flagReason: string | null;
  activeFlagId: string | null; // id of the active flag ticket; chained as parent on re-flag
  reviewAction: ReviewAction;
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

```

