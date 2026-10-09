'use client';

import { ReactNode, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { Box } from '@mui/material';
import { layout } from '@/theme/layout';

const KEY_STEP_PX = 16;

/** Ratio persisted per `storageKey`, read without a setState-in-effect (same pattern as useLocalStorageFlag). */
function useStoredRatio(storageKey: string, fallback: number): [number, (r: number) => void] {
  const listeners = useRef(new Set<() => void>());
  const subscribe = useCallback((l: () => void) => {
    listeners.current.add(l);
    return () => listeners.current.delete(l);
  }, []);
  const read = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const n = raw === null ? NaN : Number(raw);
      return Number.isFinite(n) && n > 0 && n < 1 ? n : fallback;
    } catch {
      return fallback;
    }
  }, [storageKey, fallback]);
  const ratio = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback(
    (r: number) => {
      try {
        window.localStorage.setItem(storageKey, String(r));
      } catch {
        /* not persisted; still applied below via the listener */
      }
      listeners.current.forEach((l) => l());
    },
    [storageKey],
  );
  return [ratio, set];
}

/**
 * Resizable two-pane layout (plan-A 2). The width is stored as a RATIO of the
 * container, so the rail's width is not baked into the maths the way the old
 * `useResizer` hook did. Pointer events (mouse, pen, touch) drag the
 * separator; the keyboard moves it by 16px with arrow keys and jumps to either
 * limit with Home/End (`role="separator"`, CLAUDE.md 8.4).
 */
export function SplitPane({
  left,
  right,
  storageKey,
  defaultRatio = layout.splitDefaultRatio,
  minPane = layout.splitMinPane,
  label = 'Resize panes',
}: {
  left: ReactNode;
  right: ReactNode;
  storageKey: string;
  defaultRatio?: number;
  minPane?: number;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useStoredRatio(storageKey, defaultRatio);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback(
    (r: number) => {
      const width = containerRef.current?.clientWidth ?? 0;
      if (width <= minPane * 2) return 0.5;
      const min = minPane / width;
      return Math.min(1 - min, Math.max(min, r));
    },
    [minPane],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setRatio(clamp((e.clientX - rect.left) / rect.width));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const width = containerRef.current?.clientWidth ?? 0;
    if (!width) return;
    const step = KEY_STEP_PX / width;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = ratio - step;
    else if (e.key === 'ArrowRight') next = ratio + step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    if (next === null) return;
    e.preventDefault();
    setRatio(clamp(next));
  };

  const percent = Math.round(ratio * 100);

  return (
    <Box ref={containerRef} sx={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, userSelect: dragging ? 'none' : undefined }}>
      <Box sx={{ flex: `0 0 ${ratio * 100}%`, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{left}</Box>
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setRatio(clamp(defaultRatio))}
        sx={{
          flex: '0 0 6px',
          cursor: 'col-resize',
          touchAction: 'none',
          bgcolor: dragging ? 'accent.fill' : 'border.subtle',
          transition: (t) => t.transitions.create('background-color', { duration: t.transitions.duration.shortest }),
          '&:hover': { bgcolor: 'accent.fill' },
          '&:focus-visible': { bgcolor: 'accent.fill', outline: '2px solid', outlineColor: 'accent.focus', outlineOffset: 0 },
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{right}</Box>
    </Box>
  );
}
