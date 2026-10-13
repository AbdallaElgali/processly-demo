import { config } from './config';
import { statusFormBody } from '@/lib/overview/status';
import type { ProjectStatus } from './types/projects';

const API_URL = config.api;

const API_BASE_URL = API_URL + '/projects';


/**
 * POST /projects/ — exactly the fields ProjectCreateInput declares in
 * openapi.json. `title` and `customer` used to be here and were sent on every
 * create; the backend has no such fields and silently dropped them.
 * `customer_id` is nullable in the schema, so a project can be created before
 * its customer is known.
 */
export interface ProjectCreateInput {
  alias_id: string;
  description?: string | null;
  customer_id?: string | null;
  user_id: string;
  template_id: string | null;
}

export interface ParameterInput {
  parameter_key: string;
  project_parameter_id: string;
  /**
   * The backend accepts `number | string | null`. Typing it `number | null`
   * made `inputFieldToParameterInput` coerce every non-numeric value to null,
   * silently discarding it on save. Widened here (plan 7, pulled forward from
   * step 4) because the H1 fallback path writes this row.
   */
  final_value: number | string | null;
  final_unit: string | null;
  is_human_modified: boolean;
  selected_candidate_id: string | null;
  flag: boolean;
  flag_reason: string | null;
  flagger_id: string | null;
  /** The row's review state: the server's, or what the person just did (PENDING | ACCEPTED | MODIFIED | REJECTED). */
  review_action: string;
}

export interface updateProjectParameter {
  parameter_alias: string | null;
  description_override: string | null;
  ai_instructions: string | null;
}

// --- Response Types (mirroring backend schemas) ---

export interface ProjectDocument {
  id: string;
  name: string;
  file_url: string;
  type: string;
  path?: string;
  analyzed?: boolean;
}

// One AI-extracted candidate value for a parameter. Mirrors the backend
// AiMetricCandidateOutput (snake_case). Confidence is on the 0–1 scale here.
export interface AiMetricCandidate {
  id: string;
  project_id?: string | null;
  ai_value?: number | string | null;
  unit?: string | null;
  expected_unit?: string | null;
  confidence?: number | null;
  is_calculated?: boolean | null;
  calculation_logic?: string | null;
  extraction_logic?: string | null;
  requires_review?: boolean | null;
  rule_violations?: string[] | null;
  source_document_id?: string | null;
  source_text_snippet?: string | null;
  source_reason?: string | null;
  source_anchor?: string | null;
  source_page_number?: number | null;
  source_bounding_box?: Record<string, unknown> | null;
  source_table_name?: string | null;
  source_cell_coordinates?: Record<string, unknown> | null;
  created_at?: string | null;
  param_name?: string | null;
  extraction_run_id?: string | null;
  run_number?: number | null;
}

export interface ProjectParameter {
  id: string;
  parameter_key: string;
  
  parameter_alias: string;  // Display name for the parameter, can be customized by user
 
  final_value: number | null;
  final_unit: string | null;
  is_human_modified: boolean;
  selected_candidate_id: string | null;
  review_action: string;
  reviewed_at: string | null;

  // Flagging fields (MUST match backend exactly)
  human_flagged: boolean;
  active_flag_id: string | null; // <--- THIS WAS MISSING
  flag_reason: string | null;
  flagger_id: string | null;

  // AI Candidate joined fields (denormalized selected candidate; confidence on 0–1 scale)
  confidence: number | null;
  source_text_snippet: string | null;
  source_page_number: number | null;

  // Full candidate list returned by GET /projects/{id} (FullProjectParameterOutput)
  candidates?: AiMetricCandidate[];

  // Extras
  description_override: string | null;
  ai_instructions: string | null;

  /** Canonical `parameters.id`. NOT unique per project: key on `id`, never on this. */
  parameter_id?: string | null;
  /** Since backend step 3.5. Null or absent groups the row under "Other". */
  category?: string | null;
}

export interface Project {
  id: string;
  alias_id: string;
  title?: string;
  name?: string;
  description?: string;
  customer?: string;
  status: string;
  created_at: string;
  documents?: ProjectDocument[];
  parameters?: ProjectParameter[];
}

