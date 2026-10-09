'use client';

import { useParams } from 'next/navigation';
import { Box, Typography } from '@mui/material';
import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';
import { RunsTab } from '@/components/workspace/RunsTab';

/**
 * Audit. The Runs table moved here from the retired Extract screen (AM11) and
 * is live already; the rest (per-parameter history and lineage) is step 13.
 */
export default function AuditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Box>
      <Box sx={{ px: 4, pt: 4 }}>
        <Typography variant="h5" sx={{ color: 'text.primary', mb: 0.5 }}>Runs</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Every extraction run for this project, newest first.
        </Typography>
        <RunsTab projectId={projectId} />
      </Box>
      <ScreenPlaceholder
        title="Parameter history"
        step="Step 13"
        summary="Per-parameter history: every candidate, flag and run that produced the current value."
        routes={['GET /audit/project/{id}', 'GET /audit/project/{id}/parameter/{key}/lineage']}
      />
    </Box>
  );
}
