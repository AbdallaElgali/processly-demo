'use client';

import { useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { ProjectDocument } from '@/api/types/projects';
import type { SourceNav } from '@/hooks/useDocumentWorkspace';
import { locationLabel } from './ParameterRow';

/**
 * The source the user jumped to, above the viewer (plan-A §8 "Source 1 of 2 ·
 * Page 4"). Shared by the PDF and Excel viewers, so anchor navigation and the
 * recorded source text work the same for both. N and Shift+N cycle the
 * parameter's anchors, which may be on different pages or documents (CFC).
 */
export function SourceBar({
  nav,
  documents,
  activeId,
  onCycle,
  onClose,
}: {
  nav: SourceNav;
  documents: ProjectDocument[];
  activeId: string | null;
  onCycle: (dir: 1 | -1) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const anchor = nav.anchors[nav.index];
  const source = anchor?.source;
  if (!source) return null;
  const total = nav.anchors.length;
  const docName = source.documentId ? documents.find((d) => d.id === source.documentId)?.name : null;
  const where = [locationLabel(source), docName && source.documentId !== activeId ? docName : null].filter(Boolean).join(' · ');
  const snippet = source.textSnippet?.trim();

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'border.subtle', bgcolor: 'surface.raised', px: 1.5, py: 0.5, flexShrink: 0 }} role="status" aria-live="polite">
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 32 }}>
        <FindInPageOutlinedIcon sx={{ fontSize: 18, color: 'accent.text' }} />
        <Typography variant="body2" noWrap sx={{ color: 'text.primary', fontWeight: 600, flexShrink: 1, minWidth: 0 }} title={nav.label ?? undefined}>
          {nav.label ?? 'Source'}
        </Typography>
        {where && (
          <Typography variant="body2" noWrap sx={{ color: 'text.secondary', minWidth: 0 }} title={where}>
            {where}
          </Typography>
        )}
        {!anchor.selected && nav.fieldId && (
          <Tooltip title="This location belongs to an alternative candidate, not the selected value">
            <Typography variant="caption" sx={{ px: 0.75, borderRadius: 0.5, bgcolor: 'status.neutralBg', color: 'status.neutral', whiteSpace: 'nowrap' }}>
              alternative
            </Typography>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {total > 1 && (
          <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
            <Tooltip title="Previous source (Shift+N)">
              <IconButton size="small" aria-label="Previous source" onClick={() => onCycle(-1)} sx={{ color: 'text.secondary' }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} aria-label={`Source ${nav.index + 1} of ${total}`}>
              {nav.index + 1} of {total}
            </Typography>
            <Tooltip title="Next source (N)">
              <IconButton size="small" aria-label="Next source" onClick={() => onCycle(1)} sx={{ color: 'text.secondary' }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        <Tooltip title="Clear highlight">
          <IconButton size="small" aria-label="Clear highlight" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {nav.missingDocument && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pb: 0.5, color: 'status.warning' }}>
          <WarningAmberIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption">The document this value came from is not in this project&apos;s document list, so it cannot be shown.</Typography>
        </Stack>
      )}
      {snippet && (
        <Box
          component="button"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title={expanded ? 'Show less' : 'Show the full source text'}
          sx={{
            display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, bgcolor: 'transparent', p: 0, pb: 0.5, pl: 3.25,
            font: 'inherit', fontSize: 13, fontStyle: 'italic', color: 'text.secondary',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
            maxHeight: expanded ? 160 : undefined, overflowY: expanded ? 'auto' : 'hidden',
            borderRadius: 0.5, '&:hover': { color: 'text.primary' },
          }}
        >
          “{snippet}”
        </Box>
      )}
    </Box>
  );
}
