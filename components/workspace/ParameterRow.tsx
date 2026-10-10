'use client';

import { memo, useId, useMemo, useState } from 'react';
import {
  Badge, Box, Button, CircularProgress, Collapse, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import FlagIcon from '@mui/icons-material/Flag';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import UndoIcon from '@mui/icons-material/Undo';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { cellRef } from '@/lib/excel/address';
import { boxRangeLabel } from '@/lib/excel/highlight';
import type { InputField, Specification, SpecificationSource } from '@/types';
import type { RowState } from '@/lib/review/rowState';
import { hasValue } from '@/lib/review/rowState';
import { matchReasonCode } from '@/lib/review/reasonCodes';
import { formatDisplayValue } from '@/lib/review/format';
import { fieldAnchors } from '@/lib/review/anchors';
import { canRevert } from '@/lib/review/edits';
import { parseCandidateNumber } from '@/lib/excel/highlight';
import { ConfidenceIndicator, QualifierTags, SecondaryFacts, StateBadge } from './indicators';
import { ValueCell } from './ValueCell';
import { WhyThisValue } from './WhyThisValue';
import type { Density } from '@/components/ui/DensityToggle';

export interface ParameterRowHandlers {
  onToggle: (fieldId: string) => void;
  onFocusRow: (fieldId: string) => void;
  /** `fieldId` lets the viewer offer the parameter's other anchors (1 of N). */
  onJumpToSource: (source: SpecificationSource, fieldId?: string) => void;
  onSelectCandidate: (fieldId: string, specId: string) => void;
  onEdit: (fieldId: string, value: string, unit: string) => void;
  onRevert: (fieldId: string) => void;
  onFlag: (fieldId: string, reason: string) => void;
  onFlagAndReextract: (fieldId: string, reason: string) => void;
  onReextract: (fieldId: string, hint: string) => void;
  onRemoveFlag: (fieldId: string) => void;
  onAccept: (fieldId: string) => void;
  /** True when the document is a workbook, so locations read as sheet and cell range. */
  isSpreadsheet: (documentId: string | null | undefined) => boolean;
  documentName: (documentId: string | null | undefined) => string | null;
}

/**
 * What one row is waiting for (step 10). Only this row shows it and only its
 * own controls are disabled; the rest of the table stays usable (CLAUDE.md 8.1).
 */
export type RowBusy =
  | { kind: 'flag' | 'unflag' | 'select' | 'accept' }
  | { kind: 'queued' }
  | { kind: 'correcting'; phase?: string };

const BUSY_LABEL: Record<RowBusy['kind'], string> = {
  flag: 'Flagging…',
  unflag: 'Removing flag…',
  select: 'Recording choice…',
  accept: 'Accepting…',
  queued: 'Queued for re-extraction',
  correcting: 'Re-extracting…',
};

export function busyLabel(busy: RowBusy): string {
  if (busy.kind === 'correcting' && busy.phase) return `Re-extracting · ${busy.phase}`;
  return BUSY_LABEL[busy.kind];
}

/** Shared column template, so headers (none today) and rows can never drift. */
export const ROW_COLUMNS = '28px minmax(180px, 1.6fr) minmax(130px, 1.1fr) 112px minmax(132px, 1fr) 36px';

const hasLocation = (s: SpecificationSource | null | undefined) =>
  !!s && (s.pageNumber !== null || s.boundingBox !== null || s.cellCoordinates !== null || !!s.documentId);

/**
 * "Page 4" for a PDF; "Sheet 3 · B10:D15" or "Sheet 3 · C12" for a workbook,
 * where the backend's box is a cell range (lib/excel/highlight.ts). Null when
 * there is no location. The backend writes {-1,-1} for an unresolved cell.
 */
export function locationLabel(s: SpecificationSource | null | undefined, spreadsheet = false): string | null {
  if (!s) return null;
  const cell = s.cellCoordinates;
  if (cell && cell.row > 0 && cell.column > 0) {
    const at = cellRef({ r: cell.row - 1, c: cell.column - 1 });
    return s.pageNumber !== null && s.pageNumber !== undefined ? `Sheet ${s.pageNumber} · ${at}` : at;
  }
  if (spreadsheet) {
    const range = boxRangeLabel(s.boundingBox);
    if (s.pageNumber === null || s.pageNumber === undefined) return range;
    return `Sheet ${s.pageNumber}${range ? ` · ${range}` : ''}`;
  }
  if (s.pageNumber !== null && s.pageNumber !== undefined) return `Page ${s.pageNumber}`;
  return null;
}

/**
 * One parameter (plan-A 6.4). The collapsed row is read-only and scannable;
 * the detail holds the candidates with "Why this value" (AM15), value
 * editing, and the review actions (step 10).
 */
function ParameterRowImpl({
  field,
  state,
  expanded,
  focused,
  busy,
  dirty,
  accepted,
  density,
  handlers,
}: {
  field: InputField;
  state: RowState;
  expanded: boolean;
  focused: boolean;
  busy: RowBusy | null;
  /** Has an unsaved edit. */
  dirty: boolean;
  /** Accepted in this session (not stored per row, B15). */
  accepted: boolean;
  density: Density;
  handlers: ParameterRowHandlers;
}) {
  const spec = state.selected;
  const compact = density === 'compact';
  const label = field.parameter_alias || field.label || field.id;
  const source = spec?.source ?? null;
  const canJump = hasLocation(source);
  const anchorCount = useMemo(() => fieldAnchors(field).length, [field]);

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'border.subtle',
        bgcolor: expanded ? 'surface.hover' : 'transparent',
      }}
      aria-busy={busy ? true : undefined}
    >
      <Box
        role="button"
        data-row-key={field.id}
        tabIndex={focused ? 0 : -1}
        aria-expanded={expanded}
        aria-label={`${label}: ${formatDisplayValue(spec?.value) || 'no value'}${busy ? `, ${busyLabel(busy)}` : ''}${dirty ? ', unsaved change' : ''}`}
        onClick={() => {
          handlers.onFocusRow(field.id);
          handlers.onToggle(field.id);
        }}
        onFocus={() => handlers.onFocusRow(field.id)}
        sx={{
          display: 'grid',
          gridTemplateColumns: ROW_COLUMNS,
          alignItems: 'center',
          columnGap: 1.5,
          px: 1.5,
          minHeight: compact ? 36 : 48,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'surface.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'accent.focus', outlineOffset: -2 },
          '@container (max-width: 620px)': {
            gridTemplateColumns: '28px minmax(150px, 1.4fr) minmax(110px, 1fr) minmax(110px, auto) 36px',
            '& [data-col="confidence"], & [data-col="inline-tags"]': { display: 'none' },
          },
        }}
      >
        <ChevronRightIcon
          fontSize="small"
          sx={{
            color: 'text.muted',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shortest }),
          }}
        />

        {/* The name gets the width; qualifier tags sit under it (comfortable) or
            inline and hidden first when the pane is narrow (compact). */}
        <Box sx={{ minWidth: 0, py: compact ? 0 : 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500, color: 'text.primary', minWidth: 0 }} title={label}>
              {label}
            </Typography>
            {compact && (
              <Box data-col="inline-tags" sx={{ display: 'flex' }}>
                <QualifierTags parameterKey={field.id} />
              </Box>
            )}
          </Stack>
          {!compact && (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, minWidth: 0 }}>
              <QualifierTags parameterKey={field.id} />
              {label !== field.id && (
                <Typography variant="caption" noWrap sx={{ color: 'text.muted', fontFamily: 'monospace' }}>
                  {field.id}
                </Typography>
              )}
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {busy ? (
            <BusyLine busy={busy} />
          ) : (
            <>
              <ValueCell parameterKey={field.id} spec={spec} />
              {dirty && (
                <Tooltip title="Unsaved change: kept on this screen until you Save">
                  <Box
                    role="img"
                    aria-label="Unsaved change"
                    sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'status.modified', flexShrink: 0 }}
                  />
                </Tooltip>
              )}
            </>
          )}
        </Stack>

        <Box data-col="confidence">
          {hasValue(spec) && <ConfidenceIndicator confidence={spec?.confidence} human={!spec?.candidateId || !!spec?.original} />}
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <StateBadge state={state} flagReason={field.flagReason} />
          <SecondaryFacts facts={state.secondary} acceptedLocally={accepted && field.reviewAction !== 'ACCEPTED'} />
        </Stack>

        <Box onClick={(e) => e.stopPropagation()}>
          {canJump && source && (
            <Tooltip title={anchorCount > 1 ? `Show in document · ${anchorCount} sources, use the arrows above the viewer to cycle` : 'Show in document'}>
              <IconButton
                size="small"
                tabIndex={-1}
                aria-label={anchorCount > 1 ? `Show in document, ${anchorCount} sources` : 'Show in document'}
                onClick={() => handlers.onJumpToSource(source, field.id)}
              >
                <Badge
                  badgeContent={anchorCount > 1 ? anchorCount : 0}
                  overlap="circular"
                  sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 15, minWidth: 15, px: 0.4, bgcolor: 'surface.raised', color: 'text.primary', border: 1, borderColor: 'border.strong' } }}
                >
                  <FindInPageOutlinedIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Collapse in={expanded} unmountOnExit timeout={160}>
        <RowDetail field={field} state={state} busy={busy} accepted={accepted} handlers={handlers} />
      </Collapse>
    </Box>
  );
}

