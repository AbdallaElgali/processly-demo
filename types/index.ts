export type BoundingBox = { x: number; y: number; width: number; height: number };

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
export type ReviewAction = 'PENDING' | 'MODIFIED' | 'ACCEPTED' | 'REJECTED';

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
  /** The unit the parameter dictionary expects, when the candidate carries one. */
  expectedUnit?: string | null;
  /**
   * The model's written rationale for this value (`extraction_logic`). On a
   * null-valued candidate it instead carries one of the four reason codes
   * (lib/review/reasonCodes.ts). Not the model's internal chain of thought,
   * which the API never returns (AM15).
   */
  extractionLogic?: string | null;
  /** How the value was computed, when `calculated` is true. */
  calculationLogic?: string | null;
  /**
   * The AI candidate's own value, unit and confidence, kept when a person
   * edits the value: shown as "Extracted: …" and restored by Revert. Absent
   * on an unedited candidate and on a value a person typed with no candidate.
   */
  original?: { value: string; unit: string | null; confidence: number | null };
  /** The extraction run this candidate came from (`run_number` in the project payload). */
  runNumber?: number | null;
}

export interface InputField {
  id: string;       // parameter_key (e.g. "U_MIN")
  dbId: string;     // ProjectParameter row id
  /** Canonical `parameters.id` (backend 3.10). Not unique per project; null/absent on older payloads. */
  parameterId?: string | null;
  label: string;
  /** The parameter's category from the project payload (backend step 3.5); null/absent -> "Other". */
  category?: string | null;
  // Mirrored from the backend ProjectParameter row (see api/projects.ts).
  // `dbParamToInputField` already populates these; declaring them keeps the
  // consumers type-safe instead of casting the field to `any`.
  parameter_alias?: string | null;
  description_override?: string | null;
  ai_instructions?: string | null;
  specifications: Specification[];
  selectedSpecId?: string;
  isFlagged: boolean;
  flagReason: string | null;
  activeFlagId: string | null; // id of the active flag ticket; chained as parent on re-flag
  reviewAction: ReviewAction;
  /**
   * `project_parameters.is_human_modified`: the saved value is a person's, not
   * the candidate's. Kept separately from `reviewAction` because an edited row
   * that was then accepted is ACCEPTED and still human-modified.
   */
  isHumanModified?: boolean;
}

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
