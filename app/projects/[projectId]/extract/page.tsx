'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Button, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { Dropzone } from '@/components/ui/Dropzone';
import { DocumentsTable } from '@/components/extract/DocumentsTable';
import { CategoryCards } from '@/components/extract/CategoryCards';
import { RunsTab } from '@/components/extract/RunsTab';
import { JobBanner } from '@/components/jobs/JobBanner';
import { useCanStart, useJobTray, useJobs, useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import { JOB_CAP } from '@/lib/jobs/config';
import { createJob, jobRuntime } from '@/lib/jobs/runtime';
import { mapFieldsToSpecs } from '@/lib/parameter-adapter';

export default function ExtractPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tab, setTab] = useState<'extract' | 'runs'>('extract');

  const projectState = useProjectData(projectId);
  const details = projectState?.details ?? null;
  const fields = projectState?.fields ?? [];
  const detailsLoading = projectState?.loading.details ?? false;

  const activity = useProjectActivity(projectId);
  const analyzeGate = useCanStart(projectId, 'extraction');
  const tray = useJobTray();
  const jobs = useJobs();

  const uploadJobs = useMemo(
    () => jobs.filter((j) => j.projectId === projectId && j.kind === 'upload'),
    [jobs, projectId],
  );

  const runningOrQueuedExtraction =
    activity.running?.kind === 'extraction' || activity.queued?.job.kind === 'extraction';

  const handleUpload = (files: File[]) => {
    void jobRuntime.enqueue(createJob(projectId, { kind: 'upload', fileRefs: [] }), files);
  };

  const handleAnalyze = () => {
    const hasFlagged = fields.some((f) => f.isFlagged);
    void jobRuntime.enqueue(
      createJob(projectId, {
        kind: 'extraction',
        mode: hasFlagged ? 'ITERATIVE' : 'BLIND',
        previousSpecs: hasFlagged ? mapFieldsToSpecs(fields) : null,
      }),
    );
  };

  const flaggedCount = fields.filter((f) => f.isFlagged).length;
  const hasDocuments = (details?.documents?.length ?? 0) > 0;
  const categoryJob =
    activity.running?.kind === 'extraction' || activity.running?.kind === 'correction'
      ? activity.running
      : undefined;

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Typography variant="h4" sx={{ color: 'text.primary', mb: 2 }}>
        Extract
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'border.subtle' }}
      >
        <Tab label="Extract" value="extract" />
        <Tab label="Runs" value="runs" />
      </Tabs>

      {tab === 'extract' ? (
        <Stack spacing={3}>
          <Dropzone onFiles={handleUpload} queuedHint={tray.running >= JOB_CAP} />

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title={analyzeGate.allowed ? '' : ('reason' in analyzeGate ? analyzeGate.reason : '')}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  onClick={handleAnalyze}
                  loading={runningOrQueuedExtraction}
                  disabled={!hasDocuments || !analyzeGate.allowed}
                >
                  Analyze
                </Button>
              </span>
            </Tooltip>
            {flaggedCount > 0 && (
              <Typography variant="caption" sx={{ color: 'status.info' }}>
                {flaggedCount} flagged parameter{flaggedCount === 1 ? '' : 's'} will be sent back as an
                iterative correction.
              </Typography>
            )}
          </Stack>

          <JobBanner projectId={projectId} />

          {categoryJob && <CategoryCards projectId={projectId} job={categoryJob} />}

          <Box>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
              Documents
            </Typography>
            <DocumentsTable
              projectId={projectId}
              documents={details?.documents ?? []}
              uploadJobs={uploadJobs}
              loading={detailsLoading && !details}
            />
          </Box>
        </Stack>
      ) : (
        <RunsTab projectId={projectId} />
      )}
    </Box>
  );
}