export const ParameterRow = memo(ParameterRowImpl);

function BusyLine({ busy }: { busy: RowBusy }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, color: busy.kind === 'queued' ? 'text.secondary' : 'status.info' }}>
      {busy.kind === 'queued' ? (
        <HourglassEmptyIcon sx={{ fontSize: 15 }} aria-hidden />
      ) : (
        <CircularProgress size={13} thickness={5} color="inherit" aria-hidden />
      )}
      <Typography variant="caption" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
        {busyLabel(busy)}
      </Typography>
    </Stack>
  );
}

function RowDetail({
  field,
  state,
  busy,
  accepted,
  handlers,
}: {
  field: InputField;
  state: RowState;
  busy: RowBusy | null;
  accepted: boolean;
  handlers: ParameterRowHandlers;
}) {
  const selected = state.selected;
  const locked = !!busy;
  const where = (s: Specification) => locationLabel(s.source, handlers.isSpreadsheet(s.source?.documentId));

  return (
    <Box
      sx={{
        pl: 6, pr: 2, pb: 2, pt: 0.5, display: 'grid', gap: 2.5, gridTemplateColumns: '1fr',
        // Follows the table pane's width, not the window's (the pane is resizable).
        '@container (min-width: 760px)': { gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' },
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Box>
          <SectionLabel>Candidates</SectionLabel>
          <CandidateList
            field={field}
            selectedId={selected?.id}
            onSelect={(specId) => handlers.onSelectCandidate(field.id, specId)}
            onJump={(src) => handlers.onJumpToSource(src, field.id)}
            where={where}
            documentName={handlers.documentName}
            disabled={locked}
          />
          {field.isFlagged && field.specifications.length > 1 && (
            <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.75 }}>
              The row is flagged, so choosing a candidate also tells the backend which one answers the flag.
            </Typography>
          )}
        </Box>

        {selected && (
          <Box component="section" aria-label="Why this value">
            <SectionLabel>Why this value</SectionLabel>
            <WhyThisValue
              spec={selected}
              location={where(selected)}
              documentName={handlers.documentName(selected.source?.documentId)}
              onJump={hasLocation(selected.source) ? () => handlers.onJumpToSource(selected.source!, field.id) : undefined}
            />
          </Box>
        )}
      </Stack>

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <ValueEditor key={selected?.id ?? 'none'} field={field} spec={selected} disabled={locked} handlers={handlers} />
        <ReviewActions field={field} busy={busy} accepted={accepted} handlers={handlers} />
      </Stack>
    </Box>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" component="h4" sx={{ color: 'text.secondary', mb: 0.75, display: 'block' }}>
      {children}
    </Typography>
  );
}

/**
 * Value and unit. AM10: the input shows the rounded value and only a
 * keystroke writes, so an untouched row saves back exactly what was loaded.
 * An edited AI value shows what was extracted, with Revert.
 */
function ValueEditor({
  field,
  spec,
  disabled,
  handlers,
}: {
  field: InputField;
  spec: Specification | undefined;
  disabled: boolean;
  handlers: ParameterRowHandlers;
}) {
  const [draft, setDraft] = useState<{ value: string; unit: string } | null>(null);
  const shownValue = draft?.value ?? formatDisplayValue(spec?.value);
  const shownUnit = draft?.unit ?? spec?.unit ?? '';
  const raw = draft?.value ?? spec?.value ?? '';
  const notNumber = raw.trim() !== '' && parseCandidateNumber(raw) === null;
  const original = spec?.original;

  const commit = (value: string, unit: string) => {
    setDraft({ value, unit });
    handlers.onEdit(field.id, value, unit);
  };

  return (
    <Box>
      <SectionLabel>Value</SectionLabel>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Value"
          value={shownValue}
          disabled={disabled}
          onChange={(e) => commit(e.target.value, shownUnit)}
          onBlur={() => setDraft(null)}
          slotProps={{ htmlInput: { inputMode: 'decimal', style: { fontVariantNumeric: 'tabular-nums' } } }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Unit"
          value={shownUnit}
          disabled={disabled}
          onChange={(e) => commit(draft?.value ?? spec?.value ?? '', e.target.value)}
          onBlur={() => setDraft(null)}
          sx={{ width: 96 }}
        />
      </Stack>
      {notNumber && (
        <Typography variant="caption" sx={{ color: 'status.warning', display: 'block', mt: 0.5 }}>
          Not a number: it will be saved as text.
        </Typography>
      )}
      {original && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap' }} useFlexGap>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Extracted:{' '}
            <Box component="span" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {formatDisplayValue(original.value) || 'no value'} {original.unit ?? ''}
            </Box>
          </Typography>
          <Button
            size="small"
            startIcon={<UndoIcon fontSize="small" />}
            disabled={disabled || !canRevert(field)}
            onClick={() => {
              setDraft(null);
              handlers.onRevert(field.id);
            }}
            sx={{ py: 0, minHeight: 0 }}
          >
            Revert
          </Button>
        </Stack>
      )}
      <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.5 }}>
        Edits stay on this screen until Save. Editing marks the value as changed by a person.
      </Typography>
    </Box>
  );
}

