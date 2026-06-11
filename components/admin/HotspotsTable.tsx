'use client';

import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ErrorHotspot } from '@/api/analytics';
import { colors } from '@/theme/colors';

interface Props {
  hotspots: ErrorHotspot[];
}

const formatRate = (rate: number) => `${(rate * 100).toFixed(1)}%`;

const rateColor = (rate: number) => {
  if (rate >= 0.5) return colors.error;
  if (rate >= 0.2) return colors.warning;
  return colors.success;
};

export const HotspotsTable = ({ hotspots }: Props) => {
  const sorted = [...hotspots].sort((a, b) => b.error_rate - a.error_rate);

  return (
    <Paper
      elevation={0}
      sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden' }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Error Hotspots
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          Parameters with the highest correction rates
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: colors.textSecondary }}>Parameter</TableCell>
              <TableCell align="right" sx={{ color: colors.textSecondary }}>Reviews</TableCell>
              <TableCell align="right" sx={{ color: colors.textSecondary }}>Modifications</TableCell>
              <TableCell align="right" sx={{ color: colors.textSecondary }}>Error Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ color: colors.textSecondary, textAlign: 'center', py: 3 }}>
                  No hotspot data yet.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((row) => (
              <TableRow key={row.parameter_key} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{row.parameter_key}</TableCell>
                <TableCell align="right">{row.total_reviews}</TableCell>
                <TableCell align="right">{row.total_modifications}</TableCell>
                <TableCell align="right" sx={{ color: rateColor(row.error_rate), fontWeight: 600 }}>
                  {formatRate(row.error_rate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
