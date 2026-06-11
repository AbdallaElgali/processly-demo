'use client';

import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import { ABTestMetric } from '@/api/analytics';
import { colors } from '@/theme/colors';

interface Props {
  data: ABTestMetric[];
}

export const ABTestPanel = ({ data }: Props) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          A/B Test: Extraction Pipelines
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          Acceptance rate by extraction type
        </Typography>
      </Box>

      {data.length === 0 && (
        <Typography variant="body2" sx={{ color: colors.textSecondary, py: 2, textAlign: 'center' }}>
          No A/B test data yet.
        </Typography>
      )}

      {data.map((row) => {
        const ratePct = row.acceptance_rate * 100;
        return (
          <Box key={row.extraction_type} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {row.extraction_type}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                {row.total_parameters} params · <strong style={{ color: colors.primary }}>{ratePct.toFixed(1)}%</strong>
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, ratePct))}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: colors.surfaceHighlight,
                '& .MuiLinearProgress-bar': { bgcolor: colors.primary },
              }}
            />
          </Box>
        );
      })}
    </Paper>
  );
};
