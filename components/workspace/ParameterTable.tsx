'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, FormControlLabel, Skeleton, Stack, Switch, Tooltip, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { InputField, SpecificationSource } from '@/types';
import type { CanonicalParameter } from '@/api/templates';
import type { Job } from '@/lib/jobs/types';
import { groupFields, normalizeCategoryKey, type ResolvedCategory } from '@/lib/categories';
import { reviewOrder, rowState, type RowState } from '@/lib/review/rowState';
import { DensityToggle, type Density } from '@/components/ui/DensityToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { ParameterRow, type ParameterRowHandlers } from './ParameterRow';

type Handlers = Omit<ParameterRowHandlers, 'onToggle' | 'onFocusRow'>;

interface Group {
  category: ResolvedCategory | null;
  found: number;
  rows: { field: InputField; state: RowState }[];
}

type LiveState = 'working' | 'done' | 'failed' | null;

/** Category progress during a run (AM11: moved here from the old CategoryCards). */
function liveState(category: ResolvedCategory, job: Job | undefined): LiveState {
  if (!job) return null;
  const key = normalizeCategoryKey(category.key);
  if (job.progress.categoriesFailed.some((c) => normalizeCategoryKey(c) === key)) return 'failed';
  if (job.progress.categoriesDone.some((c) => normalizeCategoryKey(c) === key)) return 'done';
  return job.phase === 'extracting' || job.phase === 'supervising' || job.phase === 'routing' || job.phase === 'routed'
    ? 'working'
    : null;
}

/**
 * The Workspace's parameter table (plan-A 6.4, AM1, AM6, AM9, AM10, AM11).
 *
 * Grouped by category from data, with every known category present (an empty
 * End of life block is visible, not hidden). Keyboard: Up/Down move between
 * rows, Home/End jump, Enter or Space opens the detail, Esc closes it, S shows
 * the selected value in the document.
 */
