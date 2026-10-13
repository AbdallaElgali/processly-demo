'use client';

import { useRef, useState } from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';

/**
 * The backend analyser handles PDF and Excel only (CLAUDE.md §6.3); `.doc`,
 * `.docx`, `.jpg` and `.png` are deliberately not offered.
 */
const ACCEPT = '.pdf,.xlsx,.xlsm';

/**
 * Large dashed drop target (plan §2). Never disabled by other projects' work
 * or by this browser's job cap -- at the cap the upload is still accepted and
 * queues, so `queuedHint` explains that instead of the control refusing input
 * (CLAUDE.md 8.1).
 */
export function Dropzone({
  onFiles,
  queuedHint = false,
  sx,
}: {
  onFiles: (files: File[]) => void;
  queuedHint?: boolean;
  /** Layout overrides, e.g. filling an empty Workspace (AM11). */
  sx?: SxProps<Theme>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="Upload documents"
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      sx={{
        border: '2px dashed',
        borderColor: dragOver ? 'accent.fill' : 'border.strong',
        borderRadius: 2,
        bgcolor: dragOver ? 'accent.tint' : 'surface.panel',
        p: 5,
        textAlign: 'center',
        cursor: 'pointer',
        transition: (t) => t.transitions.create(['border-color', 'background-color']),
        '&:hover': { borderColor: 'accent.fill', bgcolor: 'surface.hover' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'accent.focus',
          outlineOffset: 2,
        },
        ...(sx as object),
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: 'text.muted' }} />
      <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 600, mt: 1 }}>
        Drop documents here, or click to choose files
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.muted', display: 'block', mt: 0.5 }}>
        PDF and Excel (.xlsx, .xlsm)
      </Typography>
      {queuedHint && (
        <Typography variant="caption" sx={{ color: 'status.info', display: 'block', mt: 1.5 }}>
          This browser is busy with other work — the upload will be queued and start automatically.
        </Typography>
      )}
    </Box>
  );
}
