'use client';

import { FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { Card } from '@/components/overview/Card';
import { DensityToggle } from '@/components/ui/DensityToggle';
import { useLocalStorageFlag } from '@/hooks/useLocalStorageFlag';
import { COMPACT_KEY, REVIEW_FIRST_KEY } from '@/lib/review/preferences';

/**
 * The Workspace's two display preferences, with the same keys the Workspace
 * toolbar uses, so changing one here changes it there. Kept in this browser
 * only: the backend has no field for them.
 */
export function ReviewPreferencesCard() {
  const [compact, setCompact] = useLocalStorageFlag(COMPACT_KEY, false);
  const [reviewFirst, setReviewFirst] = useLocalStorageFlag(REVIEW_FIRST_KEY, true);
  return (
    <Card title="Review preferences" icon={TuneOutlinedIcon} id="review-preferences">
      <Stack spacing={0.5}>
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Row density</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <DensityToggle value={compact ? 'compact' : 'comfortable'} onChange={(d) => setCompact(d === 'compact')} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{compact ? 'Compact rows' : 'Comfortable rows'}</Typography>
        </Stack>
      </Stack>
      <Stack spacing={0.25}>
        <FormControlLabel
          control={<Switch checked={reviewFirst} onChange={(e) => setReviewFirst(e.target.checked)} />}
          label="Needs review first"
          sx={{ ml: 0 }}
        />
        <Typography variant="caption" sx={{ color: 'text.muted' }}>
          Sorts flagged, out-of-bounds and doubtful parameters to the top of each category in the Workspace.
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.muted' }}>
        Remembered in this browser only. The confidence threshold is fixed for now.
      </Typography>
    </Card>
  );
}
