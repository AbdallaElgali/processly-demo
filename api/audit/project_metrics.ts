import { config } from '@/api/config';
import type { ProjectMetrics, ProjectSummary } from '@/types/audit';

export const fetch_project_metrics = async (): Promise<ProjectMetrics[]> => {
    const response = await fetch(`${config.api}/audit/projects`);
    if (response.status === 200) {
        const data = await response.json();
        return data.metrics as ProjectMetrics[];
    }
    throw new Error('Response status ' + response.status + ' returned but no error.');
};


export const fetch_project_summary = async(project_id: string, signal?: AbortSignal): Promise<ProjectSummary[]> => {
    const response = await fetch(`${config.api}/audit/project/${encodeURIComponent(project_id)}`, { signal });
    if (response.status === 200){
        const data = await response.json();
        return data.summary as ProjectSummary[];
    };
    console.error(response);
    throw new Error('Response status ' + response.status + ' returned but no error.');
}

import type { ParameterLineageResponse } from '@/types/audit';

export const fetch_parameter_lineage = async (
  project_id: string, 
  parameter_key: string,
  signal?: AbortSignal,
): Promise<ParameterLineageResponse> => {
  const response = await fetch(`${config.api}/audit/project/${encodeURIComponent(project_id)}/parameter/${encodeURIComponent(parameter_key)}/lineage`, { signal });
  
  if (response.status === 200) {
    const data = await response.json();
    
    // FIX: Extract the actual response object from the "lineage" wrapper
    return data.lineage as ParameterLineageResponse;
  }
  
  console.error(response);
  throw new Error(`Response status ${response.status} returned but no error.`);
};