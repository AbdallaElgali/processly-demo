// src/api/projects.ts

const API_BASE_URL = 'http://localhost:8000/projects';

// --- Types (Mirroring backend schemas) ---
export interface ProjectCreateInput {
  alias_id: string;
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

// --- API Functions ---

export const apiCreateProject = async (data: ProjectCreateInput) => {
  const response = await fetch(`${API_BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiGetUserProjects = async (userId: string) => {
  const response = await fetch(`${API_BASE_URL}/user/${userId}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiGetProjectDetails = async (projectId: string) => {
  const response = await fetch(`${API_BASE_URL}/${projectId}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiAddContributor = async (projectId: string, username: string) => {
  const response = await fetch(`${API_BASE_URL}/${projectId}/contributors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

export const apiSaveProjectParameters = async (projectId: string, parameters: ParameterInput[]) => {
  const response = await fetch(`${API_BASE_URL}/${projectId}/parameters`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters }), // Wraps in the BatchParameterSaveInput schema
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};