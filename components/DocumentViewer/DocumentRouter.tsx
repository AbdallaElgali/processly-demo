'use client';

import { memo } from 'react';
import { Box } from '@mui/material';
import { EmptyState } from '@/components/ui/EmptyState';
import { PdfViewer } from './PdfViewer';
import { ExcelViewer } from './ExcelViewer';
import type { ViewerHighlight } from './types';

interface DocumentRouterProps {
  projectId: string;
  documentId: string;
  fileUrl: string;
  mime: string;
  highlight: ViewerHighlight | null;
}

/**
 * Picks the viewer by MIME type. Each viewer is keyed by its file URL, so a
 * new file always gets a fresh viewer (and a fresh pdf.js worker document)
 * rather than inheriting the previous file's state.
 */
function DocumentRouterImpl({ projectId, documentId, fileUrl, mime, highlight }: DocumentRouterProps) {
  const type = mime.toLowerCase();

  if (type.includes('pdf')) {
    return <PdfViewer key={fileUrl} fileUrl={fileUrl} projectId={projectId} documentId={documentId} highlight={highlight} />;
  }

  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('sheet') || type.includes('csv')) {
    return <ExcelViewer key={fileUrl} excelDocument={fileUrl} activeHighlight={highlight?.source ?? null} />;
  }

  return (
    <Box sx={{ height: '100%', bgcolor: 'surface.canvas' }}>
      <EmptyState title="This file type cannot be shown" description={`The viewer shows PDF and Excel files; this one is ${mime}.`} />
    </Box>
  );
}

export const DocumentRouter = memo(DocumentRouterImpl);
