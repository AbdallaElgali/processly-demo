'use client';

import { useParams } from 'next/navigation';
import { Alert, Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { SectionTabs } from '@/components/ui/SectionTabs';
import { PinnedPrompts, Registry, ResolutionPreview } from '@/components/prompts/PromptsViews';
import { ProjectPromptSettings } from '@/components/prompts/ProjectPromptSettings';
import { PROMPT_EDITING_AVAILABLE, PROMPT_EDITING_NOTE } from '@/lib/prompts/config';

/**
 * Prompts, read only: what this project
 * pinned, what the next run would resolve, and the registry. A reading
 * screen, so it caps its width (AM14) but uses the full table width.
 */
export default function PromptsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1800, mx: 'auto' }}>
      <Typography variant="h5" component="h1" sx={{ color: 'text.primary', mb: 0.5 }}>Prompts</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Which category prompts this project uses, and where each one comes from.
      </Typography>
      {!PROMPT_EDITING_AVAILABLE && (
        <Alert severity="warning" variant="outlined" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2.5 }}>
          <strong>No authentication.</strong> {PROMPT_EDITING_NOTE}
        </Alert>
      )}
      <SectionTabs
        label="Prompts"
        tabs={[
          { value: 'project', label: 'Prompts for this project', content: <ProjectPromptSettings projectId={projectId} /> },
          { value: 'pinned', label: 'Pinned for this project', content: <PinnedPrompts projectId={projectId} /> },
          { value: 'next', label: 'Next run', content: <ResolutionPreview projectId={projectId} /> },
          { value: 'registry', label: 'Library', content: <Registry /> },
        ]}
      />
    </Box>
  );
}