export function ParameterTable({
  projectId,
  fields,
  canonical,
  loading,
  job,
  correctingFieldId,
  correctionPhase,
  density,
  onDensityChange,
  reviewFirst,
  onReviewFirstChange,
  handlers,
}: {
  projectId: string;
  fields: InputField[];
  canonical: CanonicalParameter[] | null;
  loading: boolean;
  job: Job | undefined;
  correctingFieldId: string | null;
  correctionPhase?: string;
  density: Density;
  onDensityChange: (d: Density) => void;
  reviewFirst: boolean;
  onReviewFirstChange: (v: boolean) => void;
  handlers: Handlers;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const groups: Group[] = useMemo(() => {
    const withState = (list: InputField[]) => {
      const rows = list.map((field) => ({ field, state: rowState(field) }));
      if (reviewFirst) {
        // Stable: ties keep the backend's own order (category, then name).
        rows.sort((a, b) => reviewOrder(a.state.primary) - reviewOrder(b.state.primary));
      }
      return rows;
    };
    if (!canonical) return [{ category: null, found: 0, rows: withState(fields) }];
    return groupFields(fields, canonical).map((g) => ({ category: g.category, found: g.found, rows: withState(g.fields) }));
  }, [fields, canonical, reviewFirst]);

  const order = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.field.id)), [groups]);
  const activeKey = focusedKey && order.includes(focusedKey) ? focusedKey : order[0] ?? null;

  const counts = useMemo(() => {
    const all = groups.flatMap((g) => g.rows);
    return {
      total: all.length,
      flagged: all.filter((r) => r.state.primary === 'human_flag' || r.state.primary === 'bounds').length,
      review: all.filter((r) => r.state.primary === 'needs_review').length,
      empty: all.filter((r) => r.state.primary === 'empty' || r.state.primary === 'no_run').length,
    };
  }, [groups]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rowHandlers: ParameterRowHandlers = useMemo(
    () => ({ ...handlers, onToggle: toggle, onFocusRow: setFocusedKey }),
    [handlers, toggle],
  );

  const focusRow = (key: string) => {
    setFocusedKey(key);
    containerRef.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!activeKey || order.length === 0) return;
    const i = order.indexOf(activeKey);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(order[Math.min(i + 1, order.length - 1)]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(order[Math.max(i - 1, 0)]);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(order[0]);
        break;
      case 'End':
        e.preventDefault();
        focusRow(order[order.length - 1]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggle(activeKey);
        break;
      case 'Escape':
        if (expanded.has(activeKey)) {
          e.preventDefault();
          toggle(activeKey);
        }
        break;
      case 's':
      case 'S': {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const row = groups.flatMap((g) => g.rows).find((r) => r.field.id === activeKey);
        const source = row?.state.selected?.source;
        if (source) {
          e.preventDefault();
          handlers.onJumpToSource(source as SpecificationSource);
        }
        break;
      }
    }
  };

  const toolbar = (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel' }}
    >
      <Typography
        variant="body2"
        noWrap
        title={`${counts.total} parameters · ${counts.review} to review · ${counts.flagged} flagged · ${counts.empty} without value`}
        sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 1, minWidth: 0 }}
      >
        <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{counts.total}</Box> parameters
        {' · '}{counts.review} to review{' · '}{counts.flagged} flagged{' · '}{counts.empty} without value
      </Typography>
      <FormControlLabel
        control={<Switch size="small" checked={reviewFirst} onChange={(e) => onReviewFirstChange(e.target.checked)} />}
        label={<Typography variant="body2" noWrap>Needs review first</Typography>}
        sx={{ mr: 0, flexShrink: 0 }}
      />
      <DensityToggle value={density} onChange={onDensityChange} />
    </Stack>
  );

  if (loading && fields.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {toolbar}
        <Stack spacing={0.5} sx={{ p: 2 }} aria-busy="true" aria-label="Loading parameters">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={density === 'compact' ? 32 : 44} />
          ))}
        </Stack>
      </Box>
    );
  }

  if (fields.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {toolbar}
        <EmptyState
          title="This project has no parameters"
          description="Parameters come from the project's template. Add or edit them on the Parameters screen."
          action={{ label: 'Open Parameters', onClick: () => router.push(`/projects/${projectId}/parameters`) }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {toolbar}
      <Box
        ref={containerRef}
        role="group"
        aria-label="Parameters by category. Arrow keys move, Enter opens, S shows the source."
        onKeyDown={onKeyDown}
        sx={{ flex: 1, overflowY: 'auto', containerType: 'inline-size', bgcolor: 'surface.panel' }}
      >
        {groups.map((group) => {
          const key = group.category?.key ?? 'loading';
          const live = group.category ? liveState(group.category, job) : null;
          return (
            <Box key={key} role="group" aria-label={group.category?.label ?? 'Loading'}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  px: 2,
                  py: 0.75,
                  bgcolor: 'surface.sunken',
                  borderBottom: 1,
                  borderColor: 'border.subtle',
                }}
              >
                {group.category ? (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {group.category.label}
                    </Typography>
                    <Tooltip title="Parameters with a value / parameters in this category">
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                        {group.found}/{group.rows.length}
                      </Typography>
                    </Tooltip>
                    <LiveChip state={live} />
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading categories…</Typography>
                )}
              </Stack>

              {group.rows.length === 0 ? (
                <Typography variant="body2" sx={{ px: 6, py: 1.25, color: 'text.muted', borderBottom: 1, borderColor: 'border.subtle' }}>
                  No parameters in this category ·{' '}
                  <Box component={Link} href={`/projects/${projectId}/parameters`} sx={{ color: 'accent.text' }}>
                    Add in Parameters
                  </Box>
                </Typography>
              ) : (
                group.rows.map(({ field, state }) => (
                  <ParameterRow
                    key={field.id}
                    field={field}
                    state={state}
                    expanded={expanded.has(field.id)}
                    focused={field.id === activeKey}
                    correcting={field.id === correctingFieldId}
                    correctionPhase={field.id === correctingFieldId ? correctionPhase : undefined}
                    density={density}
                    handlers={rowHandlers}
                  />
                ))
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function LiveChip({ state }: { state: LiveState }) {
  if (!state) return null;
  if (state === 'failed') {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'status.danger' }}>
        <ErrorOutlineIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>Workers failed</Typography>
      </Stack>
    );
  }
  if (state === 'done') {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'status.success' }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>Updated this run</Typography>
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'status.info' }}>
      <Box
        sx={{
          width: 8, height: 8, borderRadius: '50%', bgcolor: 'status.info',
          animation: 'bdaCategoryPulse 1.6s ease-in-out infinite',
          '@keyframes bdaCategoryPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>Extracting…</Typography>
    </Stack>
  );
}
