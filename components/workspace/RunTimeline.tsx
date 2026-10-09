'use client';

import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import type { Job } from '@/lib/jobs/types';
import type { SseEvent } from '@/lib/jobs/sse-types';

type StepKey = 'uploading' | 'analyzing' | 'routing' | 'extracting' | 'supervising' | 'done';
type StepState = 'done' | 'active' | 'pending';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'analyzing', label: 'Analyzing' },
  { key: 'routing', label: 'Routing' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'supervising', label: 'Supervising' },
  { key: 'done', label: 'Done' },
];

/**
 * Every visible step derived from the job's own `phase`/`events`, with no new
 * phase values (`lib/jobs/sse-types.ts` already decides the phase and is
 * unit-tested; this only decides how to *draw* it). "Uploading" is already
 * true by the time an extraction/correction job exists -- its documents are a
 * precondition, not something this job's own stream reports. "Analyzing" is
 * the real, if brief, window between the stream opening and its first byte:
 * `phase === 'routing'` with no events yet.
 */
function stepState(key: StepKey, job: Job): StepState {
  const phase = job.phase;
  const hasEvents = job.events.length > 0;

  switch (key) {
    case 'uploading':
      return 'done';
    case 'analyzing':
      if (phase === 'routing') return hasEvents ? 'done' : 'active';
      return phase === 'routed' || phase === 'extracting' || phase === 'supervising' || phase === 'done'
        ? 'done'
        : 'pending';
    case 'routing':
      if (phase === 'routing') return hasEvents ? 'active' : 'pending';
      if (phase === 'routed') return 'active';
      return phase === 'extracting' || phase === 'supervising' || phase === 'done' ? 'done' : 'pending';
    case 'extracting':
      if (phase === 'extracting') return 'active';
      return phase === 'supervising' || phase === 'done' ? 'done' : 'pending';
    case 'supervising':
      if (phase === 'supervising') return 'active';
      return phase === 'done' ? 'done' : 'pending';
    case 'done':
      return phase === 'done' ? 'done' : 'pending';
  }
}

/** Human text for each non-terminal warning (CLAUDE.md 4: never shown as a failure). */
function warningLabel(event: SseEvent): string {
  switch (event.status) {
    case 'routing_truncated':
      return `Cap reached: ${event.kept ?? '?'} of ${event.total_tagged ?? '?'} assignments kept.`;
    case 'no_frames_tagged':
      return 'No document frames were tagged for routing.';
    case 'category_extraction_fallback':
      return `Fell back to a simpler extraction pass (${event.planned_calls ?? '?'} calls, limit ${event.limit ?? '?'}).`;
    case 'category_workers_failed':
      return `Some categories failed and will show as "Failed" below: ${(event.categories ?? []).join(', ')}.`;
    default:
      return event.message ?? event.status;
  }
}

const BADGE_LABEL: Record<string, string> = {
  BLIND: 'Blind extraction',
  ITERATIVE: 'Iterative correction',
};

/** RFC §3's run timeline, reused for extraction and correction jobs alike. */
export function RunTimeline({ job }: { job: Job }) {
  const badge =
    job.payload.kind === 'extraction'
      ? BADGE_LABEL[job.payload.mode]
      : job.payload.kind === 'correction'
        ? `Single parameter: ${job.payload.parameterKey}`
        : null;

  return (
    <Box>
      {badge && (
        <Chip
          size="small"
          label={badge}
          sx={{ mb: 1, bgcolor: 'status.infoBg', color: 'status.info' }}
        />
      )}

      <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
        {STEPS.map((step, i) => {
          const state = stepState(step.key, job);
          const isLast = i === STEPS.length - 1;
          return (
            <Stack key={step.key} direction="row" alignItems="center" sx={{ flex: isLast ? '0 0 auto' : 1 }}>
              <Tooltip title={`${step.label}: ${state === 'done' ? 'done' : state === 'active' ? 'in progress' : 'not started yet'}`}>
                <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 72 }} tabIndex={0}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: state === 'done' ? 'status.success' : state === 'active' ? 'status.info' : 'border.strong',
                      transition: (t) => t.transitions.create(['background-color'], { duration: 160 }),
                      ...(state === 'active' && {
                        animation: 'bdaRunTimelinePulse 1.6s ease-in-out infinite',
                        '@keyframes bdaRunTimelinePulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.4 },
                        },
                        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                      }),
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: state === 'pending' ? 'text.muted' : 'text.primary',
                      fontWeight: state === 'active' ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </Typography>
                </Stack>
              </Tooltip>
              {!isLast && (
                <Box
                  sx={{
                    flex: 1,
                    height: 2,
                    mx: 0.5,
                    mb: 2,
                    bgcolor: state === 'done' ? 'status.success' : 'border.subtle',
                    transition: (t) => t.transitions.create(['background-color'], { duration: 160 }),
                  }}
                />
              )}
            </Stack>
          );
        })}
      </Stack>

      {job.warnings.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {job.warnings.map((w, i) => (
            <Typography key={i} variant="caption" sx={{ color: 'status.warning', display: 'block' }}>
              {warningLabel(w)}
            </Typography>
          ))}
        </Stack>
      )}
    </Box>
  );
}