/**
 * Accept, flag with a reason, flag and re-extract, re-extract, remove flag
 * (step 10). A parameter with no AI candidate cannot be flagged by any
 * current route (B9), so its flag controls are disabled with the reason.
 */
function ReviewActions({
  field,
  busy,
  accepted,
  handlers,
}: {
  field: InputField;
  busy: RowBusy | null;
  accepted: boolean;
  handlers: ParameterRowHandlers;
}) {
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const locked = !!busy;
  const correcting = busy?.kind === 'queued' || busy?.kind === 'correcting';
  const approved = field.reviewAction === 'ACCEPTED';
  const candidateId = field.specifications.find((s) => s.id === field.selectedSpecId)?.candidateId ?? null;
  const flaggable = !!candidateId;
  const text = reason.trim();

  return (
    <Box component="section" aria-label="Review">
      <SectionLabel>Review</SectionLabel>

      {correcting && (
        <Note tone="info" icon={busy?.kind === 'queued' ? <HourglassEmptyIcon sx={{ fontSize: 16 }} /> : <CircularProgress size={14} thickness={5} color="inherit" />}>
          {busy?.kind === 'queued'
            ? 'Queued for re-extraction. It starts when a slot is free; corrections go first.'
            : `Re-extracting this parameter${busy?.kind === 'correcting' && busy.phase ? ` (${busy.phase})` : ''}. The rest of the project stays usable.`}
        </Note>
      )}

      {field.isFlagged ? (
        <Stack spacing={1.25}>
          <Note tone="danger" icon={<FlagIcon sx={{ fontSize: 16 }} />}>
            <strong>Flagged by a reviewer.</strong> {field.flagReason ? `“${field.flagReason}”` : 'No reason recorded.'}
          </Note>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Tooltip title="Resolves the flag with the value shown above and saves this row">
              <span>
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  startIcon={<DoneIcon fontSize="small" />}
                  disabled={locked}
                  loading={busy?.kind === 'accept'}
                  loadingPosition="start"
                  onClick={() => handlers.onAccept(field.id)}
                >
                  Accept value and resolve flag
                </Button>
              </span>
            </Tooltip>
            <Button size="small" color="error" disabled={locked} loading={busy?.kind === 'unflag'} onClick={() => handlers.onRemoveFlag(field.id)}>
              Remove flag
            </Button>
          </Stack>
          <TextField
            id={reasonId}
            size="small"
            fullWidth
            label="Hint for re-extraction (optional)"
            placeholder={field.flagReason ?? 'e.g. use the table on page 4'}
            value={reason}
            disabled={locked}
            onChange={(e) => setReason(e.target.value)}
          />
          <Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplayIcon fontSize="small" />}
              disabled={locked}
              loading={correcting}
              loadingPosition="start"
              onClick={() => {
                handlers.onReextract(field.id, reason);
                setReason('');
              }}
            >
              Re-extract this parameter
            </Button>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }} useFlexGap>
            {accepted || approved ? (
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'status.success' }} role="status">
                <DoneAllIcon sx={{ fontSize: 18 }} aria-hidden />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{approved ? 'Approved' : 'Accepted'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {approved ? 'Accepted by Approve. Saving this row returns it to pending.' : 'Value saved. Marked for this session; Approve records it.'}
                </Typography>
              </Stack>
            ) : (
              <Tooltip title="Saves this row’s value now and marks it accepted for this session. Approve records acceptance for the whole project.">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<DoneIcon fontSize="small" />}
                    disabled={locked}
                    loading={busy?.kind === 'accept'}
                    loadingPosition="start"
                    onClick={() => handlers.onAccept(field.id)}
                  >
                    Accept
                  </Button>
                </span>
              </Tooltip>
            )}
          </Stack>

          <TextField
            id={reasonId}
            size="small"
            fullWidth
            required
            label="Reason for the flag"
            placeholder="e.g. wrong table, value is for the module, check page 4"
            value={reason}
            disabled={locked || !flaggable}
            onChange={(e) => setReason(e.target.value)}
            helperText={
              flaggable
                ? 'Tells the next reviewer, and the re-extraction, what is wrong.'
                : 'This parameter has no extracted candidate, so it cannot be flagged yet (backend B9). Run Analyze first.'
            }
          />
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FlagOutlinedIcon fontSize="small" />}
              disabled={locked || !flaggable || !text}
              loading={busy?.kind === 'flag'}
              loadingPosition="start"
              onClick={() => {
                handlers.onFlag(field.id, text);
                setReason('');
              }}
            >
              Flag
            </Button>
            <Tooltip title="Flags the value, then extracts this parameter again with your reason as a hint. Costs one model run.">
              <span>
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  startIcon={<ReplayIcon fontSize="small" />}
                  disabled={locked || !flaggable || !text}
                  onClick={() => {
                    handlers.onFlagAndReextract(field.id, text);
                    setReason('');
                  }}
                >
                  Flag and re-extract
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function Note({ tone, icon, children }: { tone: 'info' | 'danger'; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={{
        px: 1.25, py: 0.75, mb: 1.25, borderRadius: 1,
        bgcolor: tone === 'danger' ? 'status.dangerBg' : 'status.infoBg',
        color: tone === 'danger' ? 'status.danger' : 'status.info',
      }}
    >
      <Box sx={{ display: 'flex', pt: 0.25 }} aria-hidden>{icon}</Box>
      <Typography variant="body2" sx={{ color: 'text.primary' }}>{children}</Typography>
    </Stack>
  );
}

