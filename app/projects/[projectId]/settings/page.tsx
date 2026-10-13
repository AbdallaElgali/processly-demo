'use client';

import { useParams } from 'next/navigation';
import { Box, Skeleton, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorState } from '@/components/ui/ErrorState';
import { AppearanceCard } from '@/components/settings/AppearanceCard';
import { ReviewPreferencesCard } from '@/components/settings/ReviewPreferencesCard';
import { MembersCard } from '@/components/settings/MembersCard';
import { ProjectDetailsCard } from '@/components/settings/ProjectDetailsCard';
import { useProjectData } from '@/lib/jobs/hooks';
import { loadProjectDetails } from '@/lib/project-data/actions';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
  gap: 2,
  alignItems: 'stretch',
} as const;

/**
 * Settings (step 12, plan-A 6.8): appearance, review preferences, members and
 * the project's details. Appearance and review preferences belong to the
 * person, so they show at once; members and details wait for the project.
 */
export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const state = useProjectData(projectId);
  const details = state?.details ?? null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1800 }}>
      <Typography variant="h4" component="h1" sx={{ color: 'text.primary', mb: 3 }}>Settings</Typography>
      <Box sx={GRID}>
        <AppearanceCard />
        <ReviewPreferencesCard />
        {details ? (
          <>
            <ProjectDetailsCard details={details} userId={user?.id ?? null} />
            <MembersCard projectId={projectId} />
          </>
        ) : state?.error ? (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <ErrorState title="Could not load this project" description={state.error} onRetry={() => void loadProjectDetails(projectId)} />
          </Box>
        ) : (
          <>
            <Skeleton variant="rounded" height={170} aria-label="Loading project details" />
            <Skeleton variant="rounded" height={240} aria-label="Loading members" />
          </>
        )}
      </Box>
    </Box>
  );
}
