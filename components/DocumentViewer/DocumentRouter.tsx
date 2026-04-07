'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { colors } from '@/theme/colors';
import { PdfViewer } from './PdfViewer';
import { ExcelViewer } from './ExcelViewer';

interface DocumentRouterProps {
  fileUrl: string | null;
  fileType: string | null; 
  activeHighlight: any; 
}

export const DocumentRouter = ({ fileUrl, fileType, activeHighlight }: DocumentRouterProps) => {
  if (!fileUrl || !fileType) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: colors.surface }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Upload a document to view</Typography>
      </Box>
    );
  }

  const typeString = fileType.toLowerCase();

  // THE FIX: Adding a unique 'key' based on fileUrl forces React to 
  // hard-reset the component, killing any ghost PDF workers from the previous file.
  if (typeString.includes('pdf')) {
    return (
      <PdfViewer 
        key={fileUrl} // <--- THIS PREVENTS THE sendWithPromise ERROR
        pdfDocument={fileUrl} 
        activeHighlight={activeHighlight} 
      />
    );
  }

  if (typeString.includes('spreadsheet') || typeString.includes('excel') || typeString.includes('csv') || typeString.includes('sheet')) {
    return (
      <ExcelViewer 
        key={fileUrl} // Same logic for Excel to prevent state bleed
        excelDocument={fileUrl} 
        activeHighlight={activeHighlight} 
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: colors.surface }}>
      <Typography color="error">Unsupported file type: {fileType}</Typography>
    </Box>
  );
};

export const MemoizedDocumentRouter = React.memo(DocumentRouter);