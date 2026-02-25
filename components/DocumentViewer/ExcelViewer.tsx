'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  CircularProgress, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead,
  TableRow, 
  Paper,
  Typography,
  Tabs,
  Tab
} from '@mui/material';
import * as XLSX from 'xlsx';
import { colors } from '@/theme/colors';

interface ExcelViewerProps {
  excelDocument: string;
  activeHighlight?: any;
}

// Helper: Converts 0-indexed number to Excel column letters (0 -> A, 1 -> B, 26 -> AA)
const getColumnLetter = (colIndex: number) => {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export const ExcelViewer = ({ excelDocument, activeHighlight }: ExcelViewerProps) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch and parse the entire workbook once
  useEffect(() => {
    const parseExcel = async () => {
      try {
        setLoading(true);
        const response = await fetch(excelDocument);
        const arrayBuffer = await response.arrayBuffer();
        
        // Use Uint8Array for safer binary parsing (fixes many .xlsm issues)
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        setWorkbook(wb);
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        setError('Failed to load spreadsheet data.');
      } finally {
        setLoading(false);
      }
    };

    if (excelDocument) {
      parseExcel();
    }
  }, [excelDocument]);

  // 2. Extract and normalize data for the currently active sheet
  const { sheetData, colHeaders } = useMemo(() => {
    if (!workbook || !activeSheet) return { sheetData: [], colHeaders: [] };

    const worksheet = workbook.Sheets[activeSheet];
    if (!worksheet) return { sheetData: [], colHeaders: [] };

    // header: 1 creates a 2D array. defval: '' ensures empty cells aren't dropped
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

    // Find the longest row to create a uniform grid (Excel style)
    let maxCols = 0;
    jsonData.forEach(row => {
      if (row.length > maxCols) maxCols = row.length;
    });

    // Generate [A, B, C, D...] headers
    const headers = Array.from({ length: maxCols }, (_, i) => getColumnLetter(i));

    // Pad shorter rows so every row has the same number of cells
    const normalizedData = jsonData.map(row => {
      const paddedRow = [...row];
      while (paddedRow.length < maxCols) {
        paddedRow.push('');
      }
      return paddedRow;
    });

    return { sheetData: normalizedData, colHeaders: headers };
  }, [workbook, activeSheet]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveSheet(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', bgcolor: colors.surface }}>
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    );
  }

  if (error) {
    return <Typography color="error" sx={{ p: 3 }}>{error}</Typography>;
  }

  return (
    <Box sx={{ height: '100%', width: '100%', bgcolor: colors.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* EXCEL GRID */}
      <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', bgcolor: colors.surface, borderRadius: 0 }}>
        <Table stickyHeader size="small" sx={{ minWidth: 'max-content', borderCollapse: 'collapse' }}>
          
          <TableHead>
            <TableRow>
              {/* Top-Left Empty Corner Cell */}
              <TableCell 
                sx={{ 
                  bgcolor: 'action.hover', 
                  borderRight: `1px solid ${colors.border}`,
                  borderBottom: `2px solid ${colors.border}`,
                  position: 'sticky',
                  left: 0,
                  zIndex: 3 // Highest z-index for the corner
                }} 
              />
              {/* Column Letters (A, B, C...) */}
              {colHeaders.map((header, index) => (
                <TableCell 
                  key={index}
                  align="center"
                  sx={{ 
                    bgcolor: 'action.hover', 
                    color: 'text.secondary', 
                    fontWeight: 'bold',
                    borderRight: `1px solid ${colors.border}`,
                    borderBottom: `2px solid ${colors.border}`,
                    minWidth: 80,
                  }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {sheetData.map((row, rowIndex) => (
              <TableRow key={rowIndex} hover>
                {/* Row Numbers (1, 2, 3...) - Sticky Left */}
                <TableCell 
                  sx={{ 
                    bgcolor: 'action.hover', 
                    color: 'text.secondary', 
                    fontWeight: 'bold', 
                    borderRight: `2px solid ${colors.border}`,
                    borderBottom: `1px solid ${colors.border}`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    textAlign: 'center',
                    minWidth: 50
                  }}
                >
                  {rowIndex + 1}
                </TableCell>
                
                {/* Cell Data */}
                {row.map((cell, colIndex) => (
                  <TableCell 
                    key={colIndex} 
                    sx={{ 
                      borderRight: `1px solid ${colors.border}`,
                      borderBottom: `1px solid ${colors.border}`,
                      color: 'text.primary',
                      whiteSpace: 'nowrap',
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={String(cell)} // Show full text on hover
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* EXCEL SHEET TABS */}
      {workbook && workbook.SheetNames.length > 1 && (
        <Box sx={{ borderTop: `1px solid ${colors.border}`, bgcolor: 'background.paper' }}>
          <Tabs 
            value={activeSheet} 
            onChange={handleTabChange} 
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 40 }}
          >
            {workbook.SheetNames.map(sheet => (
              <Tab 
                key={sheet} 
                label={sheet} 
                value={sheet} 
                sx={{ 
                  minHeight: 40, 
                  textTransform: 'none', 
                  fontWeight: activeSheet === sheet ? 'bold' : 'normal',
                  borderRight: `1px solid ${colors.border}`
                }} 
              />
            ))}
          </Tabs>
        </Box>
      )}
    </Box>
  );
};