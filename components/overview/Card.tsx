'use client';

import type { ReactNode } from 'react';
import { Paper, Stack, Typography, type SvgIconProps } from '@mui/material';

/** The Overview's and Settings' card: an icon and title row above its content. */
export function Card({
  title,
  icon: Icon,
  action,
  children,
  sx,
  id,
}: {
  title: string;
  icon?: React.ComponentType<SvgIconProps>;
  action?: ReactNode;
  children: ReactNode;
  sx?: object;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ bgcolor: 'surface.panel', borderColor: 'border.subtle', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, ...sx }}
    >
      <Stack direction="row" alignItems="center" spacing={1} useFlexGap>
        {Icon && <Icon fontSize="small" sx={{ color: 'text.muted' }} aria-hidden />}
        <Typography id={headingId} variant="subtitle2" component="h2" sx={{ color: 'text.primary', flex: 1 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

/** A label above a value, for the small facts inside a card. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.muted' }}>{label}</Typography>
      <Typography variant="body2" component="div" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>{children}</Typography>
    </Stack>
  );
}