// --- API Functions ---

export const apiCreateProject = async (data: ProjectCreateInput): Promise<{ project: Project }> => {
  const response = await fetch(`${API_BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiGetUserProjects = async (userId: string): Promise<{ projects: Project[] }> => {
  const response = await fetch(`${API_BASE_URL}/user/${userId}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiGetProjectDetails = async (projectId: string): Promise<Project> => {
  const response = await fetch(`${API_BASE_URL}/${projectId}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

/** A username the backend does not know (404 on the member routes). */
export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`User not found: no user is named "${username}".`);
    this.name = 'UserNotFoundError';
  }
}

async function addMember(projectId: string, role: 'contributors' | 'auditors', username: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${projectId}/${role}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (response.status === 404) throw new UserNotFoundError(username);
  if (!response.ok) throw new Error(await response.text());
}

/** POST /projects/{id}/contributors { username }. */
export const apiAddContributor = (projectId: string, username: string): Promise<void> =>
  addMember(projectId, 'contributors', username);

/** POST /projects/{id}/auditors { username }. */
export const apiAddAuditor = (projectId: string, username: string): Promise<void> =>
  addMember(projectId, 'auditors', username);

/**
 * POST /projects/update-project-status. **Form-encoded**, not JSON: the route
 * declares `Body_update_project_status_...` as
 * `application/x-www-form-urlencoded` with `project_id` and `new_status`.
 */
export const apiUpdateProjectStatus = async (projectId: string, status: ProjectStatus): Promise<ProjectStatus> => {
  const response = await fetch(`${API_BASE_URL}/update-project-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: statusFormBody(projectId, status).toString(),
  });
  if (!response.ok) throw new Error(await response.text());
  // `{message, status}`: `status` is what the database now holds (backend step 3.1).
  const body: { status: ProjectStatus } = await response.json();
  return body.status;
};

/**
 * PUT /projects/{id}/parameters (BatchParameterSaveInput). `reviewer_id` is the
 * signed-in user; the backend logs who changed what and answers 422 for an id
 * it does not know -- the caller shows that text and does not retry.
 */
export const apiSaveProjectParameters = async (
  projectId: string,
  parameters: ParameterInput[],
  reviewerId: string | null = null,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/${projectId}/parameters`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters, reviewer_id: reviewerId }),
  });
  if (!response.ok) throw new Error(await response.text());
};

/** POST /projects/{id}/approve with the optional ApproveInput body; 422 for an unknown reviewer. */
export const apiApproveProjectParameters = async (
  projectId: string,
  reviewerId: string | null = null,
): Promise<{ message: string, parameters_approved: number }> => {
  const response = await fetch(`${API_BASE_URL}/${projectId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_id: reviewerId }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

/**
 * GET /projects/{id}/extraction-runs -- every extraction attempt, newest
 * first (the backend already orders it that way). `extractionType` is an
 * optional query filter, e.g. `ITERATIVE` for just correction attempts.
 */
export const apiGetExtractionRuns = async (
  projectId: string,
  extractionType?: string,
): Promise<import('./types/projects').ExtractionRun[]> => {
  const query = extractionType ? `?extraction_type=${encodeURIComponent(extractionType)}` : '';
  const response = await fetch(`${API_BASE_URL}/${projectId}/extraction-runs${query}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiUpdateProjectParameter = async (project_parameter_id: string, parameterData: updateProjectParameter): Promise<void> => {
  // The trailing slash matters: the route is declared as
  // PATCH /projects/project-parameter/{id}/ and FastAPI answers 307 without
  // it. A redirected PATCH can lose its method or its body under CORS.
  const response = await fetch(`${API_BASE_URL}/project-parameter/${project_parameter_id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameterData),
  });
  if (!response.ok) throw new Error(await response.text());
}

/**
 * DELETE /projects/project-parameter/{id}/remove. A HARD delete of the
 * `project_parameters` row: its extracted candidates and its flag history go
 * with it (`ON DELETE CASCADE`), and nothing in the schema soft-deletes.
 */
export const apiRemoveProjectParameter = async (project_parameter_id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/project-parameter/${project_parameter_id}/remove`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await response.text());
};
