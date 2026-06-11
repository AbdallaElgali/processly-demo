'use client';

import { Box, Paper, Typography } from '@mui/material';
import { VelocityMetric } from '@/api/analytics';
import { colors } from '@/theme/colors';

interface Props {
  data: VelocityMetric[];
}

const CHART_HEIGHT = 160;
const CHART_PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const VelocityChart = ({ data }: Props) => {
  const sorted = [...data].sort((a, b) => a.review_date.localeCompare(b.review_date));

  const maxValue = sorted.reduce((m, d) => Math.max(m, d.parameters_verified), 0) || 1;
  const width = 560;
  const innerWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const points = sorted.map((d, i) => {
    const x =
      sorted.length === 1
        ? CHART_PADDING.left + innerWidth / 2
        : CHART_PADDING.left + (i / (sorted.length - 1)) * innerWidth;
    const y = CHART_PADDING.top + innerHeight - (d.parameters_verified / maxValue) * innerHeight;
    return { x, y, d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${CHART_PADDING.top + innerHeight} L ${points[0].x} ${
          CHART_PADDING.top + innerHeight
        } Z`
      : '';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Review Velocity
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          Parameters verified per day
        </Typography>
      </Box>

      {sorted.length === 0 ? (
        <Typography variant="body2" sx={{ color: colors.textSecondary, py: 4, textAlign: 'center' }}>
          No velocity data yet.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <svg width={width} height={CHART_HEIGHT} role="img" aria-label="Review velocity chart">
            {/* Y axis grid + ticks */}
            {[0, 0.5, 1].map((t) => {
              const y = CHART_PADDING.top + innerHeight - t * innerHeight;
              return (
                <g key={t}>
                  <line
                    x1={CHART_PADDING.left}
                    x2={CHART_PADDING.left + innerWidth}
                    y1={y}
                    y2={y}
                    stroke={colors.border}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={CHART_PADDING.left - 6}
                    y={y + 4}
                    fontSize={10}
                    textAnchor="end"
                    fill={colors.textSecondary}
                  >
                    {Math.round(maxValue * t)}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            <path d={areaPath} fill={colors.primary} fillOpacity={0.15} />
            {/* Line */}
            <path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2} />

            {/* Points + x-axis labels */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3.5} fill={colors.primary} />
                <title>{`${p.d.review_date}: ${p.d.parameters_verified}`}</title>
                {(i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0) && (
                  <text
                    x={p.x}
                    y={CHART_HEIGHT - 8}
                    fontSize={10}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                  >
                    {formatDate(p.d.review_date)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </Box>
      )}
    </Paper>
  );
};
