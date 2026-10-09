'use client';

import { Box, Button, Divider, IconButton, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import { ZOOM_STEPS } from '@/lib/excel/config';
import type { SheetModel } from '@/lib/excel/workbook';

export interface SourceStatus {
  /** Short, e.g. "B10:D15 · 1 match". */
  text: string;
  /** The full sentence, for the tooltip and screen readers. */
  detail?: string;
  /** The source is on another sheet: offers to go there. */
  goTo?: { label: string; onClick: () => void };
}

/**
 * Excel's bottom bar (AM16): sheet tabs on the left, then what the source
 * highlight covers, then zoom. Hidden and very hidden sheets are listed (a
 * source can point into them) and marked; chart sheets are listed and marked.
 */
export function SheetBar({
  sheets,
  active,
  onSelect,
  sourceSheet,
  status,
  scale,
  onScale,
}: {
  sheets: SheetModel[];
  active: number;
  onSelect: (i: number) => void;
  /** The sheet the current source points to, marked on its tab. */
  sourceSheet: number | null;
  status: SourceStatus | null;
  scale: number;
  onScale: (s: number) => void;
}) {
  const i = ZOOM_STEPS.findIndex((z) => Math.abs(z - scale) < 0.001);
  const down = i > 0 ? ZOOM_STEPS[i - 1] : [...ZOOM_STEPS].reverse().find((z) => z < scale);
  const up = i >= 0 && i < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[i + 1] : ZOOM_STEPS.find((z) => z > scale);

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'stretch', flexShrink: 0, minHeight: 34, minWidth: 0,
        bgcolor: 'surface.panel', borderTop: 1, borderColor: 'border.subtle',
      }}
    >
      <Tabs
        value={active}
        onChange={(_, v: number) => onSelect(v)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Sheets"
        sx={{
          minHeight: 34, flex: '1 1 auto', minWidth: 120,
          '& .MuiTabs-indicator': { top: 0, bottom: 'auto', height: 2 },
          '& .MuiTabs-scrollButtons': { width: 28, color: 'text.secondary' },
        }}
      >
        {sheets.map((s, idx) => {
          const note =
            [s.kind === 'chart' ? 'Chart sheet' : null, s.hidden === 2 ? 'very hidden in the workbook' : s.hidden ? 'hidden in the workbook' : null]
              .filter(Boolean)
              .join(', ')
              .replace(/^./, (ch) => ch.toUpperCase()) || null;
          return (
            <Tab
              key={`${idx}-${s.name}`}
              value={idx}
              disableRipple
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {s.hidden ? <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} aria-hidden /> : null}
                  {s.kind === 'chart' ? <InsertChartOutlinedIcon sx={{ fontSize: 14 }} aria-hidden /> : null}
                  <span>{s.name}</span>
                  {sourceSheet === idx && <FindInPageOutlinedIcon sx={{ fontSize: 14, color: 'accent.text' }} aria-label="contains the source" />}
                </Box>
              }
              title={note ?? undefined}
              aria-label={[s.name, note, sourceSheet === idx ? 'contains the source' : null].filter(Boolean).join(', ')}
              sx={{
                minHeight: 34, minWidth: 0, px: 1.5, py: 0, textTransform: 'none', fontSize: 13,
                fontStyle: s.hidden ? 'italic' : undefined,
                color: 'text.secondary',
                borderRight: 1, borderColor: 'border.subtle',
                '&:hover': { bgcolor: 'surface.hover', color: 'text.primary' },
                '&.Mui-selected': { color: 'text.primary', fontWeight: 600, bgcolor: 'surface.raised' },
              }}
            />
          );
        })}
      </Tabs>

      {status && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, minWidth: 0, flex: '0 0 auto', maxWidth: '45%', borderLeft: 1, borderColor: 'border.subtle' }}>
          <FindInPageOutlinedIcon sx={{ fontSize: 16, color: 'accent.text', flexShrink: 0 }} aria-hidden />
          {status.goTo ? (
            <Button size="small" onClick={status.goTo.onClick} sx={{ textTransform: 'none', minWidth: 0, whiteSpace: 'nowrap', py: 0 }}>
              {status.goTo.label}
            </Button>
          ) : (
            <Tooltip title={status.detail ?? status.text}>
              <Typography variant="caption" noWrap aria-label={status.detail ?? status.text} sx={{ color: 'text.secondary', minWidth: 0 }}>
                {status.text}
              </Typography>
            </Tooltip>
          )}
        </Box>
      )}

      <Divider orientation="vertical" flexItem />
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, flexShrink: 0 }}>
        <Tooltip title="Zoom out">
          <span>
            <IconButton size="small" aria-label="Zoom out" disabled={down === undefined} onClick={() => down !== undefined && onScale(down)} sx={{ color: 'text.secondary' }}>
              <RemoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reset to 100 %">
          <Button
            size="small"
            onClick={() => onScale(1)}
            aria-label={`Zoom ${Math.round(scale * 100)} percent, reset to 100`}
            sx={{ minWidth: 48, px: 0.5, color: 'text.primary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(scale * 100)}%
          </Button>
        </Tooltip>
        <Tooltip title="Zoom in">
          <span>
            <IconButton size="small" aria-label="Zoom in" disabled={up === undefined} onClick={() => up !== undefined && onScale(up)} sx={{ color: 'text.secondary' }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
