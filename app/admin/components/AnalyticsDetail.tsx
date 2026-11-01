import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getProjectMetricsDetail } from '@/api/analytics';
import type { Outcome, ViewName } from '@/api/types/analytics';
import { useResource } from '@/hooks/useResource';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { filterByOutcome, outcomeOptions, parameterRows } from '@/lib/analytics/detail';
import { formatRate, HELP, VIEW_HELP, VIEW_LABEL, VIEW_ORDER } from '@/lib/analytics/views';
import { leftOut } from '@/lib/analytics/table';
import { InfoTip } from './InfoTip';

interface Props {
  projectId: string;
  view: ViewName;
  onView: (v: ViewName) => void;
  onBack: () => void;
}

const panel = { bgcolor: 'surface.panel', border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 2 } as const;

const AnalyticsDetail: React.FC<Props> = ({ projectId, view, onView, onBack }) => {
  const load = useCallback((signal: AbortSignal) => getProjectMetricsDetail(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'The metrics could not be loaded.');
  const [outcome, setOutcome] = useState<Outcome | 'all'>('all');

  const params = useMemo(() => data?.parameters ?? [], [data]);
  const options = useMemo(() => outcomeOptions(params, view), [params, view]);
  const shown = useMemo(() => parameterRows(filterByOutcome(params, view, outcome)), [params, view, outcome]);
  // Switching view can leave a chosen outcome that the new view does not have.
  const effective: Outcome | 'all' = outcome === 'all' || options.some((o) => o.value === outcome) ? outcome : 'all';
  const rows = effective === outcome ? shown : parameterRows(params);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%', overflowY: 'auto', pb: 3 }}>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} size="small">Back to overview</Button>
      </Box>
      {error ? (
        <ErrorState title="Could not load this project's metrics" description={error} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonRows count={6} columns={3} />
      ) : (
        <>
          <Box>
            <Typography variant="h5" fontWeight="bold">{data.alias}</Typography>
            <Typography variant="body2" color="text.secondary">
              {data.customer ?? 'No customer'} · {data.status ?? '—'}
              {data.approval_state === 'approved' ? ` · approval v${data.approval_version} · ${data.approved_at?.slice(0, 10)}` : ' · not approved'}
              {data.excluded && ` · ${leftOut(data.excluded).sum} left out`}
              {data.excluded && <InfoTip text={`${HELP.leftOut} ${leftOut(data.excluded).tooltip}`} label="Left out" />}
            </Typography>
          </Box>

          {data.views && (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {VIEW_ORDER.map((v) => {
                const m = data.views![v];
                return (
                  <Box key={v} sx={{ ...panel, borderColor: v === view ? 'accent.text' : 'border.subtle' }}>
                    <Typography variant="caption" fontWeight="bold" textTransform="uppercase" color="text.secondary">{VIEW_LABEL[v]}<InfoTip text={VIEW_HELP[v]} label={VIEW_LABEL[v]} /></Typography>
                    <Typography variant="h5" fontWeight="bold">{formatRate(m.f1)} <Typography component="span" variant="caption" color="text.secondary">F1</Typography></Typography>
                    <Typography variant="body2">Precision {formatRate(m.precision)} · Recall {formatRate(m.recall)}</Typography>
                    <Typography variant="body2" color="text.secondary">Correct {m.tp} · Wrong {m.fp} · Missed {m.fn}</Typography>
                    <Typography variant="caption" color="text.secondary">Avg. candidates {m.avg_candidates === null ? '—' : m.avg_candidates.toFixed(1)}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {data.approval_state !== 'approved' ? (
            <Typography color="text.secondary">This project has no approval yet, so there is nothing to score.</Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2">View</Typography>
                <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: ViewName | null) => { if (v) { onView(v); setOutcome('all'); } }} aria-label="View" sx={{ bgcolor: 'surface.panel' }}>
                  {VIEW_ORDER.map((v) => (
                    <Tooltip key={v} title={VIEW_HELP[v]} arrow><ToggleButton value={v}>{VIEW_LABEL[v]}</ToggleButton></Tooltip>
                  ))}
                </ToggleButtonGroup>
                <Select size="small" value={effective} onChange={(e) => setOutcome(e.target.value as Outcome | 'all')} inputProps={{ 'aria-label': `Filter by outcome in ${VIEW_LABEL[view]}` }} sx={{ minWidth: 200 }}>
                  <MenuItem value="all">All outcomes</MenuItem>
                  {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
                <InfoTip text={HELP.outcomes} label="Outcomes" />
              </Box>

              <Box sx={{ ...panel, p: 0, overflowX: 'auto' }}>
                <Table size="small" aria-label="Parameters of this project">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parameter</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Approved value<InfoTip text={HELP.truth} /></TableCell>
                      <TableCell>AI first pick</TableCell>
                      <TableCell>AI final pick</TableCell>
                      <TableCell>Matched candidate</TableCell>
                      <TableCell align="right">Candidates (first / all)</TableCell>
                      {VIEW_ORDER.map((v) => <TableCell key={v} sx={{ fontWeight: v === view ? 700 : 400 }}>{VIEW_LABEL[v]}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={7 + VIEW_ORDER.length}><Typography variant="body2" color="text.secondary">No parameters with this outcome.</Typography></TableCell></TableRow>
                    )}
                    {rows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell>{r.alias}</TableCell>
                        <TableCell>{r.canonicalName}</TableCell>
                        <TableCell>{r.truth}</TableCell>
                        <TableCell>{r.blindFirst}</TableCell>
                        <TableCell>{r.finalFirst}</TableCell>
                        <TableCell>{r.matched}</TableCell>
                        <TableCell align="right">{r.counts}</TableCell>
                        {VIEW_ORDER.map((v) => <TableCell key={v}>{r.outcomes[v]}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default AnalyticsDetail;
