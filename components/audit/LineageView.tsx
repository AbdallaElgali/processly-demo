'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Chip, Collapse, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRows } from '@/components/ui/Skeletons';
import { ConfidenceIndicator } from '@/components/workspace/indicators';
import { useResource } from '@/hooks/useResource';
import { fetch_parameter_lineage } from '@/api/audit/project_metrics';
import type { ExtractionRun } from '@/api/types/projects';
import { buildLineage, CARRIED_OVER_LABEL, emptyValueLabel, REVIEWER_FLAG_LABEL, type LineageRow } from '@/lib/audit/lineage';
import { formatDisplayValue } from '@/lib/review/format';
import { RUN_TYPE_LABEL } from '@/lib/overview/status';
import type { FlagDetail, ParameterLineageEvent } from '@/types/audit';

const valueText = (e: ParameterLineageEvent) =>
  e.value === null ? emptyValueLabel(e.extractionLogic) : `${formatDisplayValue(e.value)}${e.unit ? ` ${e.unit}` : ''}`;

const runText = (row: LineageRow) =>
  row.runNumber !== null ? `Run ${row.runNumber}` : 'Run unknown';

function FlagCell({ row }: { row: LineageRow }) {
  const flag = row.event.flag;
  if (!flag) return <Typography variant="caption" sx={{ color: 'text.muted' }}>No flag</Typography>;
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <FlagTypeChip flag={flag} carriedOver={row.flagCarriedOver} />
        <Chip
          size="small"
          icon={flag.status === 'OPEN' ? <FlagOutlinedIcon /> : <CheckCircleOutlineIcon />}
          label={flag.status === 'OPEN' ? 'Open' : flag.status === 'RESOLVED' ? 'Resolved' : flag.status.toLowerCase()}
          sx={{
            bgcolor: flag.status === 'OPEN' ? 'status.dangerBg' : 'status.successBg',
            color: flag.status === 'OPEN' ? 'status.danger' : 'status.success',
            '& .MuiChip-icon': { color: 'inherit' },
          }}
        />
      </Stack>
      {flag.flagReason && <Typography variant="caption" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>&ldquo;{flag.flagReason}&rdquo;</Typography>}
      <Typography variant="caption" sx={{ color: 'text.muted' }}>Raised {new Date(flag.createdAt).toLocaleString()}</Typography>
      {row.resolvedBy && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowForwardIcon sx={{ fontSize: 14 }} aria-hidden /> Resolved by candidate #{row.resolvedBy.ordinal}
          {row.resolvedBy.runNumber !== null ? ` (run ${row.resolvedBy.runNumber})` : ''}
        </Typography>
      )}
    </Stack>
  );
}

function FlagTypeChip({ flag, carriedOver }: { flag: FlagDetail; carriedOver: boolean }) {
  return (
    <Tooltip
      title={`Every stored flag is raised by a reviewer. The backend's type (${flag.flagType ?? 'none'}) means a flag on an AI value, not one raised by the AI (B23).`}
    >
      <Chip
        size="small"
        variant="outlined"
        icon={<FlagOutlinedIcon />}
        label={carriedOver ? `${REVIEWER_FLAG_LABEL}, ${CARRIED_OVER_LABEL}` : REVIEWER_FLAG_LABEL}
        sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
      />
    </Tooltip>
  );
}

function ChangeCell({ row }: { row: LineageRow }) {
  if (row.valueChange === 'first') return <Typography variant="caption" sx={{ color: 'text.muted' }}>First candidate</Typography>;
  const prev = row.previous!;
  return (
    <Stack spacing={0.25}>
      {row.valueChange === 'same' ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Same value as #{row.ordinal - 1}</Typography>
      ) : (
        <Typography variant="caption" sx={{ color: 'status.warning', fontWeight: 600 }}>
          Changed from {valueText(prev)}
        </Typography>
      )}
      {row.unitChanged && row.valueChange === 'same' && (
        <Typography variant="caption" sx={{ color: 'status.warning', fontWeight: 600 }}>Unit changed from {prev.unit ?? 'none'}</Typography>
      )}
    </Stack>
  );
}

/**
 * Every candidate a parameter has had, oldest first, with the run that made
 * it, what changed since the previous candidate, its flag and the flag chain
 * (plan-A 6.7). The Workspace shows only the newest run's candidates (B21),
 * so this is where earlier values are compared.
 */
