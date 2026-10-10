'use client';

import { useParams } from 'next/navigation';
import { Box } from '@mui/material';
import { SplitPane } from '@/components/ui/SplitPane';
import { ProjectParameters } from '@/components/parameters/ProjectParameters';
import { TemplatesPanel } from '@/components/parameters/TemplatesPanel';
import { useProjectData } from '@/lib/jobs/hooks';
import { useProjectsIndex } from '@/lib/project-data/provider';

/**
 * Parameters (plan-A 6.5, AM14): a working screen, so full-bleed with a
 * resizable split. Left: this project's parameter schema. Right: extraction
 * templates.
 */
export default function ParametersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const state = useProjectData(projectId);
  const { projects } = useProjectsIndex();
  const projectName = state?.details?.alias_id ?? projects.find((p) => p.id === projectId)?.alias_id ?? null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SplitPane
        storageKey="bda.parameters.split"
        label="Resize project parameters and templates"
        defaultRatio={0.58}
        left={<ProjectParameters projectId={projectId} />}
        right={<TemplatesPanel projectId={projectId} projectName={projectName} parameterCount={state?.fields.length ?? 0} />}
      />
    </Box>
  );
}
