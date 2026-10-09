'use client';

import { memo, useMemo, useState } from 'react';
import {
  Badge, Box, Button, CircularProgress, Collapse, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import type { InputField, Specification, SpecificationSource } from '@/types';
import type { RowState } from '@/lib/review/rowState';
import { hasValue } from '@/lib/review/rowState';
import { matchReasonCode } from '@/lib/review/reasonCodes';
import { formatDisplayValue } from '@/lib/review/format';
import { fieldAnchors } from '@/lib/review/anchors';
import { ConfidenceIndicator, QualifierTags, SecondaryFacts, StateBadge } from './indicators';
import { ValueCell } from './ValueCell';
import type { Density } from '@/components/ui/DensityToggle';

export interface ParameterRowHandlers {
  onToggle: (fieldId: string) => void;
  onFocusRow: (fieldId: string) => void;
  /** `fieldId` lets the viewer offer the parameter's other anchors (1 of N). */
  onJumpToSource: (source: SpecificationSource, fieldId?: string) => void;
  onSelectCandidate: (fieldId: string, specId: string) => void;
  onEdit: (fieldId: string, value: string, unit: string) => void;
  onFlag: (fieldId: string, flagged: boolean, reason?: string | null) => void;
  onFlagAndRetry: (fieldId: string, reason: string) => void;
}

/** Shared column template, so headers (none today) and rows can never drift. */
export const ROW_COLUMNS = '28px minmax(180px, 1.6fr) minmax(130px, 1.1fr) 112px minmax(132px, 1fr) 36px';

const hasLocation = (s: SpecificationSource | null | undefined) =>
  !!s && (s.pageNumber !== null || s.boundingBox !== null || s.cellCoordinates !== null || !!s.documentId);

function columnLetters(col: number): string {
  let n = col;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** "Page 4", "Sheet Data · C12", or null; the backend writes {-1,-1} for an unresolved cell. */
export function locationLabel(s: SpecificationSource | null | undefined): string | null {
  if (!s) return null;
  const cell = s.cellCoordinates;
  if (cell && cell.row > 0 && cell.column > 0) {
    return `${s.tableName ? `${s.tableName} · ` : ''}${columnLetters(cell.column)}${cell.row}`;
  }
  if (s.pageNumber !== null && s.pageNumber !== undefined) return `${s.tableName ? `${s.tableName} · ` : 'Page '}${s.pageNumber}`;
  return null;
}

/**
 * One parameter (plan-A 6.4). The collapsed row is read-only and scannable;
 * the detail holds candidates, editing and flagging. Step 10 replaces the
 * flag form with the FlagDrawer and adds "Why this value" (AM15).
 */
function ParameterRowImpl({
  field,
  state,
  expanded,
  focused,
  correcting,
  correctionPhase,
  density,
  handlers,
}: {
  field: InputField;
  state: RowState;
  expanded: boolean;
  focused: boolean;
  correcting: boolean;
  correctionPhase?: string;
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
    >
      <Box
        role="button"
        data-row-key={field.id}
        tabIndex={focused ? 0 : -1}
        aria-expanded={expanded}
        aria-label={`${label}: ${formatDisplayValue(spec?.value) || 'no value'}`}
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
          <ValueCell parameterKey={field.id} spec={spec} />
          {correcting && (
            <Tooltip title={`Re-extracting this parameter${correctionPhase ? ` (${correctionPhase})` : ''}`}>
              <CircularProgress size={14} thickness={5} aria-label="Re-extracting" />
            </Tooltip>
          )}
        </Stack>

        <Box data-col="confidence">
          {hasValue(spec) && <ConfidenceIndicator confidence={spec?.confidence} human={!spec?.candidateId} />}
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <StateBadge state={state} flagReason={field.flagReason} />
          <SecondaryFacts facts={state.secondary} />
        </Stack>

        <Box onClick={(e) => e.stopPropagation()}>
          {canJump && source && (
            <Tooltip title={anchorCount > 1 ? `Show in document (S) · ${anchorCount} sources, N cycles` : 'Show in document (S)'}>
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
        <RowDetail field={field} state={state} correcting={correcting} handlers={handlers} />
      </Collapse>
    </Box>
  );
}

export const ParameterRow = memo(ParameterRowImpl);

function RowDetail({
  field,
  state,
  correcting,
  handlers,
}: {
  field: InputField;
  state: RowState;
  correcting: boolean;
  handlers: ParameterRowHandlers;
}) {
  const selectedId = state.selected?.id;
  // AM10: the input shows the rounded value; only an actual keystroke writes,
  // so an untouched row saves back exactly what was loaded.
  const [draft, setDraft] = useState<{ value: string; unit: string } | null>(null);
  const [reason, setReason] = useState(field.flagReason ?? '');
  const shownValue = draft?.value ?? formatDisplayValue(state.selected?.value);
  const shownUnit = draft?.unit ?? state.selected?.unit ?? '';

  const commit = (value: string, unit: string) => {
    setDraft({ value, unit });
    handlers.onEdit(field.id, value, unit);
  };

  return (
    <Box
      sx={{
        pl: 6, pr: 2, pb: 2, pt: 0.5, display: 'grid', gap: 2, gridTemplateColumns: '1fr',
        // Follows the table pane's width, not the window's (the pane is resizable).
        '@container (min-width: 760px)': { gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' },
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Box>
        <SectionLabel>Candidates</SectionLabel>
        <CandidateList
          field={field}
          selectedId={selectedId}
          onSelect={(specId) => handlers.onSelectCandidate(field.id, specId)}
          onJump={(src) => handlers.onJumpToSource(src, field.id)}
          disabled={correcting}
        />
        {state.selected?.source?.textSnippet && (
          <Box sx={{ mt: 1.5 }}>
            <SectionLabel>Source text</SectionLabel>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontStyle: 'italic', borderLeft: 2, borderColor: 'border.strong', pl: 1.5, whiteSpace: 'pre-wrap' }}
            >
              {state.selected.source.textSnippet}
            </Typography>
          </Box>
        )}
      </Box>

      <Stack spacing={2}>
        <Box>
          <SectionLabel>Value</SectionLabel>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Value"
              value={shownValue}
              disabled={correcting}
              onChange={(e) => commit(e.target.value, shownUnit)}
              onBlur={() => setDraft(null)}
              slotProps={{ htmlInput: { inputMode: 'decimal', style: { fontVariantNumeric: 'tabular-nums' } } }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Unit"
              value={shownUnit}
              disabled={correcting}
              onChange={(e) => commit(draft?.value ?? state.selected?.value ?? '', e.target.value)}
              onBlur={() => setDraft(null)}
              sx={{ width: 96 }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.5 }}>
            Editing marks the row as changed by a person. Saved with Save.
          </Typography>
        </Box>

        <Box>
          <SectionLabel>Flag for review</SectionLabel>
          <TextField
            size="small"
            fullWidth
            placeholder="Reason (e.g. wrong table, check page 4)"
            value={reason}
            disabled={correcting}
            onChange={(e) => setReason(e.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
            <Button size="small" variant="outlined" disabled={correcting} onClick={() => handlers.onFlag(field.id, true, reason)}>
              {field.isFlagged ? 'Update flag' : 'Flag'}
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              disabled={correcting}
              loading={correcting}
              startIcon={<ReplayIcon fontSize="small" />}
              onClick={() => handlers.onFlagAndRetry(field.id, reason)}
            >
              Flag and re-extract
            </Button>
            {field.isFlagged && (
              <Button size="small" color="error" disabled={correcting} onClick={() => handlers.onFlag(field.id, false, '')}>
                Remove flag
              </Button>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.75, display: 'block' }}>
      {children}
    </Typography>
  );
}

/** Every candidate for the row; selecting one is a local change until Save (step 10 adds the rest). */
function CandidateList({
  field,
  selectedId,
  onSelect,
  onJump,
  disabled,
}: {
  field: InputField;
  selectedId: string | undefined;
  onSelect: (specId: string) => void;
  onJump: (source: SpecificationSource) => void;
  disabled: boolean;
}) {
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
        const where = locationLabel(s.source);
        return (
          <Stack
            key={s.id}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              border: 1,
              borderColor: selected ? 'accent.fill' : 'border.subtle',
              bgcolor: selected ? 'accent.tint' : 'surface.panel',
            }}
          >
            <Button
              role="radio"
              aria-checked={selected}
              size="small"
              disabled={disabled || selected || !valued}
              onClick={() => onSelect(s.id)}
              startIcon={selected ? <CheckIcon fontSize="small" /> : undefined}
              sx={{ minWidth: 0, justifyContent: 'flex-start', flex: 1, color: 'text.primary', textAlign: 'left' }}
            >
              {valued ? (
                <ValueCell parameterKey={field.id} spec={s} />
              ) : (
                <Typography variant="body2" sx={{ color: 'text.muted' }}>
                  No value{reason ? ` · ${reason.label}` : ''}
                </Typography>
              )}
            </Button>
            {valued && <ConfidenceIndicator confidence={s.confidence} human={!s.candidateId} />}
            {where && (
              <Typography variant="caption" sx={{ color: 'text.muted', whiteSpace: 'nowrap' }}>
                {where}
              </Typography>
            )}
            {hasLocation(s.source) && s.source && (
              <Tooltip title="Show in document">
                <IconButton size="small" aria-label="Show this candidate in the document" onClick={() => onJump(s.source!)}>
                  <FindInPageOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
