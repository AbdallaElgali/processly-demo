import { config } from './config';

const API_URL = config.api;

const API_BASE_URL = API_URL + '/projects';


export interface ProjectCreateInput {
  alias_id: string;
  title?: string;
  description?: string;
  customer?: string;
  user_id: string;
  template_id: string | null;  // MUST ADD
  customer_id: string;  // MUST ADD
}

export interface ParameterInput {
  parameter_key: string;
  project_parameter_id: string;
  final_value: number | null;
  final_unit: string | null;
  is_human_modified: boolean;
  selected_candidate_id: string | null;
  flag: boolean;
  flag_reason: string | null;
  flagger_id: string | null;
  review_action: string;
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

export const apiAddContributor = async (projectId: string, username: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/${projectId}/contributors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error(await response.text());
};

export const apiSaveProjectParameters = async (projectId: string, parameters: ParameterInput[]): Promise<void> => {
  console.log('Parameters to save: (1)', parameters);
  const response = await fetch(`${API_BASE_URL}/${projectId}/parameters`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters }), // Wraps in the BatchParameterSaveInput schema
  });
  if (!response.ok) throw new Error(await response.text());
};

export const apiApproveProjectParameters = async (projectId: string): Promise<{ message: string, parameters_approved: number }> => {
  const response = await fetch(`${API_BASE_URL}/${projectId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};