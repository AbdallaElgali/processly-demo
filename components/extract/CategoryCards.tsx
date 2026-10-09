'use client';

import { Box, Stack, Typography } from '@mui/material';
import { useProjectData } from '@/lib/jobs/hooks';
import { useCanonicalParameters } from '@/hooks/useCanonicalParameters';
import { KNOWN_CATEGORIES, normalizeCategoryKey, tallyByCategory } from '@/lib/categories';
import { CategoryCard, type CategoryCardState } from './CategoryCard';
import type { Job } from '@/lib/jobs/types';

/**
 * One card per category the project actually has parameters in (joining the
 * canonical dictionary on parameter key, D5), filling in as `partial` events
 * land. Categories with zero parameters in this project are not shown here --
 * unlike the Review table (step 8), a progress card for a category nothing
 * will ever fill in would be misleading rather than complete.
 */
export function CategoryCards({ projectId, job }: { projectId: string; job: Job }) {
  const projectState = useProjectData(projectId);
  const fields = projectState?.fields ?? [];
  const { parameters: canonical } = useCanonicalParameters();

  if (!canonical) {
    return (
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {KNOWN_CATEGORIES.map(([key, label]) => (
          <CategoryCard key={key} label={label} state="pending" found={0} total={0} />
        ))}
      </Stack>
    );
  }

  const tallies = tallyByCategory(fields, canonical);
  const doneKeys = new Set(job.progress.categoriesDone.map(normalizeCategoryKey));
  const failedKeys = new Set(job.progress.categoriesFailed.map(normalizeCategoryKey));
  const working = job.phase === 'extracting' || job.phase === 'supervising';

  if (tallies.length === 0) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
        Categories
      </Typography>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {tallies.map(({ category, total, filled }) => {
          const normalizedKey = normalizeCategoryKey(category.key);
          let state: CategoryCardState = 'pending';
          if (failedKeys.has(normalizedKey)) state = 'failed';
          else if (doneKeys.has(normalizedKey)) state = 'filled';
          else if (working) state = 'active';

          return (
            <CategoryCard key={category.key} label={category.label} state={state} found={filled} total={total} />
          );
        })}
      </Stack>
    </Box>
  );
}
