'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Alert, Button, Chip, Stack } from '@mui/material';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import type { ProjectDocument } from '@/api/types/projects';
import type { Job } from '@/lib/jobs/types';

interface DocRow {
  key: string;
  name: string;
  type: string;
  statusLabel: string;
  statusBg: string;
  statusFg: string;
  documentId?: string;
}

const STATUS = {
  analyzed: { bg: 'status.successBg', fg: 'status.success', label: 'Analyzed' },
  notAnalyzed: { bg: 'status.neutralBg', fg: 'status.neutral', label: 'Not yet analyzed' },
  uploading: { bg: 'status.infoBg', fg: 'status.info', label: 'Uploading…' },
  queued: { bg: 'status.neutralBg', fg: 'status.neutral', label: 'Queued' },
} as const;

/**
 * This project's documents (plan §6.3): the persisted list plus rows for
 * whatever upload job is still queued or running, so a drop shows up
 * immediately instead of waiting for the backend round trip.
 */
export function DocumentsTable({
  projectId,
  documents,
  uploadJobs,
  loading,
}: {
  projectId: string;
  documents: ProjectDocument[];
  uploadJobs: Job[];
  loading: boolean;
}) {
  const rows: DocRow[] = useMemo(() => {
    const inFlight: DocRow[] = uploadJobs
      .filter((job) => job.status === 'queued' || job.status === 'running')
      .flatMap((job): DocRow[] => {
        if (job.payload.kind !== 'upload') return [];
        const s = job.status === 'running' ? STATUS.uploading : STATUS.queued;
        return job.payload.fileRefs.map((f) => ({
          key: `${job.id}-${f.idbId}`,
          name: f.name,
          type: f.type || 'unknown',
          statusLabel: s.label,
          statusBg: s.bg,
          statusFg: s.fg,
        }));
      });
    const existing: DocRow[] = documents.map((d) => {
      const s = d.analyzed ? STATUS.analyzed : STATUS.notAnalyzed;
      return {
        key: d.id,
        name: d.name,
        type: d.type,
        statusLabel: s.label,
        statusBg: s.bg,
        statusFg: s.fg,
        documentId: d.id,
      };
    });
    return [...inFlight, ...existing];
  }, [documents, uploadJobs]);

  const warnings = uploadJobs
    .filter((j) => j.status === 'completed' && (j.uploadWarnings?.length ?? 0) > 0)
    .flatMap((j) => j.uploadWarnings ?? []);

  const columns: DataTableColumn<DocRow>[] = [
    { key: 'name', label: 'Name', sortable: true, value: (r) => r.name },
    { key: 'type', label: 'Type', sortable: true, value: (r) => r.type, width: 120 },
    {
      key: 'status',
      label: 'Status',
      width: 180,
      render: (r) => (
        <Chip size="small" label={r.statusLabel} sx={{ bgcolor: r.statusBg, color: r.statusFg }} />
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) =>
        r.documentId ? (
          <Button component={Link} href={`/projects/${projectId}/review`} size="small">
            View in Review
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack spacing={1.5}>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        loading={loading}
        emptyTitle="No documents yet"
        emptyDescription="Drop files above to get started."
      />
      {warnings.length > 0 && (
        <Alert severity="warning">
          {warnings.length === 1 ? 'One file was not accepted: ' : `${warnings.length} files were not accepted: `}
          {warnings.join('; ')}
        </Alert>
      )}
    </Stack>
  );
}
