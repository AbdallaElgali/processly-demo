'use client';

import { useState } from 'react';
import { Box, ButtonBase, Popover, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { JobBanner } from '@/components/jobs/JobBanner';
import { jobKindLabel, runningJobText } from '@/lib/jobs/label';
import { keepOpenText } from '@/lib/jobs/closeGuard';
import { SAVED_AWAY_TEXT, interruptedUploadText } from '@/lib/jobs/uploadRecovery';

type Tone = 'info' | 'warning' | 'danger' | 'success';

/**
 * The project's background work as ONE line in the Workspace toolbar (AM11).
 * Clicking it opens the full `JobBanner` (timeline, warnings, Stop / Cancel /
 * Run again / Dismiss) in a popover, so the table and viewer keep the whole
 * screen while a run is going. Renders nothing when the project is idle.
 */
export function JobStatusLine({ projectId }: { projectId: string }) {
  const activity = useProjectActivity(projectId);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  const { running, queued } = activity;
  const failed = activity.failed[0];
  const interrupted = activity.interrupted[0];
  const unseen = activity.unseenCompleted[0];

  let tone: Tone;
  let text: string;
  let pulse = false;
  let warnings = 0;
  if (running) {
    tone = 'info';
    pulse = true;
    warnings = running.warnings.length;
    text = runningJobText(running);
  } else if (queued) {
    tone = 'info';
    text = `${jobKindLabel(queued.job.kind)} queued, position ${queued.position}`;
  } else if (interrupted) {
    tone = 'warning';
    // Only extraction and correction streams really save nothing when the tab
    // goes (D9); a sent upload is checked against the project (backend U1).
    text = interrupted.kind === 'upload'
      ? interruptedUploadText(interrupted.uploadCheck)
      : `${jobKindLabel(interrupted.kind)} interrupted; nothing was saved`;
  } else if (failed) {
    tone = 'danger';
    text = `${jobKindLabel(failed.kind)} failed`;
  } else if (unseen) {
    tone = 'success';
    text = unseen.savedWhileAway ? SAVED_AWAY_TEXT : 'New results are in';
  } else {
    return null;
  }

  const keepOpen = running ? keepOpenText([running]) : null;

  const color = { info: 'status.info', warning: 'status.warning', danger: 'status.danger', success: 'status.success' }[tone];
  const bg = { info: 'status.infoBg', warning: 'status.warningBg', danger: 'status.dangerBg', success: 'status.successBg' }[tone];

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${text}${keepOpen ? `. ${keepOpen}` : ''}. Show details`}
        sx={{
          px: 1.25,
          py: 0.5,
          borderRadius: 999,
          bgcolor: bg,
          color,
          maxWidth: { xs: 420, lg: 640 },
          '&:hover': { filter: 'brightness(0.97)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'accent.focus', outlineOffset: 2 },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0,
              ...(pulse && {
                animation: 'bdaJobLinePulse 1.6s ease-in-out infinite',
                '@keyframes bdaJobLinePulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }),
            }}
          />
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'inherit' }}>
            {text}
          </Typography>
          {keepOpen && (
            <Typography variant="caption" noWrap sx={{ color: 'inherit', opacity: 0.85, display: { xs: 'none', lg: 'block' } }}>
              · {keepOpen}
            </Typography>
          )}
          {warnings > 0 && (
            <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: 'status.warning' }}>
              <WarningAmberIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{warnings}</Typography>
            </Stack>
          )}
          <ExpandMoreIcon sx={{ fontSize: 18 }} />
        </Stack>
      </ButtonBase>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 640, maxWidth: 'calc(100vw - 32px)', pb: 2, bgcolor: 'surface.raised' } } }}
      >
        <JobBanner projectId={projectId} />
      </Popover>
    </>
  );
}
