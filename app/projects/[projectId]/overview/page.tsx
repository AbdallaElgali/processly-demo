'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusChip } from '@/components/ui/StatusChip';
import { ReviewProgressCard } from '@/components/overview/ReviewProgressCard';
import { StatusCard } from '@/components/overview/StatusCard';
import { DocumentsCard, JobStateCard, LastRunCard } from '@/components/overview/ActivityCards';
import { useExtractionRuns } from '@/hooks/useExtractionRuns';
import { useJobs, useProjectData } from '@/lib/jobs/hooks';
import { loadProjectDetails } from '@/lib/project-data/actions';
import { reviewProgress } from '@/lib/overview/progress';

/** Cards fill the width: as many columns as fit, never one narrow centred column (AM14). */
const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 2,
  alignItems: 'stretch',
} as const;

/**
 * Overview (step 12, plan-A 6.2): where the project stands. Review progress
 * is separate from the project status because Approve does not change the
 * status (B10).
 */
export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const state = useProjectData(projectId);
  const details = state?.details ?? null;
  const fields = state?.fields;
  const progress = useMemo(() => reviewProgress(fields ?? []), [fields]);

  // A finished job of this project means a new run (and new values): look again.
  const jobs = useJobs();
  const settled = jobs.filter((j) => j.projectId === projectId && j.status === 'completed').length;
  const { runs, error: runsError, reload } = useExtractionRuns(projectId, settled);

  if (!details) {
    if (state?.error) {
      return <ErrorState title="Could not load this project" description={state.error} onRetry={() => void loadProjectDetails(projectId)} />;
    }
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }} aria-busy="true" aria-label="Loading the overview">
        <Skeleton variant="rounded" height={44} width={320} sx={{ mb: 3 }} />
        <Box sx={GRID}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={190} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1800 }}>
      <Stack direction="row" alignItems="flex-start" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>{details.alias_id}</Typography>
            <StatusChip status={details.status} />
          </Stack>
          <Typography variant="body2" sx={{ color: details.description ? 'text.secondary' : 'text.muted', fontStyle: details.description ? 'normal' : 'italic', mt: 0.5, maxWidth: 720 }}>
            {details.description || 'No description.'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.5 }}>
            Created {new Date(details.created_at).toLocaleDateString()}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href={`/projects/${projectId}/workspace`} variant="contained" endIcon={<ArrowForwardIcon />}>
            Open Workspace
          </Button>
          <Button component={Link} href={`/projects/${projectId}/parameters`} variant="outlined">
            Parameters
          </Button>
        </Stack>
      </Stack>

      <Box sx={GRID}>
        <ReviewProgressCard progress={progress} />
        <StatusCard projectId={projectId} status={details.status} />
        <DocumentsCard projectId={projectId} documents={details.documents ?? []} />
        <LastRunCard projectId={projectId} runs={runs} error={runsError} onRetry={reload} />
        <JobStateCard projectId={projectId} />
      </Box>
    </Box>
  );
}
