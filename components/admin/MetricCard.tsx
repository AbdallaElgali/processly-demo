'use client';

import { Box, Paper, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { colors } from '@/theme/colors';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  caption?: string;
  accent?: string;
}

export const MetricCard = ({ label, value, caption, accent = colors.primary }: MetricCardProps) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        flex: 1,
        minWidth: 180,
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography variant="caption" sx={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color: accent, fontWeight: 700 }}>
        {value}
      </Typography>
      {caption && (
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          {caption}
        </Typography>
      )}
      <Box sx={{ height: 3, width: 32, bgcolor: accent, mt: 1, borderRadius: 2 }} />
    </Paper>
  );
};
