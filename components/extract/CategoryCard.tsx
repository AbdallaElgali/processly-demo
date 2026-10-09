'use client';

import { Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';

export type CategoryCardState = 'pending' | 'active' | 'filled' | 'failed';

const ICON: Record<CategoryCardState, React.ComponentType<{ fontSize?: 'inherit' | 'small' }>> = {
  pending: HourglassEmptyOutlinedIcon,
  active: HourglassEmptyOutlinedIcon,
  filled: CheckCircleOutlineIcon,
  failed: ErrorOutlineOutlinedIcon,
};

const COLOR: Record<CategoryCardState, string> = {
  pending: 'text.muted',
  active: 'status.info',
  filled: 'status.success',
  failed: 'status.danger',
};

const STATE_LABEL: Record<CategoryCardState, string> = {
  pending: 'Not started',
  active: 'Working',
  filled: 'Done',
  failed: 'Failed',
};

/**
 * One category's progress during a run (plan §2): pending while the category
 * has not been reached, a short fade+rise when it fills in on a `partial`
 * event, and a distinct failed state for `category_workers_failed` -- which
 * is still a per-category warning, never the whole run (CLAUDE.md 4).
 */
export function CategoryCard({
  label,
  state,
  found,
  total,
}: {
  label: string;
  state: CategoryCardState;
  found: number;
  total: number;
}) {
  const Icon = ICON[state];

  return (
    <Paper
      variant="outlined"
      role="status"
      aria-label={`${label}: ${STATE_LABEL[state]}, ${found} of ${total} found`}
      sx={{
        p: 1.5,
        minWidth: 140,
        borderColor: state === 'failed' ? 'status.danger' : 'border.subtle',
        bgcolor: 'surface.panel',
        // The "cards filling in" motion the RFC asks for, capped at the
        // project's 200ms motion ceiling and skipped under reduced motion via
        // the global CssBaseline reset.
        transition: (t) => t.transitions.create(['opacity', 'border-color'], { duration: 160 }),
        opacity: state === 'pending' ? 0.7 : 1,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Icon fontSize="small" />
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, flex: 1 }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ mt: 1 }}>
        {state === 'pending' ? (
          <Skeleton variant="text" width={64} />
        ) : (
          <Typography variant="caption" sx={{ color: COLOR[state] }}>
            {state === 'failed' ? STATE_LABEL.failed : `${found} / ${total} found`}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
