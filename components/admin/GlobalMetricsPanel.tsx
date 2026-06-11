'use client';

import { Box } from '@mui/material';
import { GlobalMetrics } from '@/api/analytics';
import { colors } from '@/theme/colors';
import { MetricCard } from './MetricCard';

interface Props {
  metrics: GlobalMetrics;
}

export const GlobalMetricsPanel = ({ metrics }: Props) => {
  const acceptanceLabel = `${metrics.acceptance_rate_percent.toFixed(1)}%`;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      <MetricCard
        label="Acceptance Rate"
        value={acceptanceLabel}
        caption={`${metrics.accepted_count} accepted of ${metrics.total_parameters}`}
        accent={colors.success}
      />
      <MetricCard
        label="Total Parameters"
        value={metrics.total_parameters}
        caption="All reviewed values across projects"
      />
      <MetricCard
        label="Accepted"
        value={metrics.accepted_count}
        caption="Approved without modification"
        accent={colors.success}
      />
      <MetricCard
        label="Corrected"
        value={metrics.corrected_count}
        caption="Human-modified values"
        accent={colors.warning}
      />
      <MetricCard
        label="Pending"
        value={metrics.pending_count}
        caption="Awaiting review"
        accent={colors.textSecondary}
      />
    </Box>
  );
};
