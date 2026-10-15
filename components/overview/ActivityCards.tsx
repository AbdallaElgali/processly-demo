'use client';

import Link from 'next/link';
import { Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { JobBanner } from '@/components/jobs/JobBanner';
import { useProjectActivity } from '@/lib/jobs/hooks';
import { RUN_TYPE_LABEL } from '@/lib/overview/status';
import type { ExtractionRun, ProjectDocument } from '@/api/types/projects';
import { Card, Fact } from './Card';

const DOCS_SHOWN = 6;

export function DocumentsCard({ projectId, documents }: { projectId: string; documents: ProjectDocument[] }) {
  const analyzed = documents.filter((d) => d.analyzed).length;
  const waiting = documents.length - analyzed;
  return (
    <Card
      title="Documents"
      icon={DescriptionOutlinedIcon}
      id="documents"
      action={
        <Button component={Link} href={`/projects/${projectId}/workspace`} size="small">
          {documents.length === 0 ? 'Upload documents' : 'Open'}
        </Button>
      }
    >
      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Fact label="Uploaded"><Num>{documents.length}</Num></Fact>
        <Fact label="Analyzed"><Num>{analyzed}</Num></Fact>
        {waiting > 0 && <Fact label="Not analyzed yet"><Num>{waiting}</Num></Fact>}
      </Stack>
      {documents.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No documents yet. Upload datasheets in the Workspace to start an extraction.
        </Typography>
      ) : (
        <Box component="ul" aria-label="Documents" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {documents.slice(0, DOCS_SHOWN).map((d) => (
            <Stack component="li" key={d.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5, borderTop: 1, borderColor: 'border.subtle' }}>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, color: 'text.primary' }} title={d.name}>{d.name}</Typography>
              <Chip size="small" variant="outlined" label={d.analyzed ? 'Analyzed' : 'Not analyzed'} sx={{ height: 20 }} />
            </Stack>
          ))}
          {documents.length > DOCS_SHOWN && (
            <Typography component="li" variant="caption" sx={{ color: 'text.muted', pt: 0.5, display: 'block' }}>
              and {documents.length - DOCS_SHOWN} more, in the Workspace tabs
            </Typography>
          )}
        </Box>
      )}
    </Card>
  );
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <Typography component="span" variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>{children}</Typography>
);

export function LastRunCard({
  projectId,
  runs,
  error,
  onRetry,
}: {
  projectId: string;
  runs: ExtractionRun[] | null;
  error: string | null;
  onRetry: () => void;
}) {
  const last = runs?.[0];
  return (
    <Card
      title="Last extraction run"
      icon={HistoryOutlinedIcon}
      id="last-run"
      action={
        <Button component={Link} href={`/projects/${projectId}/audit`} size="small">
          All runs
        </Button>
      }
    >
      {error && !runs ? (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2" role="alert" sx={{ color: 'status.danger' }}>Could not load the runs: {error}</Typography>
          <Button type="button" size="small" variant="outlined" onClick={onRetry}>Retry</Button>
        </Stack>
      ) : runs === null ? (
        <Stack spacing={1} aria-busy="true" aria-label="Loading the last run">
          <Skeleton variant="rounded" height={20} width="60%" />
          <Skeleton variant="rounded" height={20} width="40%" />
          <Skeleton variant="rounded" height={20} width="50%" />
        </Stack>
      ) : !last ? (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>No extraction has run for this project yet.</Typography>
          <Button component={Link} href={`/projects/${projectId}/workspace`} size="small" variant="outlined">Open Workspace to analyze</Button>
        </Stack>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.5 }}>
          <Fact label="Run">#{last.run_number} · {RUN_TYPE_LABEL[last.extraction_type] ?? last.extraction_type}</Fact>
          <Fact label="Date">{last.created_at ? new Date(last.created_at).toLocaleString() : 'unknown'}</Fact>
          <Fact label="Parameters">{last.parameters_count}</Fact>
          <Fact label="Runs in total">{runs.length}</Fact>
        </Box>
      )}
    </Card>
  );
}

/** This project's job state. The banner is the same one the Workspace shows, so the actions (Stop, Run again) are identical. */
export function JobStateCard({ projectId }: { projectId: string }) {
  const activity = useProjectActivity(projectId);
  const idle = !activity.running && !activity.queued && !activity.failed.length && !activity.interrupted.length && !activity.unseenCompleted.length;
  return (
    <Card
      title="Background work"
      icon={SyncOutlinedIcon}
      id="job-state"
      action={
        <Button component={Link} href={`/projects/${projectId}/workspace`} size="small">Workspace</Button>
      }
    >
      {idle ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nothing is running or queued for this project.</Typography>
      ) : (
        <JobBanner projectId={projectId} padded={false} />
      )}
    </Card>
  );
}
