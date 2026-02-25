'use client';

import { Box, Typography } from '@mui/material';
import { colors } from '@/theme/colors';
import { PdfViewer } from './PdfViewer';
import { ExcelViewer } from './ExcelViewer';

interface Highlight {
  pageNumber: number;
  boundingBox: [number, number, number, number];
  textSnippet?: string;
}

interface DocumentRouterProps {
  fileUrl: string | null;
  fileType: string | null; // e.g., 'application/pdf', 'application/vnd.ms-excel', etc.
  activeHighlight: Highlight | null;
}

export const DocumentRouter = ({ fileUrl, fileType, activeHighlight }: DocumentRouterProps) => {
  if (!fileUrl || !fileType) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          height: '100%', 
          alignItems: 'center', 
          justifyContent: 'center', 
          bgcolor: colors.surface // Assuming you want it to match the rest of the background
        }}
      >
        <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
          Upload a document to view
        </Typography>
      </Box>
    );
  }

  // Route: PDF
  if (fileType.includes('pdf')) {
    return <PdfViewer pdfDocument={fileUrl} activeHighlight={activeHighlight} />;
  }

  // Route: Excel (handles .xls, .xlsx, .csv)
  if (
    fileType.includes('spreadsheetml') || 
    fileType.includes('excel') || 
    fileType.includes('csv')
  ) {
    // Note: activeHighlight is passed, but you'll need a different logic inside ExcelViewer to handle it.
    return <ExcelViewer excelDocument={fileUrl} activeHighlight={activeHighlight} />;
  }

  // Fallback for unsupported types
  return (
    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: colors.surface }}>
      <Typography color="error">Unsupported file type: {fileType}</Typography>
    </Box>
  );
};