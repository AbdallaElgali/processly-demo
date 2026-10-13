'use client';

import { KEEP_TAB_OPEN_TEXT, KEEP_UPLOAD_OPEN_TEXT } from '@/lib/jobs/closeGuard';
import { SAVED_AWAY_TEXT, interruptedUploadText } from '@/lib/jobs/uploadRecovery';
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
export function JobBanner({ projectId, padded = true }: { projectId: string | null; padded?: boolean }) {
  const activity = useProjectActivity(projectId);

  const running = activity.running;
  const queued = activity.queued;
  const failed = activity.failed[0];
  const interrupted = activity.interrupted[0];
  const unseen = activity.unseenCompleted[0];

  if (!running && !queued && !failed && !interrupted && !unseen) return null;

  return (
    <Box sx={padded ? { px: 3, pt: 2 } : undefined}>
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
              <Typography variant="caption" role="note" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                {KEEP_UPLOAD_OPEN_TEXT}
              </Typography>
            </>
          ) : (
            <>
              <RunTimeline job={running} />
              <Typography variant="caption" role="note" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                {KEEP_TAB_OPEN_TEXT}
              </Typography>
            </>
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
          {/* An extraction or correction saves only when its stream reaches
              `complete` (D9), so an interrupted one really saved nothing.
              Re-running costs tokens and creates a new run, so it stays the
              user's choice. An upload is different (backend U1): a fully sent
              file keeps going on the server, so its outcome is checked. */}
          {interrupted.kind === 'upload' ? (
            <>
              The tab sending this upload was closed or refreshed. {interruptedUploadText(interrupted.uploadCheck)}
              {interrupted.uploadCheck?.state === 'missing' && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Not in the project: {interrupted.uploadCheck.missing.join(', ')}. Run again sends only these.
                </Typography>
              )}
            </>
          ) : (
            <>
              The tab running this {KIND_LABEL[interrupted.kind].toLowerCase()} was closed or
              refreshed, so it saved nothing.
            </>
          )}
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
          {unseen.savedWhileAway ? `${SAVED_AWAY_TEXT}.` : 'New results are in.'}
        </Alert>
      )}
    </Box>
  );
}
