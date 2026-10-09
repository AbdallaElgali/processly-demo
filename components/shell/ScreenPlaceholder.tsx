'use client';

import Link from 'next/link';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';

/**
 * A screen the shell routes to but that its own step has not built yet.
 *
 * Deliberately explicit about which step fills it in and what will be shown,
 * so an empty tab reads as planned work rather than a broken page
 * (CLAUDE.md 8.4: an empty state always offers a next action).
 */
export function ScreenPlaceholder({
  title,
  step,
  summary,
  routes,
  action,
}: {
  title: string;
  step: string;
  summary: string;
  routes?: string[];
  action?: { label: string; href: string };
}) {
  return (
    <Box sx={{ p: 4, maxWidth: 760 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ color: 'text.primary' }}>{title}</Typography>
        <Chip size="small" label={step} sx={{ bgcolor: 'status.neutralBg', color: 'status.neutral' }} />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>{summary}</Typography>

      <Paper
        variant="outlined"
        sx={{ p: 3, borderStyle: 'dashed', borderColor: 'border.strong', bgcolor: 'surface.panel' }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <ConstructionOutlinedIcon fontSize="small" sx={{ color: 'text.muted', mt: 0.25 }} />
          <Box>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Not built yet
            </Typography>
            {routes && routes.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.5 }}>
                Will use: {routes.join(', ')}
              </Typography>
            )}
            {action && (
              <Button component={Link} href={action.href} size="small" sx={{ mt: 1.5, ml: -1 }}>
                {action.label}
              </Button>
            )}
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
