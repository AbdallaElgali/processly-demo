'use client';

import { Box, Paper, Typography } from '@mui/material';
import { ConfidenceMetrics } from '@/api/analytics';
import { colors } from '@/theme/colors';

interface Props {
  confidence: ConfidenceMetrics;
}

const Bar = ({ value, color }: { value: number; color: string }) => {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <Box sx={{ position: 'relative', height: 10, bgcolor: colors.surfaceHighlight, borderRadius: 4 }}>
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          bgcolor: color,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }}
      />
    </Box>
  );
};

export const ConfidencePanel = ({ confidence }: Props) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          AI Confidence Calibration
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          Mean model confidence on accepted vs corrected values
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2">Accepted</Typography>
          <Typography variant="body2" sx={{ color: colors.success, fontWeight: 600 }}>
            {(confidence.avg_ai_confidence_accepted * 100).toFixed(1)}%
          </Typography>
        </Box>
        <Bar value={confidence.avg_ai_confidence_accepted} color={colors.success} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2">Modified</Typography>
          <Typography variant="body2" sx={{ color: colors.warning, fontWeight: 600 }}>
            {(confidence.avg_ai_confidence_modified * 100).toFixed(1)}%
          </Typography>
        </Box>
        <Bar value={confidence.avg_ai_confidence_modified} color={colors.warning} />
      </Box>
    </Paper>
  );
};
