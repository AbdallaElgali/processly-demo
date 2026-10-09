/**
 * Hand-written response types for the /projects routes (decision D10).
 *
 * `openapi.json` declares these responses as `{}` -- untyped -- so generating a
 * client would leave the app's main data screens as `unknown`. These were read
 * off the backend's own Pydantic models and SQL rather than inferred from
 * sample payloads:
 *
 *   GET /projects/{project_id}      -> FullProjectDetails
 *     BDA/src/db/types/projects.py::FullProjectDetailsOutput
 *     BDA/src/db/projects.py::get_full_project_details_db
 *   GET /projects/user/{user_id}    -> { projects: ProjectBase[] }
 *     BDA/src/db/types/projects.py::ProjectBaseOutput
 *
 * Replace with generated types once RFC 5 P0 lands (Task B).
 */

/** projects.status_enum in the DB schema. */
export type ProjectStatus = 'NEW' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'APPROVED';

/** project_parameters.review_action_enum. Note there is NO 'PENDING' member;
 *  the UI's own pending state is client-side only (Task B item B6). */
export type ReviewActionValue = 'ACCEPTED' | 'MODIFIED' | 'REJECTED';

export interface ProjectBase {
  id: string;
  alias_id: string;
  description: string | null;
  /**
   * Always null today: the query is `SELECT *` on a `projects` table that has
   * no such column (Task B item B2). The breadcrumb falls back to joining
   * GET /customers/ by customer_id, per decision D6.
   */
  customer: string | null;
  status: ProjectStatus;
  created_at: string;
  source_template_id: string | null;
  customer_id: string | null;
}

export interface ProjectDocument {
  id: string;
  name: string;
  path: string;
  type: string;
  analyzed: boolean;
  /** Injected by the backend as `/documents/{id}/file`; identical to that route. */
  file_url: string;
}

/** One AI-proposed value. Confidence is on the backend's 0-1 scale here. */
export interface AiMetricCandidate {
  id: string;
  project_id?: string | null;
  ai_value?: number | string | null;
  unit?: string | null;
  expected_unit?: string | null;
  confidence?: number | null;
  is_calculated?: boolean | null;
  calculation_logic?: string | null;
  /**
   * Doubles as the carrier for the four "no value" reason codes: when
   * `ai_value` is null this holds one of the strings in
   * BDA/src/engine/reason_codes.py. Task B item B5 proposes an explicit field.
   */
  extraction_logic?: string | null;
  requires_review?: boolean | null;
  rule_violations?: string[] | null;
  source_document_id?: string | null;
  source_text_snippet?: string | null;
  source_reason?: string | null;
  source_anchor?: string | null;
  source_page_number?: number | null;
  /** JSONB. PDF bounding box as {x0, y0, x1, y1} in points, bottom-left origin. */
  source_bounding_box?: Record<string, unknown> | null;
  source_table_name?: string | null;
  /** JSONB. {row, column}; {-1, -1} when the backend could not resolve a cell. */
  source_cell_coordinates?: Record<string, unknown> | null;
  created_at?: string | null;
  param_name?: string | null;
  extraction_run_id?: string | null;
  run_number?: number | null;
}

export interface FullProjectParameter {
  /** project_parameters.id */
  id: string;
  /** The canonical parameter name, e.g. "U_MIN". */
  parameter_key: string;
  parameter_alias: string;
  final_value: number | string | null;
  final_unit: string | null;
  is_human_modified: boolean;
  selected_candidate_id: string | null;
  review_action: ReviewActionValue | string;
  reviewed_at: string | null;

  human_flagged: boolean;
  active_flag_id: string | null;
  flag_reason: string | null;
  flagger_id: string | null;

  description_override: string | null;
  ai_instructions: string | null;

  /** Denormalised from the selected candidate. */
  confidence: number | null;
  source_text_snippet: string | null;
  source_page_number: number | null;

  candidates: AiMetricCandidate[];

  // NOTE: there is deliberately no `category` here. The SQL does not select
  // it, so declaring one would be inventing a field (CLAUDE.md 0.4). Until
  // Task B item B4 adds it, categories come from joining
  // GET /extraction-templates/parameters on parameter_key (decision D5).
}

export interface FullProjectDetails extends ProjectBase {
  documents: ProjectDocument[];
  /** Already ordered by category then name server-side. */
  parameters: FullProjectParameter[];
}

/** GET /projects/{id}/extraction-runs -> ExtractionRun[] (typed in openapi.json). */
export interface ExtractionRun {
  id: string;
  project_id: string;
  user_id: string;
  run_number: number;
  parameters_count: number;
  extraction_type: 'MAIN_MULTI_AGENT' | 'ITERATIVE' | 'SINGLE_PARAM' | string;
  model_name: string | null;
  reasoning_effort: string | null;
  temperature: number | null;
  created_at: string | null;
}
