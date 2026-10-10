'use client';

import { Fragment, useState, type ReactNode } from 'react';
import {
  Box, Chip, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { LAZY_EXPLANATION, LAZY_LABEL, scopeLabel } from '@/lib/prompts/view';

export interface SlotTableRow {
  key: string;
  slotKey: string;
  level: string;
  description?: string | null;
  version: number | null;
  model: string | null;
  effort: string | null;
  temperature: number | null;
  /** Whether this slot calls a model at all (category slots are prompt text only). */
  callsModel: boolean;
  scope: string | null;
  lazy?: boolean | null;
  note?: string;
  /** Expanded content; a row without it has no expand button. */
  detail?: ReactNode;
}

const UNSET = (
  <Typography component="span" variant="body2" sx={{ color: 'text.muted' }}>
    model default
  </Typography>
);

function ModelCell({ row, value, unit = '' }: { row: SlotTableRow; value: string | number | null; unit?: string }) {
  if (value !== null) return <span>{value}{unit}</span>;
  if (!row.callsModel) {
    return (
      <Tooltip title="This slot is prompt text only; it makes no model call of its own.">
        <Typography component="span" variant="body2" sx={{ color: 'text.muted' }}>n/a</Typography>
      </Tooltip>
    );
  }
  return UNSET;
}

/** The shared table for pins, the resolution preview and the registry. */
export function SlotTable({ rows, label, lastColumn }: { rows: SlotTableRow[]; label: string; lastColumn?: { header: string; render: (row: SlotTableRow) => ReactNode } }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const columns = 7 + (lastColumn ? 1 : 0);

  return (
    <TableContainer sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 1, bgcolor: 'surface.panel' }}>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'surface.sunken', color: 'text.secondary', fontWeight: 600 } }}>
            <TableCell width={44} aria-label="Expand" />
            <TableCell>Slot</TableCell>
            <TableCell>Version</TableCell>
            <TableCell>Model</TableCell>
            <TableCell>Reasoning effort</TableCell>
            <TableCell>Temperature</TableCell>
            <TableCell>Scope</TableCell>
            {lastColumn && <TableCell>{lastColumn.header}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const expanded = open.has(row.key);
            return (
              <Fragment key={row.key}>
                <TableRow hover sx={{ '& > td': { borderBottom: expanded ? 0 : undefined } }}>
                  <TableCell padding="checkbox">
                    {row.detail && (
                      <IconButton
                        size="small"
                        onClick={() => toggle(row.key)}
                        aria-expanded={expanded}
                        aria-controls={`slot-${row.key}`}
                        aria-label={`${expanded ? 'Hide' : 'Show'} details of ${row.slotKey}`}
                      >
                        {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'text.primary' }}>{row.slotKey}</Typography>
                    {row.description && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{row.description}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.version !== null ? `v${row.version}` : <Typography component="span" variant="body2" sx={{ color: 'text.muted' }}>none</Typography>}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}><ModelCell row={row} value={row.model} /></TableCell>
                  <TableCell><ModelCell row={row} value={row.effort} /></TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}><ModelCell row={row} value={row.temperature} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip size="small" variant="outlined" label={scopeLabel(row.scope)} />
                      {row.lazy && (
                        <Tooltip title={LAZY_EXPLANATION}>
                          <Chip size="small" icon={<ScheduleOutlinedIcon />} label={LAZY_LABEL} sx={{ bgcolor: 'status.infoBg', color: 'status.info', '& .MuiChip-icon': { color: 'status.info' } }} />
                        </Tooltip>
                      )}
                    </Stack>
                    {row.note && <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.5 }}>{row.note}</Typography>}
                  </TableCell>
                  {lastColumn && <TableCell>{lastColumn.render(row)}</TableCell>}
                </TableRow>
                {row.detail && expanded && (
                  <TableRow id={`slot-${row.key}`}>
                    <TableCell />
                    <TableCell colSpan={columns - 1} sx={{ pt: 0 }}>
                      <Box sx={{ pb: 1 }}>{row.detail}</Box>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Prompt text, as written, scrollable; never rendered as markup. */
export function PromptText({ text }: { text: string }) {
  return (
    <Box
      component="pre"
      tabIndex={0}
      aria-label="Prompt text"
      sx={{
        m: 0, p: 1.5, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        bgcolor: 'surface.sunken', border: 1, borderColor: 'border.subtle', borderRadius: 1,
        fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.5, color: 'text.primary',
      }}
    >
      {text}
    </Box>
  );
}
