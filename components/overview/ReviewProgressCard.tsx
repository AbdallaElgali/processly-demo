'use client';

import { Box, Stack, Typography } from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { reviewedPercent, type ReviewProgress } from '@/lib/overview/progress';
import { Card } from './Card';

const SEGMENTS = [
  { key: 'reviewed', label: 'Reviewed', hint: 'Accepted, edited or rejected by a reviewer', icon: CheckCircleOutlineIcon, bg: 'status.success', fg: 'status.success' },
  { key: 'pending', label: 'Pending', hint: 'Has a value, no decision yet', icon: HourglassEmptyIcon, bg: 'status.info', fg: 'status.info' },
  { key: 'flagged', label: 'Flagged', hint: 'An open flag raised by a reviewer', icon: OutlinedFlagIcon, bg: 'status.danger', fg: 'status.danger' },
  { key: 'empty', label: 'Empty', hint: 'No value: not extracted, or not found', icon: RemoveCircleOutlineIcon, bg: 'status.neutral', fg: 'text.secondary' },
] as const;

/**
 * Review progress, shown apart from the project status because Approve does
 * not change the status (B10). The bar is for the eye; the legend carries the
 * numbers and an icon per bucket, so no meaning rests on colour alone (8.3).
 */
export function ReviewProgressCard({ progress }: { progress: ReviewProgress }) {
  const percent = reviewedPercent(progress);
  const summary = `${progress.reviewed} reviewed, ${progress.pending} pending, ${progress.flagged} flagged, ${progress.empty} empty, of ${progress.total} parameters`;

  return (
    <Card title="Review progress" icon={FactCheckOutlinedIcon} id="review-progress" sx={{ gridColumn: { xs: 'auto', lg: 'span 2' } }}>
      {progress.total === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          This project has no parameters yet, so there is nothing to review.
        </Typography>
      ) : (
        <>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="h4" component="p" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {percent}%
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              reviewed · {progress.reviewed} of {progress.total} parameters
            </Typography>
          </Stack>

          <Box
            role="img"
            aria-label={summary}
            sx={{ display: 'flex', height: 12, borderRadius: 1, overflow: 'hidden', bgcolor: 'surface.sunken', gap: '2px' }}
          >
            {SEGMENTS.map((s) =>
              progress[s.key] > 0 ? (
                <Box key={s.key} sx={{ flexGrow: progress[s.key], flexBasis: 0, bgcolor: s.bg, minWidth: 4 }} />
              ) : null,
            )}
          </Box>

          <Box
            component="dl"
            sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5 }}
          >
            {SEGMENTS.map((s) => {
              const Icon = s.icon;
              return (
                <Box key={s.key} title={s.hint}>
                  <Stack component="dt" direction="row" alignItems="center" spacing={0.75} sx={{ color: s.fg }}>
                    <Icon sx={{ fontSize: 16 }} aria-hidden />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{s.label}</Typography>
                  </Stack>
                  <Typography component="dd" variant="h6" sx={{ m: 0, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                    {progress[s.key]}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {progress.outOfBounds > 0 && (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'status.warning' }}>
              <WarningAmberIcon sx={{ fontSize: 16 }} aria-hidden />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {progress.outOfBounds} {progress.outOfBounds === 1 ? 'value is' : 'values are'} out of bounds (auto-flag). Approve still allows it.
              </Typography>
            </Stack>
          )}
        </>
      )}
    </Card>
  );
}
