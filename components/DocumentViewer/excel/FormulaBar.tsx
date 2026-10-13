'use client';

import { useState } from 'react';
import { Box, IconButton, InputBase, Tooltip, Typography } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { cellRef, parseRef, type CellPos } from '@/lib/excel/address';
import type { SheetCell } from '@/lib/excel/workbook';

const inputSx = {
  height: 26,
  fontSize: 13,
  color: 'text.primary',
  bgcolor: 'surface.raised',
  border: 1,
  borderColor: 'border.interactive',
  borderRadius: 0.5,
  px: 0.75,
  transition: 'border-color 120ms',
  '&:hover': { borderColor: 'text.secondary' },
  '&.Mui-focused': { borderColor: 'accent.focus', outline: '1px solid', outlineColor: 'accent.focus' },
} as const;

/**
 * Excel's name box and formula bar (AM16). The name box shows the selected
 * cell and accepts a typed reference (C12) to jump there. The value bar shows
 * what the cell displays; when the workbook stores a formula, its text is
 * shown beside it. Nothing is ever evaluated: values are the ones Excel cached.
 */
export function FormulaBar({
  selection,
  cell,
  merged,
  onJump,
  fullscreen,
  onToggleFullscreen,
  disabled = false,
}: {
  /** A chart sheet has no cells: the name box and value bar are empty and disabled. */
  disabled?: boolean;
  selection: CellPos;
  cell: SheetCell | undefined;
  /** The selected cell is the top-left of a merge spanning this range. */
  merged: string | null;
  onJump: (pos: CellPos) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown = disabled ? '' : cellRef(selection);
  const value = disabled ? '' : cell?.text ?? '';
  const formula = cell?.formula ? `=${cell.formula}` : null;

  const commit = () => {
    if (draft === null) return;
    const pos = parseRef(draft);
    if (!pos) {
      setInvalid(true);
      return;
    }
    setDraft(null);
    setInvalid(false);
    onJump(pos);
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, flexShrink: 0,
        bgcolor: 'surface.panel', borderBottom: 1, borderColor: 'border.subtle', minWidth: 0,
      }}
    >
      <Tooltip title={invalid ? 'Type a cell reference such as C12' : merged ? `Merged cell ${merged}` : 'Selected cell. Type a reference such as C12 and press Enter to go there.'}>
        <InputBase
          disabled={disabled}
          value={draft ?? shown}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            setDraft(null);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(null);
              setInvalid(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          inputProps={{ 'aria-label': 'Name box: selected cell', 'aria-invalid': invalid, spellCheck: false }}
          sx={{
            ...inputSx,
            width: 88,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
            ...(invalid && { borderColor: 'status.danger', '&.Mui-focused': { borderColor: 'status.danger', outlineColor: 'status.danger' } }),
          }}
        />
      </Tooltip>
      <Typography
        component="span"
        aria-hidden
        sx={{ fontStyle: 'italic', fontFamily: 'Georgia, "Times New Roman", serif', color: 'text.secondary', fontSize: 14, px: 0.25, flexShrink: 0 }}
      >
        fx
      </Typography>
      <InputBase
        disabled={disabled}
        value={value}
        readOnly
        inputProps={{ 'aria-label': disabled ? 'Value' : `Value of ${shown}`, title: value || undefined }}
        sx={{ ...inputSx, flex: 1, minWidth: 0 }}
      />
      {formula && (
        <Tooltip title={`Formula stored in the workbook (not recalculated): ${formula}`}>
          <Typography
            variant="body2"
            noWrap
            aria-label={`Formula ${formula}`}
            sx={{ color: 'text.secondary', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, maxWidth: '35%', minWidth: 0, flexShrink: 1 }}
          >
            {formula}
          </Typography>
        </Tooltip>
      )}
      <Tooltip title={fullscreen ? 'Exit full screen' : 'Full screen'}>
        <IconButton size="small" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={onToggleFullscreen} sx={{ color: 'text.secondary', flexShrink: 0 }}>
          {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