/**
 * Every candidate for the row. Choosing one is local until Save; each
 * alternative can show its own "Why" (AM15) without being chosen.
 */
function CandidateList({
  field,
  selectedId,
  onSelect,
  onJump,
  where,
  documentName,
  disabled,
}: {
  field: InputField;
  selectedId: string | undefined;
  onSelect: (specId: string) => void;
  onJump: (source: SpecificationSource) => void;
  where: (s: Specification) => string | null;
  documentName: (documentId: string | null | undefined) => string | null;
  disabled: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const baseId = useId();

  if (field.specifications.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.muted' }}>
        No candidates yet. Run Analyze to extract this parameter.
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5} role="radiogroup" aria-label={`Candidates for ${field.id}`}>
      {field.specifications.map((s: Specification) => {
        const selected = s.id === selectedId;
        const valued = hasValue(s);
        const reason = valued ? null : matchReasonCode(s.extractionLogic);
        const at = where(s);
        const isOpen = open.has(s.id);
        const panelId = `${baseId}-${s.id}`;
        return (
          <Box
            key={s.id}
            sx={{
              borderRadius: 1,
              border: 1,
              borderColor: selected ? 'accent.fill' : 'border.subtle',
              bgcolor: selected ? 'accent.tint' : 'surface.panel',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.5 }}>
              <Button
                role="radio"
                aria-checked={selected}
                size="small"
                disabled={disabled || selected || !valued}
                onClick={() => onSelect(s.id)}
                startIcon={selected ? <CheckIcon fontSize="small" /> : undefined}
                sx={{ minWidth: 0, justifyContent: 'flex-start', flex: 1, color: 'text.primary', textAlign: 'left', '&.Mui-disabled': { color: 'text.primary' } }}
              >
                {valued ? (
                  <ValueCell parameterKey={field.id} spec={s} />
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.muted' }}>
                    No value{reason ? ` · ${reason.label}` : ''}
                  </Typography>
                )}
              </Button>
              {valued && <ConfidenceIndicator confidence={s.confidence} human={!s.candidateId || !!s.original} />}
              {at && (
                <Typography variant="caption" sx={{ color: 'text.muted', whiteSpace: 'nowrap' }}>
                  {at}
                </Typography>
              )}
              {hasLocation(s.source) && s.source && (
                <Tooltip title="Show in document">
                  <IconButton size="small" aria-label="Show this candidate in the document" onClick={() => onJump(s.source!)}>
                    <FindInPageOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {!selected && (
                <Tooltip title={isOpen ? 'Hide why' : 'Why this candidate'}>
                  <IconButton
                    size="small"
                    aria-label={`Why this candidate${valued ? ` (${formatDisplayValue(s.value)})` : ''}`}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() =>
                      setOpen((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                  >
                    <ExpandMoreIcon
                      fontSize="small"
                      sx={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shortest }) }}
                    />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            {!selected && (
              <Collapse in={isOpen} unmountOnExit timeout={160}>
                <Box id={panelId} sx={{ px: 1.5, pb: 1.25, pt: 0.25, borderTop: 1, borderColor: 'border.subtle' }}>
                  <WhyThisValue
                    dense
                    spec={s}
                    location={at}
                    documentName={documentName(s.source?.documentId)}
                    onJump={hasLocation(s.source) && s.source ? () => onJump(s.source!) : undefined}
                  />
                </Box>
              </Collapse>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
