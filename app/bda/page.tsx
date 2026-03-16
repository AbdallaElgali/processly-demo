'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, ThemeProvider, CssBaseline, Paper, Typography, Button, IconButton, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; 
import LogoutIcon from '@mui/icons-material/Logout';
import { v4 as uuidv4 } from 'uuid';

import { useAuth } from '@/contexts/AuthContext';
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
import { analyzeDocument } from '@/api/analyze-document';

const SIDEBAR_WIDTH = 260;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

// Mock function to simulate fetching user projects
const fetchUserProjects = async (username: string) => {
  return [
    { id: uuidv4(), name: 'Alpha Battery Pack' },
    { id: uuidv4(), name: 'Beta Cell Analysis' },
    { id: 'new', name: '+ Create New Project' }
  ];
};

export default function BDA() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [projectId, setProjectId] = useState(''); 
  const [projects, setProjects] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const { viewerWidth, setViewerWidth, startResizing } = useResizer(isSidebarOpen);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { fields, handleFieldChange, handleRemoveField, handleSwitchSpecification, handlePopulateExtractedData } = useParameterManager();
  const { uploadedFiles, activeFileId, activeDoc, activeSource, isLoading: isDocLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource } = useDocumentManager(projectId);

  // Auth Guard & Project Fetching
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchUserProjects(user).then((fetchedProjects) => {
        setProjects(fetchedProjects);
        setProjectId(fetchedProjects[0].id); // Default to the first project
      });
    }
  }, [user, authLoading, router]);

  const handleProjectChange = (event: any) => {
    const selected = event.target.value;
    if (selected === 'new') {
      setProjectId(uuidv4());
      // Logic to clear document manager / parameter manager would go here
    } else {
      setProjectId(selected);
      // Logic to fetch saved parameters for this specific project ID would go here
    }
  };

  if (authLoading || !user) return null; // Prevent rendering while checking auth

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        
        {/* Pass user to Header or render custom header bar here */}
        <LayoutHeader />

        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* SIDEBAR */}
          <Box sx={{ width: isSidebarOpen ? SIDEBAR_WIDTH : 0, transition: 'width 0.3s ease', borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none', bgcolor: colors.surface, overflow: 'hidden' }}>
            <Sidebar files={uploadedFiles} currentFileId={activeFileId} onSelectFile={handleSelectFile} />
          </Box>

          {/* MAIN PARAMETER AREA */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            
            {/* TOOLBAR */}
            <Box sx={{ p: 1, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                  {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1, fontWeight: 500, color: colors.textSecondary }}>
                  {isSidebarOpen ? 'Minimize' : 'Expand Sidebar'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Engineer: {user}</Typography>
                <IconButton onClick={logout} color="error" size="small" title="Log Out">
                  <LogoutIcon />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 3, msOverflowStyle: 'none', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
              
              {/* UPLOAD & ANALYZE SECTION */}
              <Paper sx={{ p: 3, mb: 3, bgcolor: colors.surface, border: `1px dashed ${colors.border}`, textAlign: 'center' }}>
                
                {/* PROJECT SELECTOR */}
                <FormControl sx={{ minWidth: 250, mb: 3 }} size="small">
                  <InputLabel>Active Project</InputLabel>
                  <Select value={projectId} label="Active Project" onChange={handleProjectChange}>
                    {projects.map((proj) => (
                      <MenuItem key={proj.id} value={proj.id} sx={{ fontWeight: proj.id === 'new' ? 'bold' : 'normal' }}>
                        {proj.name}
                      </MenuItem>
                    ))}
                    {/* Fallback in case a new project ID is generated but not in the list yet */}
                    {!projects.find(p => p.id === projectId) && <MenuItem value={projectId}>New Project ({projectId.slice(0,8)})</MenuItem>}
                  </Select>
                </FormControl>

                <DocumentUpload onUpload={handleDocumentUpload} isUploaded={!!activeFileId} isLoading={isDocLoading} />
                
                <Button 
                  variant="contained" 
                  disabled={uploadedFiles.length === 0 || isAnalyzing}
                  startIcon={<AutoAwesomeIcon />}
                  sx={{ mt: 3, px: 4, py: 1, bgcolor: colors.primary, '&:hover': { bgcolor: colors.secondary } }}
                  onClick={async () => {
                    try {
                      setIsAnalyzing(true);
                      const extractedData = await analyzeDocument(projectId);
                      handlePopulateExtractedData(extractedData);
                    } catch (error) {
                      console.error('Analysis failed:', error);
                      alert('Failed to analyze the document. Please try again.');
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </Button>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: colors.primary }}>
                Project Parameters ({fields.length} items)
              </Typography>

              <Box>
                <InputFieldsList fields={fields} onFieldChange={handleFieldChange} onRemoveField={handleRemoveField} onShowSource={handleJumpToSource} onSwitchSpecification={handleSwitchSpecification} />
              </Box>
            </Box>
          </Box>

          {/* RESIZE HANDLE */}
          <Box onMouseDown={startResizing} onDoubleClick={() => setViewerWidth(window.innerWidth / 2)} sx={{ width: '8px', cursor: 'col-resize', bgcolor: 'transparent', position: 'relative', zIndex: 10, '&::after': { content: '""', position: 'absolute', left: '3px', top: 0, bottom: 0, width: '2px', bgcolor: 'transparent', transition: 'background-color 0.2s', }, '&:hover::after': { bgcolor: colors.primary } }} />

          {/* DOCUMENT VIEWER */}
          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#e4e4e7', minWidth: MIN_VIEWER_WIDTH }}>
            <DocumentRouter fileUrl={activeDoc?.fileUrl || null} fileType={activeDoc?.fileType || null} activeHighlight={activeSource} />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}