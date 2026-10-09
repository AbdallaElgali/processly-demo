'use client';

import { Button, Stack, Typography } from '@mui/material';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

/**
 * A failed fetch, with the one next action that actually resolves it: retry.
 * Distinct from `EmptyState` (which means "loaded fine, there is nothing"),
 * and in `status.danger` so it does not read as a neutral empty list.
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 8, px: 2, textAlign: 'center' }}>
      <ErrorOutlineOutlinedIcon sx={{ fontSize: 40, color: 'status.danger' }} />
      <Typography variant="h6" sx={{ color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {onRetry && (
        <Button variant="outlined" onClick={onRetry} sx={{ mt: 0.5 }}>
          Retry
        </Button>
      )}
    </Stack>
  );
}
