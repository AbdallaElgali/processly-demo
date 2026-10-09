'use client';

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { Specification } from '@/types';
import { formatDisplayValue } from '@/lib/review/format';
import { currentBasis, isDischargeCurrent, unitDiffers } from '@/lib/review/domain';

const DISCHARGE_SIGN_HELP =
  'Discharge currents are negative by convention: current flowing out of the cell. The sign is intentional; do not remove it.';

/**
 * A parameter's value as displayed (CLAUDE.md 7, AM10):
 * - rounded for display only, tabular numerals;
 * - the unit exactly as extracted, plus "expected X" when it differs, never converted;
 * - C-rate vs absolute current as distinct marks;
 * - a sign note on I_MAX_DCH_* keys.
 */
export function ValueCell({ parameterKey, spec }: { parameterKey: string; spec: Specification | undefined }) {
  const raw = spec?.value ?? '';
  const shown = formatDisplayValue(raw);
  if (!shown) {
    return <Typography variant="body2" sx={{ color: 'text.muted' }}>—</Typography>;
  }

  const unit = spec?.unit?.trim() ?? '';
  const basis = currentBasis(unit, raw);
  const expected = spec?.expectedUnit ?? null;
  const differs = unitDiffers(unit, expected);
  const discharge = isDischargeCurrent(parameterKey);
  const rounded = shown !== String(raw).trim();

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Tooltip title={rounded ? `Stored value: ${raw}` : ''}>
        <Typography
          variant="body2"
          sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap' }}
        >
          {shown}
          {unit && (
            <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 0.5 }}>
              {unit}
            </Box>
          )}
        </Typography>
      </Tooltip>

      {basis === 'c-rate' && (
        <Tooltip title="A C-rate: a multiple of the nominal capacity, not an absolute current">
          <Box component="span" sx={markSx('status.info', 'status.infoBg')}>C-rate</Box>
        </Tooltip>
      )}
      {basis === 'absolute' && (
        <Tooltip title="An absolute current (amperes), not a C-rate">
          <Box component="span" sx={markSx('text.secondary', 'surface.sunken')}>abs</Box>
        </Tooltip>
      )}
      {differs && (
        <Tooltip title={`Shown as extracted (${unit}). The dictionary expects ${expected}; nothing was converted.`}>
          <Box component="span" sx={markSx('status.warning', 'status.warningBg')}>expected {expected}</Box>
        </Tooltip>
      )}
      {discharge && (
        <Tooltip title={DISCHARGE_SIGN_HELP}>
          <InfoOutlinedIcon aria-label="About the discharge sign" sx={{ fontSize: 15, color: 'text.muted' }} />
        </Tooltip>
      )}
    </Stack>
  );
}

const markSx = (fg: string, bg: string) => ({
  px: 0.5,
  borderRadius: 0.5,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '16px',
  color: fg,
  bgcolor: bg,
  whiteSpace: 'nowrap',
});
