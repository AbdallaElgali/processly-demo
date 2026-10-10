'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Box, Chip, FormControlLabel, IconButton, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { useResource } from '@/hooks/useResource';
import { useExtractionRuns } from '@/hooks/useExtractionRuns';
import { fetch_project_summary } from '@/api/audit/project_metrics';
import { filterSummary, summaryTotals } from '@/lib/audit/lineage';
import { formatDisplayValue } from '@/lib/review/format';
import type { ProjectSummary } from '@/types/audit';
import { LineageView } from './LineageView';

type SortKey = 'parameterKey' | 'totalCandidates' | 'totalFlags' | 'totalExtractionRuns' | 'lastAiUpdate';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.25, bgcolor: 'surface.panel', borderColor: 'border.subtle', minWidth: 120 }}>
      <Typography variant="h6" component="div" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Paper>
  );
}

/** Per-parameter summary (`GET /audit/project/{id}`); a row opens its lineage. */
export function ParametersAudit({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => fetch_project_summary(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the audit summary.');
  const { runs } = useExtractionRuns(projectId);
  const [query, setQuery] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [reExtractedOnly, setReExtractedOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'parameterKey', dir: 'asc' });

  const totals = useMemo(() => summaryTotals(data ?? []), [data]);
  const rows = useMemo(() => {
    const list = filterSummary(data ?? [], { query, flaggedOnly, reExtractedOnly });
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      return sign * (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv)));
    });
  }, [data, query, flaggedOnly, reExtractedOnly, sort]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const header = (key: SortKey, label: string, align?: 'right') => (
    <TableCell align={align} sortDirection={sort.key === key ? sort.dir : false}>
      <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.dir : 'asc'} onClick={() => sortBy(key)}>{label}</TableSortLabel>
    </TableCell>
  );

  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <div aria-busy="true"><SkeletonRows count={8} columns={6} /></div>;
  if ((data ?? []).length === 0) {
    return <EmptyState title="No parameters to audit" description="This project has no parameters yet. Add some on the Parameters screen." />;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Stat label="Parameters" value={totals.parameters} />
        <Stat label="Extracted again" value={totals.reExtracted} />
        <Stat label="With flags" value={totals.withFlags} />
        <Stat label="Flags in total" value={totals.totalFlags} />
        <Stat label="Edited by a person" value={totals.humanModified} />
        <Stat label="Value from an AI candidate" value={totals.aiAccepted} />
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
        <SearchField value={query} onChange={setQuery} placeholder="Search parameters" aria-label="Search parameters" />
        <FormControlLabel control={<Switch checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />} label="Only with flags" />
        <FormControlLabel control={<Switch checked={reExtractedOnly} onChange={(e) => setReExtractedOnly(e.target.checked)} />} label="Only extracted again" />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{rows.length} of {totals.parameters} shown</Typography>
      </Stack>

      <TableContainer sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel' }}>
        <Table size="small" aria-label="Parameters and their history">
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'surface.sunken', color: 'text.secondary', fontWeight: 600 } }}>
              <TableCell width={44} aria-label="Expand" />
              {header('parameterKey', 'Parameter')}
              <TableCell>Final value</TableCell>
              <TableCell>Review</TableCell>
              {header('totalCandidates', 'Candidates', 'right')}
              {header('totalExtractionRuns', 'Runs', 'right')}
              {header('totalFlags', 'Flags', 'right')}
              {header('lastAiUpdate', 'Last AI update')}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8}><EmptyState title="No parameter matches" description="Change the search or switch a filter off." /></TableCell></TableRow>
            )}
            {rows.map((r: ProjectSummary) => {
              const expanded = open.has(r.parameterKey);
              return (
                <Fragment key={r.parameterKey}>
                  <TableRow hover>
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={() => toggle(r.parameterKey)}
                        aria-expanded={expanded}
                        aria-controls={`lineage-${r.parameterKey}`}
                        aria-label={`${expanded ? 'Hide' : 'Show'} the history of ${r.parameterKey}`}
                      >
                        {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.parameterKey}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.finalValue === null ? <Typography component="span" variant="body2" sx={{ color: 'text.muted' }}>no value</Typography> : formatDisplayValue(r.finalValue)}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        <Chip size="small" variant="outlined" label={r.reviewAction.toLowerCase()} />
                        {r.isHumanModified && <Chip size="small" icon={<EditOutlinedIcon />} label="Edited" sx={{ bgcolor: 'surface.sunken', color: 'status.modified', '& .MuiChip-icon': { color: 'inherit' } }} />}
                        {r.isAiAccepted && <Chip size="small" icon={<CheckCircleOutlineIcon />} label="From AI" sx={{ bgcolor: 'status.successBg', color: 'status.success', '& .MuiChip-icon': { color: 'inherit' } }} />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.totalCandidates}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.totalExtractionRuns}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: r.totalFlags > 0 ? 'status.danger' : undefined, fontWeight: r.totalFlags > 0 ? 600 : 400 }}>{r.totalFlags}</TableCell>
                    <TableCell>{r.lastAiUpdate ? new Date(r.lastAiUpdate).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow id={`lineage-${r.parameterKey}`}>
                      <TableCell />
                      <TableCell colSpan={7} sx={{ pt: 0.5, pb: 2 }}>
                        <Box sx={{ pr: 1 }}><LineageView projectId={projectId} parameterKey={r.parameterKey} runs={runs} /></Box>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
