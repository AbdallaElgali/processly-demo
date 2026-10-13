'use client';

import { useState } from 'react';
import { Box, Button, Paper, Popper, Stack, Typography } from '@mui/material';
import { useLocalStorageFlag } from '@/hooks/useLocalStorageFlag';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface TourStep {
  /** A CSS selector for the element this step points at. */
  target: string;
  title: string;
  body: string;
}

/**
 * Anchored step tooltips over real page elements, found by selector so the
 * tour has no coupling to the component that renders its target (step 6's
 * "guided tour step 1" is the first screen to pass real `steps`).
 *
 * "Don't show again" is a `useLocalStorageFlag` keyed by `storageKey`, so each
 * tour (Projects, Review, ...) remembers its own dismissal.
 */
export function GuidedTour({ steps, storageKey }: { steps: TourStep[]; storageKey: string }) {
  const [dismissed, setDismissed] = useLocalStorageFlag(storageKey, false);
  const [index, setIndex] = useState(0);
  // The target lives outside React's tree (found by selector), so it is read
  // directly in render rather than mirrored into state; useHasMounted holds
  // it back on the server, where there is no DOM to query, avoiding a
  // hydration mismatch instead of setting state from an effect.
  const hasMounted = useHasMounted();

  const step = steps[index];
  const atEnd = index === steps.length - 1;
  const anchorEl = hasMounted && !dismissed && step ? document.querySelector(step.target) : null;

  if (dismissed || !step || !anchorEl) return null;

  const finish = () => setDismissed(true);
  const next = () => (atEnd ? finish() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      sx={{ zIndex: (t) => t.zIndex.tooltip }}
    >
      <Paper
        role="dialog"
        aria-label={step.title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish();
          if (e.key === 'ArrowRight') next();
          if (e.key === 'ArrowLeft') prev();
        }}
        sx={{
          p: 2,
          width: 280,
          bgcolor: 'surface.raised',
          border: 1,
          borderColor: 'accent.fill',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: 'text.primary', mb: 0.5 }}>
          {step.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {step.body}
        </Typography>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Button size="small" color="inherit" onClick={finish}>
            Skip
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {index > 0 && (
              <Button size="small" onClick={prev}>
                Back
              </Button>
            )}
            <Button size="small" variant="contained" onClick={next} autoFocus>
              {atEnd ? 'Done' : 'Next'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Popper>
  );
}
