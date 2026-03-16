'use client';

import { Box, Typography } from '@mui/material';
import { colors } from '@/theme/colors';
import { PdfViewer } from './PdfViewer';
import { ExcelViewer } from './ExcelViewer';
import { PDFSource, ExcelSource } from '@/types';

interface DocumentRouterProps {
  fileUrl: string | null;
  fileType: string | null; 
  activeHighlight: any; // Relaxed type so we don't block render
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

  // Route: PDF
  if (typeString.includes('pdf')) {
    return <PdfViewer pdfDocument={fileUrl} activeHighlight={activeHighlight} />;
  }

  // Route: Excel
  if (typeString.includes('spreadsheet') || typeString.includes('excel') || typeString.includes('csv') || typeString.includes('sheet')) {
    return <ExcelViewer excelDocument={fileUrl} activeHighlight={activeHighlight} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: colors.surface }}>
      <Typography color="error">Unsupported file type: {fileType}</Typography>
    </Box>
  );
};