'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Stack, Typography } from '@mui/material';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResource } from '@/hooks/useResource';
import {
  apiGetPromptPins, apiGetPromptResolution, apiListSlotVersions, apiListSlots, type PromptVersion,
} from '@/api/prompts';
import { categoryRows, joinSlots } from '@/lib/prompts/view';
import { PromptText, SlotTable, type SlotTableRow } from './SlotTable';

function Prompts({ rows, label }: { rows: SlotTableRow[]; label: string }) {
  const shown = categoryRows(rows);
  if (shown.length === 0) return null;
  return <SlotTable rows={shown} label={label} />;
}

function Loading() {
  return <div aria-busy="true"><SkeletonRows count={6} columns={6} /></div>;
}

/** What this project pinned at its first run (`GET /projects/{id}/prompt-pins`). */
export function PinnedPrompts({ projectId }: { projectId: string }) {
  const router = useRouter();
  const load = useCallback((signal: AbortSignal) => apiGetPromptPins(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the pinned prompts.');
  const rows = useMemo<SlotTableRow[]>(
    () =>
      (data ?? []).map((p) => ({
        key: p.slot_key,
        slotKey: p.slot_key,
        level: p.slot_level,
        version: p.version_number,
        scope: p.resolved_from_scope,
        lazy: p.is_lazy,
        note: `Pinned ${new Date(p.pinned_at).toLocaleString()}`,
        detail: <PromptText text={p.content} />,
      })),
    [data],
  );
  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <Loading />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing pinned yet"
        description="A project freezes the prompts it uses at its first extraction run. Until then you can change its category prompts under Prompts for this project."
        action={{ label: 'Open Workspace', onClick: () => router.push(`/projects/${projectId}/workspace`) }}
      />
    );
  }
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        The category prompt versions this project froze. Later changes to the shared library do not reach it. Expand a row to read the prompt.
      </Typography>
      <Prompts rows={rows} label="Pinned prompts" />
    </Stack>
  );
}

/** What the next run would use (`GET /projects/{id}/prompt-resolution`). */
export function ResolutionPreview({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => apiGetPromptResolution(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load what the next run will use.');
  const rows = useMemo<SlotTableRow[]>(
    () =>
      joinSlots([], data).map((r) => ({
        key: r.slotKey,
        slotKey: r.slotKey,
        level: r.level,
        description: r.resolved?.slot_description,
        version: r.resolved?.version_number ?? null,
        scope: r.resolved?.resolved_from_scope ?? null,
        lazy: r.resolved?.is_lazy,
        note: r.resolved?.is_project_scopable ? 'Can be overridden for a project' : undefined,
      })),
    [data],
  );
  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <Loading />;
  return (
    <Stack spacing={1.5}>
      <Alert severity="info" variant="outlined">
        {data?.pins_frozen
          ? 'This project’s prompts are frozen by its first extraction, so every prompt below repeats its pin. The scope says where each pinned version came from.'
          : 'This project has not been extracted yet. Below is what its first run would pin; the scope says where each version comes from (project, then customer, then global). You can still change them under "Prompts for this project".'}
      </Alert>
      <Prompts rows={rows} label="Resolution preview" />
    </Stack>
  );
}

function Versions({ slotKey }: { slotKey: string }) {
  const load = useCallback((signal: AbortSignal) => apiListSlotVersions(slotKey, signal), [slotKey]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the versions.');
  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <Loading />;
  const versions: PromptVersion[] = [...(data ?? [])].sort((a, b) => b.version_number - a.version_number);
  return (
    <Stack spacing={1.5}>
      {versions.map((v) => (
        <Stack key={v.id} spacing={0.5}>
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
            v{v.version_number}
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
              {new Date(v.created_at).toLocaleString()}{v.is_archived ? ' · archived' : ''}{v.change_note ? ` · ${v.change_note}` : ''}
            </Typography>
          </Typography>
          <PromptText text={v.content} />
        </Stack>
      ))}
    </Stack>
  );
}

/** Every category prompt with its current version (`GET /prompts/slots`); versions load on expand. */
export function Registry() {
  const load = useCallback((signal: AbortSignal) => apiListSlots(signal), []);
  const { data, error, loading, reload } = useResource(load, 'Could not load the prompt library.');
  const rows = useMemo<SlotTableRow[]>(
    () =>
      (data ?? []).map((s) => ({
        key: s.slot_key,
        slotKey: s.slot_key,
        level: s.slot_level,
        description: s.description,
        version: s.current_version?.version_number ?? null,
        scope: s.current_model?.scope ?? 'GLOBAL',
        note: s.is_project_scopable ? 'Can be overridden per project' : undefined,
        detail: <Versions slotKey={s.slot_key} />,
      })),
    [data],
  );
  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <Loading />;
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        The shared library as it is now, for every project: the current version of each category prompt. A project keeps its pin regardless. Expand a row for the version history.
      </Typography>
      <Prompts rows={rows} label="Registry" />
    </Stack>
  );
}
