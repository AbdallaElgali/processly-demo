'use client';

import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import type { RowState, SecondaryFact } from '@/lib/review/rowState';
import { CONFIDENCE_HIGH } from '@/lib/review/confidence';
import { qualifierTags } from '@/lib/review/domain';

/**
 * Small visual vocabulary for the parameter table. Every state is an icon
 * PLUS a label, never colour alone (CLAUDE.md 8.3), and only palette tokens
 * are used, so both modes come from the theme.
 */

const chipSx = (fg: string, bg: string) => ({
  height: 22,
  fontSize: 12,
  fontWeight: 600,
  color: fg,
  bgcolor: bg,
  '& .MuiChip-icon': { color: fg, fontSize: 15, ml: 0.5 },
});

/** Qualifier tags, derived from the parameter key (the backend has no qualifier field). */
export function QualifierTags({ parameterKey }: { parameterKey: string }) {
  const tags = qualifierTags(parameterKey);
  if (tags.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
      {tags.map((tag) => (
        <Tooltip key={tag} title="Qualifier, derived from the parameter key">
          <Box
            component="span"
            sx={{
              px: 0.5,
              borderRadius: 0.5,
              border: 1,
              borderColor: 'border.strong',
              color: 'text.secondary',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.04em',
              lineHeight: '16px',
            }}
          >
            {tag}
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}

/** Percent plus a High/Low word; "—" for a human value, which has no confidence. */
export function ConfidenceIndicator({ confidence, human }: { confidence: number | null | undefined; human?: boolean }) {
  if (human || confidence === null || confidence === undefined) {
    return (
      <Tooltip title={human ? 'Entered by a person; no model confidence' : 'No confidence recorded'}>
        <Typography variant="caption" sx={{ color: 'text.muted' }}>—</Typography>
      </Tooltip>
    );
  }
  const high = confidence >= CONFIDENCE_HIGH;
  return (
    <Tooltip title={`${high ? 'High' : 'Low'} confidence (threshold ${CONFIDENCE_HIGH}%)`}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        <Box
          sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: high ? 'status.success' : 'status.warning',
          }}
        />
        <Typography variant="caption" sx={{ color: high ? 'text.secondary' : 'status.warning', fontWeight: high ? 400 : 600 }}>
          {Math.round(confidence)}% {high ? 'High' : 'Low'}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

/**
 * The row's ONE primary state (AM1). Auto-flag ("Bounds", amber triangle) and
 * human flag (red flag) differ in hue AND icon (RFC 4.1, CLAUDE.md 7).
 */
export function StateBadge({ state, flagReason }: { state: RowState; flagReason?: string | null }) {
  switch (state.primary) {
    case 'human_flag':
      return (
        <Tooltip title={flagReason ? `Flagged by a reviewer: ${flagReason}` : 'Flagged by a reviewer'}>
          <Chip size="small" icon={<FlagIcon />} label="Flagged" sx={chipSx('status.danger', 'status.dangerBg')} />
        </Tooltip>
      );
    case 'bounds':
      return (
        <Tooltip title={`Raised automatically: ${(state.selected?.rule_violations ?? []).join('; ') || 'out of bounds'}`}>
          <Chip size="small" icon={<WarningAmberIcon />} label="Bounds" sx={chipSx('status.warning', 'status.warningBg')} />
        </Tooltip>
      );
    case 'empty':
      if (state.emptyKind === 'cleared') {
        return (
          <Tooltip title="The value was removed by a reviewer. The AI candidates are still listed as alternatives.">
            <Chip size="small" icon={<EditOutlinedIcon />} label={state.secondary.includes('accepted') ? 'Cleared' : 'Edited'} sx={chipSx('status.modified', 'surface.sunken')} />
          </Tooltip>
        );
      }
      return state.reason ? (
        <Tooltip title={state.reason.text}>
          <Chip size="small" icon={<RemoveCircleOutlineIcon />} label={state.reason.label} sx={chipSx('status.neutral', 'status.neutralBg')} />
        </Tooltip>
      ) : (
        <Tooltip title={state.selected?.extractionLogic ? `Recorded text: ${state.selected.extractionLogic}` : 'The run left no value and no reason code for this parameter.'}>
          <Chip size="small" icon={<RemoveCircleOutlineIcon />} label="No value · reason not recorded" sx={chipSx('status.neutral', 'status.neutralBg')} />
        </Tooltip>
      );
    case 'no_run':
      return (
        <Tooltip title="No extraction has produced a candidate for this parameter yet. (Shown by the app; not a backend reason code.)">
          <Chip size="small" icon={<HourglassEmptyIcon />} label="Not extracted yet" variant="outlined" sx={{ ...chipSx('status.neutral', 'transparent'), borderColor: 'border.strong' }} />
        </Tooltip>
      );
    case 'modified':
      return (
        <Tooltip title="Value edited by a person">
          <Chip size="small" icon={<EditOutlinedIcon />} label="Edited" sx={chipSx('status.modified', 'surface.sunken')} />
        </Tooltip>
      );
    case 'needs_review':
      return (
        <Tooltip
          title={[
            state.lowConfidence && `Confidence below ${CONFIDENCE_HIGH}%`,
            state.supervisorReview && 'The checking model marked this value as uncertain',
          ].filter(Boolean).join(' · ')}
        >
          <Chip size="small" icon={<HelpOutlineIcon />} label="Review" sx={chipSx('status.warning', 'status.warningBg')} />
        </Tooltip>
      );
    case 'high':
      return (
        <Chip size="small" icon={<CheckCircleOutlineIcon />} label="OK" variant="outlined" sx={{ ...chipSx('status.success', 'transparent'), borderColor: 'border.subtle' }} />
      );
  }
}

const SECONDARY_META: Record<SecondaryFact, { Icon: typeof FlagIcon; label: string; color: string }> = {
  bounds: { Icon: WarningAmberIcon, label: 'Also out of bounds (auto-flag)', color: 'status.warning' },
  modified: { Icon: EditOutlinedIcon, label: 'Also edited by a person', color: 'status.modified' },
  low_confidence: { Icon: HelpOutlineIcon, label: `Also below ${CONFIDENCE_HIGH}% confidence`, color: 'status.warning' },
  needs_review: { Icon: HelpOutlineIcon, label: 'Also marked uncertain by the checking model', color: 'status.warning' },
  accepted: { Icon: DoneAllIcon, label: 'Accepted', color: 'status.success' },
  newer_candidate: { Icon: NewReleasesOutlinedIcon, label: 'Newer AI candidate available', color: 'status.info' },
};

/** Small icons for facts that hold alongside the primary state (AM1). */
export function SecondaryFacts({ facts }: { facts: SecondaryFact[] }) {
  if (facts.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.25}>
      {facts.map((f) => {
        const meta = SECONDARY_META[f];
        const { Icon, color } = meta;
        const label = meta.label;
        return (
          <Tooltip key={f} title={label}>
            <Icon aria-label={label} sx={{ fontSize: 15, color }} />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
