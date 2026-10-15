'use client';

import { useCallback, useEffect, useState } from 'react';
import { Chip, Stack } from '@mui/material';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { apiGetExtractionRuns } from '@/api/projects';
import type { ExtractionRun } from '@/api/types/projects';
import { RUN_TYPE_LABEL } from '@/lib/overview/status';


const FILTERS = ['MAIN_MULTI_AGENT', 'ITERATIVE', 'SINGLE_PARAM'] as const;

/** The reference's "Documents History", as every extraction attempt for this project (plan §6.3). */
export function RunsTab({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<ExtractionRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number] | null>(null);

  // Every state update happens inside the promise's own callbacks, never
  // synchronously in the effect body itself (react-hooks/set-state-in-effect):
  // a filter change re-fetches but keeps showing the previous rows until the
  // new ones arrive, rather than flashing back to a loading skeleton.
  const load = useCallback(() => {
    apiGetExtractionRuns(projectId, filter ?? undefined)
      .then((list) => {
        setRuns(list);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load extraction runs.'));
  }, [projectId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: DataTableColumn<ExtractionRun>[] = [
    { key: 'run_number', label: 'Run', sortable: true, value: (r) => r.run_number, width: 72 },
    {
      key: 'extraction_type',
      label: 'Type',
      render: (r) => RUN_TYPE_LABEL[r.extraction_type] ?? r.extraction_type,
    },
    { key: 'parameters_count', label: 'Parameters', sortable: true, value: (r) => r.parameters_count },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      value: (r) => r.created_at ?? '',
      render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '—'),
    },
  ];

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip
          label="All"
          size="small"
          color={filter === null ? 'primary' : 'default'}
          variant={filter === null ? 'filled' : 'outlined'}
          onClick={() => setFilter(null)}
        />
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={RUN_TYPE_LABEL[f]}
            size="small"
            color={filter === f ? 'primary' : 'default'}
            variant={filter === f ? 'filled' : 'outlined'}
            onClick={() => setFilter(f)}
          />
        ))}
      </Stack>
      <DataTable
        columns={columns}
        rows={runs ?? []}
        getRowKey={(r) => r.id}
        loading={runs === null && !error}
        error={error}
        onRetry={load}
        emptyTitle="No runs yet"
        emptyDescription="Upload documents and analyze to create the first run."
        defaultSortKey="run_number"
        defaultSortDirection="desc"
      />
    </Stack>
  );
}
