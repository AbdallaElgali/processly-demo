'use client';

import { useParams } from 'next/navigation';
import { Alert, Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { SectionTabs } from '@/components/ui/SectionTabs';
import { PinnedPrompts, Registry, ResolutionPreview } from '@/components/prompts/PromptsViews';
import { PROMPT_EDITING_AVAILABLE, PROMPT_EDITING_NOTE } from '@/lib/prompts/config';

/**
 * Prompts & Models (step 13, plan-A 6.6), read only: what this project
 * pinned, what the next run would resolve, and the registry. A reading
 * screen, so it caps its width (AM14) but uses the full table width.
 */
export default function PromptsAndModelsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1800, mx: 'auto' }}>
      <Typography variant="h5" component="h1" sx={{ color: 'text.primary', mb: 0.5 }}>Prompts &amp; Models</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Which prompt versions and models this project uses, and where each one comes from.
      </Typography>
      {!PROMPT_EDITING_AVAILABLE && (
        <Alert severity="warning" variant="outlined" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2.5 }}>
          <strong>No authentication.</strong> {PROMPT_EDITING_NOTE}
        </Alert>
      )}
      <SectionTabs
        label="Prompts and models"
        tabs={[
          { value: 'pinned', label: 'Pinned for this project', content: <PinnedPrompts projectId={projectId} /> },
          { value: 'next', label: 'Next run (resolution)', content: <ResolutionPreview projectId={projectId} /> },
          { value: 'registry', label: 'Registry', content: <Registry /> },
        ]}
      />
    </Box>
  );
}
