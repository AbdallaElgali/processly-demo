'use client';

import { Box, Skeleton, Stack } from '@mui/material';

/**
 * Skeletons instead of spinners wherever the layout is already known
 * (CLAUDE.md 8.4). `components/jobs` and `components/viewer` add their own
 * (parameter-row and viewer-page skeletons, steps 8-9) once those layouts
 * exist; these two cover the shapes the app already has: a card grid and a
 * table's rows.
 */
export function SkeletonCardGrid({ count = 6, minWidth = 260, height = 132 }: {
  count?: number;
  minWidth?: number;
  height?: number;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={height} />
      ))}
    </Box>
  );
}

export function SkeletonRows({ count = 5, columns = 1 }: { count?: number; columns?: number }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, i) => (
        <Stack key={i} direction="row" spacing={2}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} variant="text" sx={{ flex: c === 0 ? 2 : 1 }} height={32} />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
