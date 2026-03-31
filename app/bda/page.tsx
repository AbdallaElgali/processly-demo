'use client';

import '@/hooks/url-polyfill'; // <--- THIS MUST BE LINE 1

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, ThemeProvider, CssBaseline, Typography, IconButton, TextField, 
  CircularProgress, Modal, Tooltip, Divider, Paper, Alert, Snackbar, Button
} from '@mui/material';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; 
import LogoutIcon from '@mui/icons-material/Logout';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';

import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useResizer } from '@/hooks/Resizer';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { DocumentUpload } from '@/components/document-upload';
import { MemoizedInputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/LayoutHeader';
import { MemoizedSidebar } from '@/components/Sidebar';
import dynamic from 'next/dynamic';
import { analyzeDocument } from '@/api/analyze-document';
import { FrontendBatteryFileExport } from '@/static/battery-template';

const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((mod) => mod.MemoizedDocumentRouter),
  { ssr: false, loading: () => <p>Loading document viewer...</p> }
);

const SIDEBAR_WIDTH = 260;
const TOOLBAR_WIDTH = 56;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

export default function BDA() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { projects, currentProject, isLoading: projectsLoading, createNewProject, saveParameters, loadProjectDetails } = useProject();
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const activeProjectId = currentProject?.id || null;
  const prevProjectIdRef = useRef<string | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newProjectAlias, setNewProjectAlias] = useState('');
  const analyzeUiTickRef = useRef<number | null>(null);
  const pendingPartialRef = useRef<any[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // THE FIX: Local state to trap API errors during creation
  const [createError, setCreateError] = useState<string | null>(null);

  const { viewerWidth, setViewerWidth, startResizing } = useResizer(isSidebarOpen);
  const { fields, handleFieldChange, handleRemoveField, handleSwitchSpecification, handlePopulateExtractedData, hydrateFieldsFromDB, resetFields } = useParameterManager();
  const { uploadedFiles, activeFileId, activeDoc, activeSource, hydrateFiles, isLoading: isDocLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource, clearFiles } = useDocumentManager(activeProjectId);

  const handleExport = () => {
      if (!activeProjectId || !currentProject) return;
      setIsExporting(true);
      
      try {
        // 1. Instantiate our new frontend utility
        const exporter = new FrontendBatteryFileExport();
        
        // 2. Generate the XML string and filename using the current fields state
        const projectName = currentProject.alias_id || currentProject.title || 'Export';
        console.log("Exporting with fields:", fields);
        const { content, filename } = exporter.generate(fields, projectName);

        // 3. Create a Blob from the XML string
        const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        
        // 4. Trigger the browser download
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
        
      } catch (error) {
        console.error("Export generation failed:", error);
      } finally {
        setIsExporting(false);
      }
    };
    
  // 1. Auth Guard
  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [user, authLoading, router, hasMounted]);

  // 2. Auto-load First Project
  useEffect(() => {
    if (hasMounted && projects.length > 0 && !currentProject && !projectsLoading) {
      loadProjectDetails(projects[0].id);
    }
  }, [hasMounted, projects, currentProject, projectsLoading, loadProjectDetails]);

  // 3. Handle Project Switching & Hydration
  useEffect(() => {
    if (!currentProject) return;

    const isNewProject = currentProject.id !== prevProjectIdRef.current;

    if (isNewProject) {
      clearFiles();
      resetFields();
      prevProjectIdRef.current = currentProject.id;
      
      if (currentProject.documents && currentProject.documents.length > 0) {
        hydrateFiles(currentProject.documents);
      }
    }

    if (currentProject.parameters) {
      hydrateFieldsFromDB(currentProject.parameters);
    }
  }, [currentProject, clearFiles, resetFields, hydrateFiles, hydrateFieldsFromDB]);

  // 4. Initialization Handler
  const handleInitializeProject = async () => {
    if (!newProjectAlias.trim()) return;
    setCreateError(null);
    try {
      // THE FIX: Send both alias_id and title to safely accommodate the backend schema
      await createNewProject({ 
        alias_id: newProjectAlias.trim(), 
        title: newProjectAlias.trim() 
      } as any);
    } catch (error: any) {
      console.error("Initialization failed:", error);
      setCreateError(error.message || "Failed to create project. Please try again.");
    }
  };

  // 5. Save Logic
  const handleSave = async () => {
    if (!activeProjectId) return;
    setIsSaving(true);
    try {
      const paramsToSave = fields.map(f => {
        const activeSpec = f.specifications.find(s => s.id === f.selectedSpecId) || f.specifications[0];
        return {
          parameter_key: f.id, 
          final_value: activeSpec?.value || null, 
          final_unit: activeSpec?.unit || null,
          is_human_modified: activeSpec ? (activeSpec.confidence === null) : true,
          selected_candidate_id: activeSpec?.id || null
        };
      });
      await saveParameters(activeProjectId, paramsToSave);
      setSaveSuccess(true);
    } catch (error) {
      console.error("Save failed:", error);
    } finally { setIsSaving(false); }
  };

  // --- RENDER ---

  const flushAnalyzePartial = () => {
    analyzeUiTickRef.current = null;
    if (!pendingPartialRef.current) return;
    handlePopulateExtractedData(pendingPartialRef.current as any);
    pendingPartialRef.current = null;
  };

  const queueAnalyzePartial = (partial: any[]) => {
    pendingPartialRef.current = partial;
    if (analyzeUiTickRef.current !== null) return;
    analyzeUiTickRef.current = window.setTimeout(flushAnalyzePartial, 120);
  };

  if (!hasMounted) return null;

  if (authLoading || projectsLoading || !user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: colors.background }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  if (projects.length === 0) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.background }}>
          <LayoutHeader />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Paper sx={{ p: 4, maxWidth: 450, width: '100%', textAlign: 'center' }}>
              <AddCircleOutlineIcon sx={{ fontSize: 60, color: colors.primary, mb: 2 }} />
              <Typography variant="h5" fontWeight="bold">Initialize BDA Project</Typography>
              
              {/* THE FIX: Error State UI */}
              {createError && (
                <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
                  {createError}
                </Alert>
              )}

              <TextField 
                fullWidth 
                label="Project Alias" 
                value={newProjectAlias} 
                onChange={(e) => setNewProjectAlias(e.target.value)} 
                sx={{ my: 3 }} 
              />
              <Button 
                fullWidth 
                variant="contained" 
                disabled={!newProjectAlias.trim()} 
                onClick={handleInitializeProject}
              >
                Start Project
              </Button>
            </Paper>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <LayoutHeader />
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <Box sx={{ width: isSidebarOpen ? SIDEBAR_WIDTH : 0, transition: 'width 0.3s ease', borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none', bgcolor: colors.surface, overflow: 'hidden' }}>
            <MemoizedSidebar currentFileId={activeFileId} onSelectFile={handleSelectFile} />
          </Box>

          <Box sx={{ width: TOOLBAR_WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 2, borderRight: `1px solid ${colors.border}`, bgcolor: colors.surface }}>
            <Tooltip title="Upload Document" placement="right">
              <IconButton onClick={() => setIsUploadModalOpen(true)} color="primary"><CloudUploadIcon /></IconButton>
            </Tooltip>
            <Tooltip title={isAnalyzing ? analyzeStatus : "Analyze"} placement="right">
              <Box sx={{ position: 'relative' }}>
                <IconButton 
                  onClick={async () => {
                    setIsAnalyzing(true);
                    setAnalyzeStatus('AI Ready...');
                    try {
                      const final = await analyzeDocument(activeProjectId!, (status, partial) => {
                        setAnalyzeStatus(status);
                        queueAnalyzePartial(partial);
                      });
                      if (analyzeUiTickRef.current !== null) {
                        clearTimeout(analyzeUiTickRef.current);
                        analyzeUiTickRef.current = null;
                      }
                      if (pendingPartialRef.current) {
                        handlePopulateExtractedData(pendingPartialRef.current as any);
                        pendingPartialRef.current = null;
                      }
                      handlePopulateExtractedData(final);
                    } finally { setIsAnalyzing(false); }
                  }} 
                  disabled={uploadedFiles.length === 0 || isAnalyzing}
                >
                  <AutoAwesomeIcon />
                </IconButton>
                {isAnalyzing && <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1, color: colors.secondary }} />}
              </Box>
            </Tooltip>
            
            <Tooltip title="Save" placement="right">
              <Box sx={{ position: 'relative' }}>
                <IconButton onClick={handleSave} disabled={isSaving} color="success"><SaveIcon /></IconButton>
                {isSaving && <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />}
              </Box>
            </Tooltip>

            {/* ---> ADDED EXPORT BUTTON <--- */}
            <Tooltip title="Export .battery File" placement="right">
              <Box sx={{ position: 'relative' }}>
                <IconButton 
                  onClick={handleExport} 
                  disabled={isExporting || !activeProjectId} 
                  color="info"
                >
                  <DownloadIcon />
                </IconButton>
                {isExporting && <CircularProgress size={40} sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />}
              </Box>
            </Tooltip>

            <Divider sx={{ width: '70%', my: 1 }} />
            <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}</IconButton>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            <Box sx={{ p: 1.5, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, bgcolor: colors.surface }}>
              <Typography variant="body2">Active Project: <strong style={{ color: colors.primary }}>{currentProject?.alias_id || currentProject?.title || currentProject?.name || 'Loading...'}</strong></Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" fontWeight="bold">{user?.username}</Typography>
                <IconButton onClick={logout} color="error" size="small"><LogoutIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
              <MemoizedInputFieldsList fields={fields} onFieldChange={handleFieldChange} onRemoveField={handleRemoveField} onShowSource={handleJumpToSource} onSwitchSpecification={handleSwitchSpecification} />
            </Box>
          </Box>

          <Box onMouseDown={startResizing} sx={{ width: '6px', cursor: 'col-resize', transition: '0.2s', '&:hover': { bgcolor: colors.primary } }} />

          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#f4f4f5' }}>
            <DocumentRouter fileUrl={activeDoc?.fileUrl || null} fileType={activeDoc?.fileType || null} activeHighlight={activeSource} />
          </Box>
        </Box>
      </Box>

      <Modal open={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold">Project Documents</Typography>
            <DocumentUpload onUpload={handleDocumentUpload} isUploaded={!!activeFileId} isLoading={isDocLoading} />
            <Button fullWidth variant="outlined" onClick={() => setIsUploadModalOpen(false)} sx={{ mt: 3 }}>Back to Workspace</Button>
          </Paper>
        </Box>
      </Modal>

      <Snackbar open={saveSuccess} autoHideDuration={3000} onClose={() => setSaveSuccess(false)}>
        <Alert severity="success">State saved to database.</Alert>
      </Snackbar>
    </ThemeProvider>
  );
}