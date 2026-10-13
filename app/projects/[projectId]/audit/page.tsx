'use client';

import { useParams } from 'next/navigation';
import { Box, Typography } from '@mui/material';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionTabs } from '@/components/ui/SectionTabs';
import { RunsTab } from '@/components/workspace/RunsTab';
import { ParametersAudit } from '@/components/audit/ParametersAudit';
import { FeedbackTab } from '@/components/audit/FeedbackTab';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';

/**
 * Audit (step 13, plan-A 6.7): what happened to each parameter, every
 * extraction run, and the feedback left on the project. A working screen
 * (AM14): it fills the width, no centred column.
 */
export default function AuditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" component="h1" sx={{ color: 'text.primary', mb: 0.5 }}>Audit</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        How each value came to be: every candidate, run and flag, the extraction runs, and feedback.
      </Typography>
      <SectionTabs
        label="Audit"
        tabs={[
          { value: 'parameters', label: 'Parameters', content: <ParametersAudit projectId={projectId} /> },
          { value: 'runs', label: 'Runs', content: <RunsTab projectId={projectId} /> },
          {
            value: 'flags',
            label: 'Flags',
            content: (
              <EmptyState
                icon={FlagOutlinedIcon}
                title="Project-wide flag list unavailable"
                description="No backend route lists the flags of a whole project (backend B8). Open a parameter on the Parameters tab to see its flags and how they were resolved; the 'Only with flags' switch finds them."
              />
            ),
          },
          { value: 'feedback', label: 'Feedback', content: <FeedbackTab projectId={projectId} /> },
        ]}
      />
    </Box>
  );
}
