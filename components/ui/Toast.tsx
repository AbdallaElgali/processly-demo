'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Alert, Box, Button, Stack } from '@mui/material';

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: string;
  message: string;
  severity: ToastSeverity;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

const DEFAULT_DURATION_MS = 6000;

/**
 * A single bottom-left notification queue, shared by every screen, so a job
 * that completes while the user is elsewhere in the app ("new results",
 * CLAUDE.md 8.1) has one place to surface instead of each screen inventing
 * its own `Snackbar` (as `review/page.tsx` and `TemplatesManager` do today).
 *
 * Plain module state behind `useSyncExternalStore`, the same shape as
 * `useLocalStorageFlag` — no provider needed, so `toast.show(...)` can be
 * called from a runner or a store, not just a component.
 */
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => items;
// A stable reference: a fresh `[]` on every call makes useSyncExternalStore
// re-render in a loop (the same bug fixed in ProjectDataStore.get(), step 3).
const EMPTY: ToastItem[] = [];
const getServerSnapshot = (): ToastItem[] => EMPTY;

export const toast = {
  show(
    message: string,
    opts?: { severity?: ToastSeverity; action?: { label: string; onClick: () => void }; durationMs?: number },
  ) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    items = [...items, {
      id,
      message,
      severity: opts?.severity ?? 'info',
      action: opts?.action,
      durationMs: opts?.durationMs ?? DEFAULT_DURATION_MS,
    }];
    notify();
    return id;
  },
  dismiss(id: string) {
    items = items.filter((t) => t.id !== id);
    notify();
  },
};

function ToastRow({ item }: { item: ToastItem }) {
  const remaining = useRef(item.durationMs);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = () => {
    startedAt.current = Date.now();
    timer.current = setTimeout(() => toast.dismiss(item.id), remaining.current);
  };
  const pause = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
    timer.current = null;
  };

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Alert
      severity={item.severity}
      onMouseEnter={pause}
      onMouseLeave={arm}
      onClose={() => toast.dismiss(item.id)}
      action={
        item.action ? (
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              item.action!.onClick();
              toast.dismiss(item.id);
            }}
          >
            {item.action.label}
          </Button>
        ) : undefined
      }
      sx={{ minWidth: 280, maxWidth: 420 }}
    >
      {item.message}
    </Alert>
  );
}

/** Mount once, near the root. Renders nothing when the queue is empty. */
export function ToastHost() {
  const queue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (queue.length === 0) return null;

  return (
    <Box
      aria-live="polite"
      sx={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: (t) => t.zIndex.snackbar,
        display: 'flex',
        flexDirection: 'column-reverse',
      }}
    >
      <Stack spacing={1}>
        {queue.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </Stack>
    </Box>
  );
}
