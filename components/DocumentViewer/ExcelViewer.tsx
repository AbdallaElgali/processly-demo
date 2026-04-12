'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Typography, Tabs, Tab, IconButton, Divider, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import * as XLSX from 'xlsx';
import { colors } from '@/theme/colors';
import { ActiveHighlight } from '@/types';

interface ExcelViewerProps {
  excelDocument: string;
  activeHighlight?: ActiveHighlight;
}

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
  
  // NEW: Viewport Controls
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  const highlightedCellRef = useRef<HTMLTableCellElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Parse
  useEffect(() => {
    setWorkbook(null);
    setActiveSheet('');

    const parseExcel = async () => {
      try {
        setLoading(true);
        const response = await fetch(excelDocument);
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        setWorkbook(wb);
        if (wb.SheetNames.length > 0 && !activeHighlight?.pageNumber) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Failed to load spreadsheet data.');
      } finally {
        setLoading(false);
      }
    };
    if (excelDocument) parseExcel();
  }, [excelDocument]);

  // 2. Intelligent Sheet Switching
  useEffect(() => {
    if (activeHighlight?.pageNumber !== undefined && activeHighlight?.pageNumber !== null && workbook) {
      const targetIdentifier = activeHighlight.pageNumber.toString();
      let newSheetName = null;

      if (workbook.SheetNames.includes(targetIdentifier)) {
        newSheetName = targetIdentifier; // Exact name match
      } else {
        const parsedIndex = parseInt(targetIdentifier, 10);
        if (!isNaN(parsedIndex)) {
          const zeroBasedIndex = parsedIndex > 0 ? parsedIndex - 1 : 0;
          newSheetName = workbook.SheetNames[zeroBasedIndex];
        }
      }

      if (newSheetName && newSheetName !== activeSheet) {
        setActiveSheet(newSheetName);
      }
    }
  }, [activeHighlight, workbook, activeSheet]);

  // 3. Transform Bounds into a 2D Block
  // 3. Transform Bounds into a 2D Block
  const highlightRange = useMemo(() => {
    if (!activeHighlight) return null;

    if (activeHighlight.boundingBox) {
      let x0, y0, x1, y1;
      const bbox = activeHighlight.boundingBox;
      
      if (Array.isArray(bbox)) {
        [x0, y0, x1, y1] = bbox;
      } else {
        // { x, y, width, height } payload
        x0 = bbox.x;
        y0 = bbox.y - 1;
        x1 = bbox.x + (bbox.width || 0);
        y1 = bbox.y + (bbox.height || 0);
      }

      if (x0 !== undefined && y0 !== undefined && x1 !== undefined && y1 !== undefined) {
        return {
          r1: Math.min(Math.floor(y0), Math.floor(y1)) + 1,
          r2: Math.max(Math.floor(y0), Math.floor(y1)) + 1, 
          c1: Math.min(Math.floor(x0), Math.floor(x1)) + 1,
          c2: Math.max(Math.floor(x0), Math.floor(x1)) + 1 
        };
      }
    }

    if (activeHighlight.cellCoordinates && activeHighlight.cellCoordinates.row !== -1) {
      return {
        r1: activeHighlight.cellCoordinates.row,
        r2: activeHighlight.cellCoordinates.row,
        c1: activeHighlight.cellCoordinates.column,
        c2: activeHighlight.cellCoordinates.column
      };
    }
    return null;
  }, [activeHighlight]);

  // 4. Scroll Execution
  useEffect(() => {
    if (highlightedCellRef.current && !loading) {
      const timer = setTimeout(() => {
        highlightedCellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [highlightRange, activeSheet, loading, scale]);

  // Fullscreen Logic
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const { sheetData, colHeaders } = useMemo(() => {
    if (!workbook || !activeSheet) return { sheetData: [], colHeaders: [] };
    const worksheet = workbook.Sheets[activeSheet];
    if (!worksheet) return { sheetData: [], colHeaders: [] };

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
    let maxCols = 0;
    jsonData.forEach(row => { if (row.length > maxCols) maxCols = row.length; });
    const headers = Array.from({ length: maxCols }, (_, i) => getColumnLetter(i));

    const normalizedData = jsonData.map(row => {
      const paddedRow = [...row];
      while (paddedRow.length < maxCols) paddedRow.push('');
      return paddedRow;
    });

    return { sheetData: normalizedData, colHeaders: headers };
  }, [workbook, activeSheet]);

  if (loading) return <Box sx={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center' }}><CircularProgress /></Box>;
  if (error) return <Typography color="error" sx={{ p: 3 }}>{error}</Typography>;

  return (
    <Box ref={containerRef} sx={{ height: '100%', width: '100%', bgcolor: colors.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* TOOLBAR */}
      <Box sx={{ p: 1, bgcolor: colors.surface, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <Tooltip title="Zoom Out">
          <IconButton onClick={() => setScale(p => Math.max(p - 0.2, 0.5))} size="small"><RemoveIcon /></IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: '45px', textAlign: 'center', fontWeight: 'bold' }}>{Math.round(scale * 100)}%</Typography>
        <Tooltip title="Zoom In">
          <IconButton onClick={() => setScale(p => Math.min(p + 0.2, 3.0))} size="small"><AddIcon /></IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Tooltip title="Reset Zoom">
          <IconButton onClick={() => setScale(1.0)} size="small"><RestartAltIcon /></IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton onClick={toggleFullScreen} size="small">
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* EXCEL GRID */}
      <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', bgcolor: colors.surface, borderRadius: 0 }}>
        {/* We apply CSS zoom to the table to scale the grid while keeping standard DOM behavior */}
        <Table stickyHeader size="small" sx={{ minWidth: 'max-content', borderCollapse: 'collapse', zoom: scale }}>
          
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'action.hover', borderRight: `1px solid ${colors.border}`, borderBottom: `2px solid ${colors.border}`, position: 'sticky', top: 0, left: 0, zIndex: 4 }} />
              {colHeaders.map((header, index) => {
                 const isColHighlighted = highlightRange && (index + 1) >= highlightRange.c1 && (index + 1) <= highlightRange.c2;
                 return (
                  <TableCell 
                    key={index} align="center"
                    sx={{ 
                      bgcolor: isColHighlighted ? 'rgba(25, 118, 210, 0.1)' : 'action.hover', 
                      color: isColHighlighted ? colors.primary : 'text.secondary', 
                      fontWeight: 'bold', borderRight: `1px solid ${colors.border}`, borderBottom: `2px solid ${colors.border}`, minWidth: 80,
                      position: 'sticky', top: 0, zIndex: 3
                    }}
                  >
                    {header}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {sheetData.map((row, rowIndex) => {
              const currentUIrow = rowIndex + 1;
              const isRowInHighlight = highlightRange && currentUIrow >= highlightRange.r1 && currentUIrow <= highlightRange.r2;

              return (
              <TableRow key={rowIndex} hover>
                <TableCell 
                  sx={{ 
                    bgcolor: isRowInHighlight ? 'rgba(25, 118, 210, 0.1)' : 'action.hover', 
                    color: isRowInHighlight ? colors.primary : 'text.secondary', 
                    fontWeight: 'bold', borderRight: `2px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`,
                    position: 'sticky', left: 0, zIndex: 2, textAlign: 'center', minWidth: 50
                  }}
                >
                  {currentUIrow}
                </TableCell>
                
                {row.map((cell, colIndex) => {
                  const currentUIcol = colIndex + 1;
                  const isHighlightedCell = isRowInHighlight && currentUIcol >= highlightRange.c1 && currentUIcol <= highlightRange.c2;
                  
                  const isTopLeft = highlightRange && currentUIrow === highlightRange.r1 && currentUIcol === highlightRange.c1;
                  
                  const isTopEdge = isHighlightedCell && currentUIrow === highlightRange.r1;
                  const isBottomEdge = isHighlightedCell && currentUIrow === highlightRange.r2;
                  const isLeftEdge = isHighlightedCell && currentUIcol === highlightRange.c1;
                  const isRightEdge = isHighlightedCell && currentUIcol === highlightRange.c2;

                  return (
                  <TableCell 
                    key={colIndex} 
                    ref={isTopLeft ? highlightedCellRef : null}
                    sx={{ 
                      borderRight: `1px solid ${colors.border}`,
                      borderBottom: `1px solid ${colors.border}`,
                      color: 'text.primary',
                      whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
                      
                      ...(isHighlightedCell && {
                        bgcolor: 'rgba(25, 118, 210, 0.15)',
                        color: colors.primary,
                        fontWeight: '600',
                        ...(isTopEdge && { borderTop: `2px solid ${colors.primary} !important` }),
                        ...(isBottomEdge && { borderBottom: `2px solid ${colors.primary} !important` }),
                        ...(isLeftEdge && { borderLeft: `2px solid ${colors.primary} !important` }),
                        ...(isRightEdge && { borderRight: `2px solid ${colors.primary} !important` })
                      })
                    }}
                    title={String(cell)}
                  >
                    {String(cell ?? '')}
                  </TableCell>
                )})}
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </TableContainer>

      {/* TABS */}
      {workbook && workbook.SheetNames.length > 1 && (
        <Box sx={{ borderTop: `1px solid ${colors.border}`, bgcolor: 'background.paper' }}>
          <Tabs value={activeSheet} onChange={(e, v) => setActiveSheet(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 40 }}>
            {workbook.SheetNames.map(sheet => (
              <Tab key={sheet} label={sheet} value={sheet} sx={{ minHeight: 40, textTransform: 'none', fontWeight: activeSheet === sheet ? 'bold' : 'normal', borderRight: `1px solid ${colors.border}` }} />
            ))}
          </Tabs>
        </Box>
      )}

      {/* TEXT SNIPPET BOX */}
      {activeHighlight?.textSnippet && (
        <Paper elevation={6} sx={{ p: 2, borderTop: `1px solid ${colors.border}`, bgcolor: colors.surface, zIndex: 20 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: colors.primary }}>
            <FormatQuoteIcon fontSize="small" />
            <Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
              Matched Text (Sheet: {activeSheet})
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ pl: 3.5, fontStyle: 'italic', color: 'text.secondary', borderLeft: `2px solid ${colors.border}`, ml: 0.5, py: 0.5 }}>
            &quot;{activeHighlight.textSnippet}&quot;
          </Typography>
        </Paper>
      )}

    </Box>
  );
};