// src/api/projects.ts

const API_BASE_URL = 'http://localhost:8000/projects';

// --- Input Types ---

export interface ProjectCreateInput {
  alias_id: string;
  title?: string;
  description?: string;
  customer?: string;
  user_id: string;
}

export interface ParameterInput {
  parameter_key: string;
  final_value: number | null;
  final_unit: string | null;
  is_human_modified: boolean;
  selected_candidate_id: string | null;
}

// --- Response Types (mirroring backend schemas) ---

export interface ProjectDocument {
  id: string;
  name: string;
  file_url: string;
  type: string;
}

export interface ProjectParameter {
  id: string;
  parameter_key: string;
  final_value: number | null;
  final_unit: string | null;
  confidence: number | null;
  source_text_snippet: string | null;
  source_page_number: number | null;
  is_human_modified: boolean;
  human_flagged: boolean;
  flagger_id: string | null;
  flag_reason: string | null;
}

export interface Project {
  id: string;
  alias_id: string;
  title?: string;
  name?: string;
  description?: string;
  documents?: ProjectDocument[];
  parameters?: ProjectParameter[];
  status: "NEW" | "PENDING_REVIEW" | "IN_REVIEW" | "APPROVED";
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
  const response = await fetch(`${API_BASE_URL}/${projectId}/parameters`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters }), // Wraps in the BatchParameterSaveInput schema
  });
  if (!response.ok) throw new Error(await response.text());
};
