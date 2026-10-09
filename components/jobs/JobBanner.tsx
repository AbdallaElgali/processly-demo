'use client';

import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { jobRuntime } from '@/lib/jobs/runtime';
import { jobStore } from '@/lib/jobs/store';
import type { Job } from '@/lib/jobs/types';

const PHASE_LABEL: Record<string, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  analyzing: 'Analyzing',
  routing: 'Routing sections',
  routed: 'Sections routed',
  extracting: 'Extracting',
  supervising: 'Checking results',
  done: 'Done',
  failed: 'Failed',
};

const KIND_LABEL: Record<Job['kind'], string> = {
  upload: 'Upload',
  extraction: 'Extraction',
  correction: 'Correction',
};

/**
 * Shows this project's background work, inside this project (CLAUDE.md 8.1):
 * loading appears where the work is, never as a full-screen spinner or an
 * app-wide disabled state.
 */
export function JobBanner({ projectId }: { projectId: string | null }) {
  const activity = useProjectActivity(projectId);

  const running = activity.running;
  const queued = activity.queued;
  const failed = activity.failed[0];
  const interrupted = activity.interrupted[0];
  const unseen = activity.unseenCompleted[0];

  if (!running && !queued && !failed && !interrupted && !unseen) return null;

  return (
    <Box sx={{ px: 3, pt: 2 }}>
      {running && (
        <Alert
          severity="info"
          icon={false}
          action={
            <Button size="small" color="inherit" onClick={() => jobRuntime.cancel(running.id)}>
              Stop
            </Button>
          }
          sx={{ mb: 1 }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>
              {KIND_LABEL[running.kind]}: {PHASE_LABEL[running.phase] ?? running.phase}
            </Typography>
            {running.progress.categoriesDone.map((c) => (
              <Chip key={c} size="small" label={c} sx={{ height: 20 }} />
            ))}
          </Stack>
          <LinearProgress sx={{ borderRadius: 1 }} />
          {running.warnings.map((w, i) => (
            // Warnings are non-terminal and must not look like errors (RFC 3).
            <Typography key={i} variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {w.status === 'routing_truncated'
                ? `Cap reached: ${w.kept} of ${w.total_tagged} assignments kept.`
                : (w.message ?? w.status)}
            </Typography>
          ))}
        </Alert>
      )}

      {queued && (
        <Alert
          severity="info"
          icon={false}
          action={
            <Button size="small" color="inherit" onClick={() => jobRuntime.cancel(queued.job.id)}>
              Cancel
            </Button>
          }
          sx={{ mb: 1 }}
        >
          {KIND_LABEL[queued.job.kind]} queued, position {queued.position}.
        </Alert>
      )}

      {interrupted && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" color="inherit" onClick={() => void jobRuntime.runAgain(interrupted.id)}>
                Run again
              </Button>
              <Button size="small" color="inherit" onClick={() => void jobRuntime.dismiss(interrupted.id)}>
                Dismiss
              </Button>
            </Stack>
          }
        >
          {/* Results are saved only when a run reaches `complete` (D9), so an
              interrupted run really did save nothing. Re-running costs tokens
              and creates a new extraction run, so it stays the user's choice. */}
          The tab running this {KIND_LABEL[interrupted.kind].toLowerCase()} was closed or
          refreshed, so it saved nothing.
        </Alert>
      )}

      {failed && (
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          onClose={() => jobStore.dispatch({ type: 'dismiss', jobId: failed.id })}
        >
          {KIND_LABEL[failed.kind]} failed: {failed.error}
        </Alert>
      )}

      {unseen && !running && (
        <Alert
          severity="success"
          sx={{ mb: 1 }}
          onClose={() =>
            projectId && jobStore.dispatch({ type: 'markSeen', projectId })
          }
        >
          New results are in.
        </Alert>
      )}
    </Box>
  );
}
