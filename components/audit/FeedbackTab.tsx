'use client';

import { useCallback, useMemo } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { useResource } from '@/hooks/useResource';
import { useProjectData } from '@/lib/jobs/hooks';
import { fetch_all_feedback, type FeedbackItem } from '@/api/audit/feedback';
import { feedbackTotals } from '@/lib/audit/feedback';

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  resolved: { bg: 'status.successBg', fg: 'status.success' },
  pending: { bg: 'status.warningBg', fg: 'status.warning' },
  new: { bg: 'status.infoBg', fg: 'status.info' },
  rejected: { bg: 'status.dangerBg', fg: 'status.danger' },
};

function FeedbackCard({ item, documentName }: { item: FeedbackItem; documentName: string | null }) {
  const status = (item.status || 'unknown').toLowerCase();
  const colour = STATUS_COLOR[status] ?? { bg: 'status.neutralBg', fg: 'status.neutral' };
  return (
    <Paper variant="outlined" component="article" sx={{ p: 2, bgcolor: 'surface.panel', borderColor: 'border.subtle' }}>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1" component="h3" sx={{ flex: 1, fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title || 'Untitled feedback'}</Typography>
        <Chip size="small" label={status} sx={{ bgcolor: colour.bg, color: colour.fg, textTransform: 'capitalize' }} />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mb: 1 }}>{item.description}</Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', color: 'text.muted' }}>
        <Typography variant="caption">Type: {item.feedback_type}</Typography>
        <Typography variant="caption">User {item.user_id.slice(0, 8)}</Typography>
        {item.document_id && <Typography variant="caption">Document: {documentName ?? item.document_id.slice(0, 8)}</Typography>}
      </Stack>
    </Paper>
  );
}

/** Feedback people left on this project, every page of it, so the total is the real count. */
export function FeedbackTab({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => fetch_all_feedback({ project_id: projectId }, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the feedback.');
  const documents = useProjectData(projectId)?.details?.documents;
  const totals = useMemo(() => feedbackTotals(data?.feedbacks ?? []), [data]);
  const nameOf = (id: string | null | undefined) => documents?.find((d) => d.id === id)?.name ?? null;

  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <div aria-busy="true"><SkeletonRows count={4} columns={1} /></div>;
  if (totals.total === 0) {
    return <EmptyState title="No feedback for this project" description="Feedback sent from the Workspace appears here." />;
  }
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h2">{totals.total} {totals.total === 1 ? 'entry' : 'entries'}</Typography>
        {totals.byStatus.map((s) => <Chip key={s.status} size="small" variant="outlined" label={`${s.status}: ${s.count}`} />)}
        {totals.byType.map((t) => <Chip key={t.type} size="small" label={`${t.type}: ${t.count}`} sx={{ bgcolor: 'surface.sunken' }} />)}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.muted' }}>
        Newest first. The backend does not return a date for feedback (backend B23), so none is shown.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 1.5, alignItems: 'start' }}>
        {(data?.feedbacks ?? []).map((f, i) => <FeedbackCard key={f.id ?? i} item={f} documentName={nameOf(f.document_id)} />)}
      </Box>
    </Stack>
  );
}
