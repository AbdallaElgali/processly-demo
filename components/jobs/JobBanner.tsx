'use client';

import { useState } from 'react';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { jobRuntime } from '@/lib/jobs/runtime';
import { jobStore } from '@/lib/jobs/store';
import type { Job } from '@/lib/jobs/types';
import { RunTimeline } from '@/components/workspace/RunTimeline';

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
 * One action button that disables itself for the moment its own async call
 * is in flight (CLAUDE.md 8.4's "loading" state), so a second click cannot
 * fire a second cancel/run-again/dismiss while the first is still resolving.
 */
function BusyButton({ onClick, children }: { onClick: () => Promise<void> | void; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="small"
      color="inherit"
      disabled={busy}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </Button>
  );
}

/**
 * Shows this project's background work, inside this project (CLAUDE.md 8.1):
 * loading appears where the work is, never as a full-screen spinner or an
 * app-wide disabled state.
 *
 * A running extraction or correction gets the full `RunTimeline` (RFC §3); an
 * upload has no pipeline to show, so it keeps a plain phase line and progress
 * bar.
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
          action={<BusyButton onClick={() => jobRuntime.cancel(running.id)}>Stop</BusyButton>}
          sx={{ mb: 1 }}
        >
          {running.kind === 'upload' ? (
            <>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                {KIND_LABEL[running.kind]}: {PHASE_LABEL[running.phase] ?? running.phase}
              </Typography>
              <LinearProgress sx={{ borderRadius: 1 }} />
            </>
          ) : (
            <RunTimeline job={running} />
          )}
        </Alert>
      )}

      {queued && (
        <Alert
          severity="info"
          icon={false}
          action={<BusyButton onClick={() => jobRuntime.cancel(queued.job.id)}>Cancel</BusyButton>}
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
              <BusyButton onClick={() => jobRuntime.runAgain(interrupted.id)}>Run again</BusyButton>
              <BusyButton onClick={() => jobRuntime.dismiss(interrupted.id)}>Dismiss</BusyButton>
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
