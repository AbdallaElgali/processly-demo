'use client';

import { Button, Stack, Typography } from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';

/**
 * The backend has no file for this document (D7): `GET /documents/{id}/file`
 * answered 404 or 410. The extracted values do not depend on the file, so
 * they are untouched; only the viewer is affected. The source text the
 * extraction recorded is still shown in the source bar above.
 */
export function SourceUnavailable({ name, onRetry }: { name: string; onRetry: () => void }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%', px: 3, textAlign: 'center', bgcolor: 'surface.canvas' }}>
      <CloudOffOutlinedIcon sx={{ fontSize: 40, color: 'text.muted' }} />
      <Typography variant="h6" sx={{ color: 'text.primary' }}>
        Source unavailable, values preserved
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 440 }}>
        The original file of <strong>{name}</strong> is no longer stored on the server, so it cannot be shown. The parameters
        extracted from it are unaffected, and the recorded source text still appears when you show a value&apos;s source.
      </Typography>
      <Button variant="outlined" size="small" onClick={onRetry}>
        Check again
      </Button>
    </Stack>
  );
}