export function LineageView({ projectId, parameterKey, runs }: { projectId: string; parameterKey: string; runs: ExtractionRun[] | null }) {
  const load = useCallback((signal: AbortSignal) => fetch_parameter_lineage(projectId, parameterKey, signal), [projectId, parameterKey]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the history of this parameter.');
  const view = useMemo(() => (data ? buildLineage(data, runs) : null), [data, runs]);
  const [explained, setExplained] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExplained((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading) return <div aria-busy="true"><SkeletonRows count={3} columns={6} /></div>;
  if (!view) return <Alert severity="info" variant="outlined">The backend has no history for {parameterKey} in this project.</Alert>;
  if (view.rows.length === 0) return <Alert severity="info" variant="outlined">{parameterKey} has not been extracted yet, so there are no candidates.</Alert>;

  return (
    <Stack spacing={1.5}>
      {view.runCount > 1 && (
        <Alert severity="info" variant="outlined">
          This parameter was extracted in {view.runCount} runs. The Workspace shows only the newest run&apos;s candidates (backend B21); the earlier ones are here.
        </Alert>
      )}

      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }} aria-label="Values over time">
        {view.rows.map((r, i) => (
          <Fragment key={r.event.candidateId}>
            {i > 0 && <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.muted' }} aria-hidden />}
            <Chip
              size="small"
              variant={r.event.isWinner ? 'filled' : 'outlined'}
              color={r.event.isWinner ? 'primary' : 'default'}
              icon={r.event.isWinner ? <CheckCircleOutlineIcon /> : undefined}
              label={`#${r.ordinal} · ${runText(r)}: ${valueText(r.event)}${r.event.isWinner ? ' (current)' : ''}`}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </Fragment>
        ))}
      </Stack>

      <TableContainer sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel' }}>
        <Table size="small" aria-label={`Candidates of ${parameterKey}, oldest first`}>
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'surface.sunken', color: 'text.secondary', fontWeight: 600 } }}>
              <TableCell width={44} aria-label="Expand" />
              <TableCell width={48}>#</TableCell>
              <TableCell>Run</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Change</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Flag</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.rows.map((row) => {
              const e = row.event;
              const open = explained.has(e.candidateId);
              return (
                <Fragment key={e.candidateId}>
                  <TableRow sx={{ bgcolor: e.isWinner ? 'accent.tint' : undefined, '& > td': { borderBottom: open ? 0 : undefined } }}>
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={() => toggle(e.candidateId)}
                        aria-expanded={open}
                        aria-label={`${open ? 'Hide' : 'Show'} the model's explanation for candidate ${row.ordinal}`}
                      >
                        {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.ordinal}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{runText(row)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {row.runType ? RUN_TYPE_LABEL[row.runType] ?? row.runType : 'type unknown'} · {new Date(e.createdAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: e.value === null ? 'text.muted' : 'text.primary', fontStyle: e.value === null ? 'italic' : 'normal' }}
                      >
                        {valueText(e)}
                      </Typography>
                      {e.isWinner && (
                        <Chip size="small" icon={<CheckCircleOutlineIcon />} label="Current value" sx={{ mt: 0.5, bgcolor: 'status.successBg', color: 'status.success', '& .MuiChip-icon': { color: 'inherit' } }} />
                      )}
                      {row.resolvesFlag && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                          Resolved the flag on #{row.resolvesFlag.fromOrdinal}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell><ChangeCell row={row} /></TableCell>
                    <TableCell><ConfidenceIndicator confidence={e.confidence * 100} /></TableCell>
                    <TableCell><FlagCell row={row} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                      <Collapse in={open} unmountOnExit>
                        <Box sx={{ pb: 1.5, pl: 6 }}>
                          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mb: 0.5 }}>
                            The model&apos;s explanation, in its own words (not a quote from the document)
                          </Typography>
                          <Typography variant="body2" sx={{ color: e.extractionLogic ? 'text.primary' : 'text.muted', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                            {e.extractionLogic || 'No reasoning recorded'}
                          </Typography>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Final value {view.finalValue === null ? 'not set' : formatDisplayValue(view.finalValue)}
        {view.reviewAction ? ` · review action ${view.reviewAction.toLowerCase()}` : ''}
        {view.isAiAccepted ? ' · matches a value the AI proposed' : ' · does not match any AI candidate'}. Each candidate shows only its newest flag.
      </Typography>
    </Stack>
  );
}
