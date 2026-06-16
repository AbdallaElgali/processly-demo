import { config } from '@/api/config';
import type { ProjectMetrics } from '@/types/audit';

export const fetch_project_metrics = async (): Promise<ProjectMetrics[]> => {
    const response = await fetch(`${config.api}/audit/projects`);
    if (response.status === 200) {
        const data = await response.json();
        return data.metrics as ProjectMetrics[];
    }
    throw new Error('Response status ' + response.status + ' returned but no error.');
};
