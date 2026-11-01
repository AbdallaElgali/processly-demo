import React, { useCallback, useMemo, useState } from 'react';
import { Box, Chip, FormControlLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { getProjectMetrics } from '@/api/analytics';
import type { ViewName } from '@/api/types/analytics';
import { useResource } from '@/hooks/useResource';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { chartPoints, originMixPoints, type Scope } from '@/lib/analytics/charts';
import { acceptanceTile, detailTiles, headlineTiles, projectCounts, type RatePair } from '@/lib/analytics/headline';
import { sortRows, tableRows, type SortKey, type TableRow as Row } from '@/lib/analytics/table';
import { DEFAULT_VIEW, formatRate, HELP, VIEW_HELP, VIEW_LABEL, VIEW_ORDER } from '@/lib/analytics/views';
import { InfoTip } from './InfoTip';
import { OriginChart, ScoreCharts } from './AnalyticsCharts';
import AnalyticsDetail from './AnalyticsDetail';

const panel = { bgcolor: 'surface.panel', border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 2 } as const;

function Pair({ pair, big }: { pair: RatePair; big?: boolean }) {
  return (
    <>
      <Typography variant={big ? 'h3' : 'h5'} fontWeight="bold" aria-label={`Average of the projects: ${formatRate(pair.average)}`}>{formatRate(pair.average)}</Typography>
      <Typography variant="caption" color="text.secondary" component="div">Average of the projects</Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>{formatRate(pair.pooled)} <Typography component="span" variant="caption" color="text.secondary">all parameters pooled</Typography></Typography>
    </>
  );
}

const COLUMNS: { key: SortKey; label: string; get: (r: Row) => React.ReactNode; tip?: string }[] = [
  { key: 'version', label: 'Version', get: (r) => r.version ?? '—' },
  { key: 'approvedAt', label: 'Approved', get: (r) => r.approvedAt?.slice(0, 10) ?? '—' },
  { key: 'f1', label: 'F1', get: (r) => formatRate(r.f1) },
  { key: 'precision', label: 'Precision', get: (r) => formatRate(r.precision) },
  { key: 'recall', label: 'Recall', get: (r) => formatRate(r.recall) },
  { key: 'foundF1', label: 'Found by the AI F1', get: (r) => formatRate(r.foundF1) },
  { key: 'firstF1', label: 'Right first time F1', get: (r) => formatRate(r.firstF1) },
  { key: 'acceptance', label: 'Acceptance', tip: HELP.acceptance, get: (r) => formatRate(r.acceptance) },
  { key: 'correct', label: 'Correct', get: (r) => r.correct ?? '—' },
  { key: 'wrong', label: 'Wrong', get: (r) => r.wrong ?? '—' },
  { key: 'missed', label: 'Missed', get: (r) => r.missed ?? '—' },
  {
    key: 'leftOut', label: 'Left out', tip: HELP.leftOut,
    get: (r) => (r.leftOut === null ? '—' : <Tooltip title={r.leftOutTooltip} arrow><span tabIndex={0}>{r.leftOut}</span></Tooltip>),
  },
];

const AnalyticsOverview: React.FC = () => {
  const load = useCallback((signal: AbortSignal) => getProjectMetrics(signal), []);
  const { data, error, loading, reload } = useResource(load, 'The metrics could not be loaded.');
  const [view, setView] = useState<ViewName>(DEFAULT_VIEW);
  const [scope, setScope] = useState<Scope>('last5');
  const [compare, setCompare] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const base = tableRows(data.projects, view);
    return sort ? sortRows(base, sort.key, sort.dir) : base;
  }, [data, view, sort]);

  if (error) return <ErrorState title="Could not load the metrics" description={error} onRetry={reload} />;
  if (loading || !data) return <SkeletonRows count={6} columns={3} />;

  if (detailId) return <AnalyticsDetail projectId={detailId} view={view} onView={setView} onBack={() => setDetailId(null)} />;

  const { summary, projects } = data;
  const tiles = headlineTiles(summary);
  const acc = acceptanceTile(summary);
  const counts = projectCounts(summary);
  const detail = detailTiles(summary, view);
  const points = chartPoints(projects, view, scope, compare);
  const origin = originMixPoints(projects, scope);

  const sortBy = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%', overflowY: 'auto', pb: 3 }}>
      <Typography variant="h5" fontWeight="bold">
        Global Overview
        <InfoTip text={HELP.pooledVsAverage} label="Average and pooled" />
      </Typography>

      {/* Headline */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {tiles.map((t) => (
          <Box key={t.view} sx={{ ...panel, gridColumn: 'span 1', bgcolor: 'status.infoBg' }}>
            <Typography variant="caption" fontWeight="bold" textTransform="uppercase" sx={{ color: 'status.info' }}>
              {t.label} · F1<InfoTip text={t.help} label={t.label} />
            </Typography>
            <Pair pair={{ average: t.average, pooled: t.pooled }} big />
            {t.avgCandidates !== null && (
              <Typography variant="caption" color="text.secondary">Avg. candidates: {t.avgCandidates.toFixed(1)}<InfoTip text={HELP.avgCandidates} /></Typography>
            )}
          </Box>
        ))}
        <Box sx={{ ...panel, bgcolor: 'status.successBg' }}>
          <Typography variant="caption" fontWeight="bold" textTransform="uppercase" sx={{ color: 'status.success' }}>
            Acceptance rate<InfoTip text={HELP.acceptance} />
          </Typography>
          <Pair pair={acc} />
        </Box>
        <Box sx={panel}>
          <Typography variant="caption" fontWeight="bold" textTransform="uppercase" color="text.secondary">Projects</Typography>
          <Typography variant="h5" fontWeight="bold">{counts.approved} <Typography component="span" variant="body2" color="text.secondary">approved</Typography></Typography>
          <Typography variant="body2" color="text.secondary">{counts.notApproved} not approved</Typography>
        </Box>
      </Box>

      {/* View switch */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle2">View</Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: ViewName | null) => v && setView(v)} aria-label="View" sx={{ bgcolor: 'surface.panel' }}>
          {VIEW_ORDER.map((v) => (
            <Tooltip key={v} title={VIEW_HELP[v]} arrow>
              <ToggleButton value={v} aria-label={`${VIEW_LABEL[v]}: ${VIEW_HELP[v]}`}>{VIEW_LABEL[v]}</ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Detailed tiles of the selected view */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {([['Precision', HELP.precision, detail.precision], ['Recall', HELP.recall, detail.recall], ['F1', HELP.f1, detail.f1]] as [string, string, RatePair][]).map(([label, help, pair]) => (
          <Box key={label} sx={panel}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">{label}<InfoTip text={help} /></Typography>
            <Pair pair={pair} />
          </Box>
        ))}
        <Box sx={panel}>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">Correct / Wrong / Missed<InfoTip text={HELP.outcomes} /></Typography>
          <Typography variant="h5" fontWeight="bold">{detail.correct} / {detail.wrong} / {detail.missed}</Typography>
          <Typography variant="caption" color="text.secondary">all parameters pooled</Typography>
        </Box>
        <Box sx={panel}>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">Avg. candidates<InfoTip text={HELP.avgCandidates} /></Typography>
          <Typography variant="h5" fontWeight="bold">{detail.avgCandidates === null ? '—' : detail.avgCandidates.toFixed(1)}</Typography>
        </Box>
      </Box>

      {/* Charts */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_, s: Scope | null) => s && setScope(s)} aria-label="Projects shown in the charts" sx={{ bgcolor: 'surface.panel' }}>
          <ToggleButton value="last5">Last 5</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel control={<Switch size="small" checked={compare} onChange={(e) => setCompare(e.target.checked)} />} label="Compare with Right first time" />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <ScoreCharts points={points} viewLabel={VIEW_LABEL[view]} compare={compare} />
        <OriginChart points={origin} />
      </Box>

      {/* Table */}
      <Box sx={{ ...panel, p: 0, overflowX: 'auto' }}>
        <Table size="small" aria-label="Per-project metrics">
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Status</TableCell>
              {COLUMNS.map((c) => (
                <TableCell key={c.key} align="right" sortDirection={sort?.key === c.key ? sort.dir : false}>
                  <TableSortLabel active={sort?.key === c.key} direction={sort?.key === c.key ? sort.dir : 'desc'} onClick={() => sortBy(c.key)}>
                    {c.label}
                  </TableSortLabel>
                  {c.tip && <InfoTip text={c.tip} />}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.projectId}
                hover={!r.notApproved}
                tabIndex={r.notApproved ? undefined : 0}
                onClick={r.notApproved ? undefined : () => setDetailId(r.projectId)}
                onKeyDown={r.notApproved ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(r.projectId); } }}
                sx={{ cursor: r.notApproved ? 'default' : 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'accent.text' } }}
              >
                <TableCell>{r.alias}</TableCell>
                <TableCell>{r.customer ?? '—'}</TableCell>
                <TableCell>{r.status ?? '—'}</TableCell>
                {r.notApproved ? (
                  <TableCell colSpan={COLUMNS.length}><Chip size="small" label="not approved" /></TableCell>
                ) : (
                  COLUMNS.map((c) => <TableCell key={c.key} align="right">{c.get(r)}</TableCell>)
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

export default AnalyticsOverview;
