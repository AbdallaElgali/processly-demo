'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  ThemeProvider, 
  CssBaseline, 
  Paper,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; // Added for a nice visual touch on the Analyze button
import { v4 as uuidv4 } from 'uuid';

import { useResizer } from '@/hooks/Resizer';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { DocumentUpload } from '@/components/document-upload';
import { InputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/LayoutHeader';
import { Sidebar } from '@/components/Sidebar';
import { DocumentRouter } from '@/components/DocumentViewer/DocumentRouter';
import LoadingSpinner from '@/components/Loading';
import { analyzeDocument } from '@/api/analyze-document';

// --- CONSTANTS & HELPERS ---
const SIDEBAR_WIDTH = 260;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

// --- MAIN COMPONENT ---
export default function App() {
  const [projectId, setProjectId] = useState(''); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Initialize Sub-Systems
  const { viewerWidth, setViewerWidth, startResizing } = useResizer(isSidebarOpen);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // 1. Global Parameter Manager (Handles the project's data schema)
  const { 
    fields, 
    handleFieldChange, 
    handleRemoveField,
    handleSwitchSpecification,
    handlePopulateExtractedData
  } = useParameterManager();
  
  // 2. Document Manager (Handles uploads, active tabs, and highlights)
  const { 
    uploadedFiles, 
    activeFileId, 
    activeDoc, 
    activeSource, 
    isLoading, 
    handleDocumentUpload, 
    handleSelectFile, 
    handleJumpToSource 
  } = useDocumentManager(projectId);

  useEffect(() => {
    setProjectId(uuidv4());
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isLoading && <LoadingSpinner />}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <LayoutHeader />

        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* SIDEBAR */}
          <Box sx={{ 
            width: isSidebarOpen ? SIDEBAR_WIDTH : 0,
            transition: 'width 0.3s ease',
            borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none',
            bgcolor: colors.surface,
            overflow: 'hidden'
          }}>
            <Sidebar 
              files={uploadedFiles} 
              currentFileId={activeFileId} 
              onSelectFile={handleSelectFile}
            />
          </Box>

          {/* MAIN PARAMETER AREA */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            <Box sx={{ p: 1, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}` }}>
              <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
              </IconButton>
              <Typography variant="body2" sx={{ ml: 1, fontWeight: 500, color: colors.textSecondary }}>
                {isSidebarOpen ? 'Minimize' : 'Expand Sidebar'}
              </Typography>
            </Box>

            <Box sx={{ 
              flex: 1, overflowY: 'auto', p: 3, msOverflowStyle: 'none', scrollbarWidth: 'none', 
              '&::-webkit-scrollbar': { display: 'none' } 
            }}>
              
              {/* UPLOAD & ANALYZE SECTION */}
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.surface, border: `1px dashed ${colors.border}`, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 0.5 }}>Upload Specification</Typography>
                
                {/* NEW: Project ID Hint */}
                <Typography variant="caption" sx={{ display: 'block', mb: 3, color: 'text.secondary', fontFamily: 'monospace' }}>
                  Project ID: {projectId || 'Initializing...'}
                </Typography>

                <DocumentUpload onUpload={handleDocumentUpload} isUploaded={!!activeFileId} />
                
                {/* NEW: Analyze Button */}
                <Button 
                  variant="contained" 
                  // UPDATE: Disable the button if there are no files, OR if it's currently analyzing
                  disabled={uploadedFiles.length === 0 || isAnalyzing}
                  startIcon={<AutoAwesomeIcon />}
                  sx={{ 
                    mt: 3, 
                    px: 4, 
                    py: 1,
                    bgcolor: colors.primary,
                    '&:hover': { bgcolor: colors.secondary },
                    '&:disabled': { bgcolor: 'action.disabledBackground' }
                  }}
                  onClick={async () => {
                    try {
                      // 1. Turn on the loading overlay
                      setIsAnalyzing(true);
                      console.log('Starting analysis for Project ID:', projectId);
                      
                      // 2. Call your backend API
                      const extractedData = await analyzeDocument(projectId);
                      
                      // 3. Push the AI data into your UI state
                      handlePopulateExtractedData(extractedData);
                      
                      console.log('Analysis complete!');
                    } catch (error) {
                      console.error('Analysis failed:', error);
                      alert('Failed to analyze the document. Please try again.');
                    } finally {
                      // 4. Turn off the loading overlay regardless of success or failure
                      setIsAnalyzing(false);
                    }
                  }}
                >
                  {/* UPDATE: Give visual feedback on the button text */}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </Button>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: colors.primary }}>
                Project Parameters ({fields.length} items)
              </Typography>

              {/* The Input fields are now globally persistent across file changes */}
              <Box>
                <InputFieldsList
                  fields={fields}
                  onFieldChange={handleFieldChange}
                  onRemoveField={handleRemoveField}
                  onShowSource={handleJumpToSource}
                  onSwitchSpecification={handleSwitchSpecification}
                />
              </Box>
            </Box>

            {/* ACTION BUTTONS */}
            <Box sx={{ 
              p: 2, borderTop: `1px solid ${colors.border}`, bgcolor: colors.surface, 
              display: 'flex', justifyContent: 'center', gap: 2 
            }}>
              <Button variant="contained" sx={{ bgcolor: '#fff', color: colors.darkTeal, px: 3, '&:hover': { bgcolor: '#f5f5f5' } }}>
                View Summary
              </Button>
              <Button variant="contained" sx={{ px: 3, '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 } }}>
                Extract Parameters
              </Button>
            </Box>
          </Box>

          {/* RESIZE HANDLE */}
          <Box
            onMouseDown={startResizing}
            onDoubleClick={() => setViewerWidth(window.innerWidth / 2)}
            sx={{
              width: '8px', cursor: 'col-resize', bgcolor: 'transparent', position: 'relative', zIndex: 10,
              '&::after': {
                content: '""', position: 'absolute', left: '3px', top: 0, bottom: 0, width: '2px',
                bgcolor: 'transparent', transition: 'background-color 0.2s',
              },
              '&:hover::after': { bgcolor: colors.primary }
            }}
          />

          {/* DOCUMENT VIEWER */}
          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#e4e4e7', minWidth: MIN_VIEWER_WIDTH }}>
            <DocumentRouter 
              fileUrl={activeDoc?.fileUrl || null} 
              fileType={activeDoc?.fileType || null} 
              activeHighlight={activeSource}
            />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}