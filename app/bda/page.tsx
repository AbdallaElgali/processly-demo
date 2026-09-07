'use client';

import '@/hooks/url-polyfill'; // <--- THIS MUST BE LINE 1

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Box, ThemeProvider, CssBaseline, CircularProgress, Snackbar, Alert, Dialog, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useResizer } from '@/hooks/Resizer';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { useAnalyze } from '@/hooks/useAnalyze';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { MemoizedInputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/Headers/LayoutHeader';
import { MemoizedSidebar } from '@/components/ProjectsSideBar/BDASideBar';
import { ActionToolbar } from '@/components/ActionToolbar';
import { NoProjectsScreen } from '@/components/NoProjectsScreen';
import { UploadModal } from '@/components/UploadModal';
import { ProjectBar } from '@/components/ProjectBar';
import dynamic from 'next/dynamic';
import { FrontendBatteryFileExport } from '@/static/battery-template';
import { InputField } from '@/types';
import { inputFieldToParameterInput } from '@/lib/parameter-adapter';
import { FeedbackModal } from '@/components/FeedbackModal';
import { useAnalyzeParameter } from '@/hooks/useAnalyzeParameter';

// Import the new TemplatesManager component
import { TemplatesManager } from '@/components/TemplatesManager'; 
import { updateProjectParameter } from '@/api/projects';

const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((mod) => mod.MemoizedDocumentRouter),
  { ssr: false, loading: () => <p>Loading document viewer...</p> }
);

const SIDEBAR_WIDTH = 260;
const MIN_VIEWER_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

export default function BDA() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { projects, currentProject, isLoading: projectsLoading, createNewProject, saveParameters, saveParametersSilent, loadProjectDetails, approveDocument, updateParameterMetadata } = useProject();
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const activeProjectId = currentProject?.id || null;
  const prevProjectIdRef = useRef<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isApproving, setIsApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isFeedbackDisabled, setIsFeedbackDisabled] = useState(false);

  // State for the Templates Manager Modal
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  const { viewerWidth, startResizing } = useResizer(isSidebarOpen);

  // Persist the current fields...
  const persistFields = useCallback(async (fieldsToPersist: InputField[]) => {
    if (!activeProjectId) return;
    await saveParametersSilent(
      activeProjectId,
      fieldsToPersist.map(f => inputFieldToParameterInput(f, user?.id ?? null))
    );
  }, [activeProjectId, saveParametersSilent, user?.id]);

  const {
    fields, handleFieldChange, handleRemoveField, handleSwitchSpecification,
    handlePopulateExtractedData, hydrateFieldsFromDB, resetFields, handleFlag, handleUpdateMetadataLocal, applyFlagChain
  } = useParameterManager({ persist: persistFields });
  
  const {
    uploadedFiles, activeFileId, activeDoc, activeSource, hydrateFiles,
    isLoading: isDocLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource, clearFiles,
  } = useDocumentManager(activeProjectId);

  const user_id = user?.id || "";
  const { isAnalyzing, analyzeStatus, handleAnalyze } = useAnalyze(
    activeProjectId,
    {id: user_id},
    handlePopulateExtractedData,
    applyFlagChain
  );

  const {
    correctingFieldId, correctionStatus, correctionError,
    clearCorrectionError, handleAnalyzeParameter,
  } = useAnalyzeParameter(
    activeProjectId,
    { id: user_id },
    handlePopulateExtractedData,
    applyFlagChain,
  );

  const handleDocumentUploadAndRefresh = useCallback(async (files: File[]) => {
    await handleDocumentUpload(files);
    if (activeProjectId) {
      await loadProjectDetails(activeProjectId);
    }
  }, [handleDocumentUpload, activeProjectId, loadProjectDetails]);

  const handleUpdateMetadata = async (dbId: string, fieldId: string, data: updateProjectParameter) => {
    // 1. Instantly update UI locally
    handleUpdateMetadataLocal(fieldId, data);
    // 2. Fire and forget to the backend
    try {
      await updateParameterMetadata(dbId, data);
    } catch (e) {
      console.error("Failed to persist metadata changes", e);
    }
  };
  // --- FIXED: WIRED UP THE ACTION HANDLERS ---

  const handleSave = async () => { 
    if (!activeProjectId) return;
    setIsSaving(true);
    try {
      const parametersToSave = fields.map(f => inputFieldToParameterInput(f, user?.id ?? null));
      await saveParameters(activeProjectId, parametersToSave);
      setSaveSuccess(true);
    } catch (error) {
      console.error("Failed to save parameters:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => { 
    if (!activeProjectId) return;
    setIsApproving(true);
    try {
      await approveDocument(activeProjectId);
      setApproveSuccess(true);
    } catch (error) {
      console.error("Failed to approve document:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleExport = async () => { 
      if (!activeProjectId) return;
      setIsExporting(true);
      try {
        const exporter = new FrontendBatteryFileExport();
        const { content, filename } = exporter.generate(fields, projectName);

        if (!content || content.trim() === '') {
          console.error("Generated content is empty!");
          return;
        }

        const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // FIX: Delay revoking the URL so the browser has time to finish writing the .part file to disk
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);

        setSaveSuccess(true);
      } catch (error) {
        console.error("Failed to export:", error);
      } finally {
        setIsExporting(false);
      }
    };

    const handleFlagAndRetry = useCallback(async (fieldId: string, reason: string) => {
      const newFlagId = await handleFlag(fieldId, true, reason);
      if (!newFlagId) return;

      const field = fields.find(f => f.id === fieldId);
      if (!field) return;

      await handleAnalyzeParameter({
        ...field,
        isFlagged: true,
        flagReason: reason,
        activeFlagId: newFlagId,
      });
    }, [handleFlag, handleAnalyzeParameter, fields]);
  // ------------------------------------------

  // Effects...
  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [user, authLoading, router, hasMounted]);

  useEffect(() => {
    if (hasMounted && projects.length > 0 && !currentProject && !projectsLoading) {
      loadProjectDetails(projects[0].id);
    }
  }, [hasMounted, projects, currentProject, projectsLoading, loadProjectDetails]);

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
      if (currentProject.parameters) {
        hydrateFieldsFromDB(currentProject.parameters);
      }
    }
  }, [currentProject, clearFiles, resetFields, hydrateFiles, hydrateFieldsFromDB]);

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
  
  if (projects.length === 0 && !currentProject) {
    return (
      <NoProjectsScreen
        onCreateProject={async (alias, customerId, templateId) => {
          await createNewProject({ alias_id: alias, title: alias, template_id: templateId, customer_id: customerId });
        }}
      />
    );
  }

  const projectName = currentProject?.alias_id || currentProject?.title || currentProject?.name || '';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <LayoutHeader />
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          <Box sx={{ width: isSidebarOpen ? SIDEBAR_WIDTH : 0, transition: 'width 0.3s ease', borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none', bgcolor: colors.surface, overflow: 'hidden' }}>
            <MemoizedSidebar currentFileId={activeFileId} onSelectFile={handleSelectFile} />
          </Box>

          <ActionToolbar
            onUploadClick={() => setIsUploadModalOpen(true)}
            onAnalyze={() => handleAnalyze(fields)}
            onFeedbackClick={() => setIsFeedbackModalOpen(prev => !prev)}
            onSave={handleSave}
            onApprove={handleApprove}          
            onExport={handleExport}
            onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
            onManageTemplatesClick={() => setIsTemplatesModalOpen(true)}

            isSidebarOpen={isSidebarOpen}
            isAnalyzing={isAnalyzing}
            analyzeStatus={analyzeStatus}
            isSaving={isSaving}
            isApproving={isApproving}        
            isExporting={isExporting}
            isAnalyzeDisabled={uploadedFiles.length === 0 || isAnalyzing}
            isExportDisabled={isExporting || !activeProjectId}
            isApproveDisabled={isApproving || !activeProjectId}
            isFeedbackDisabled={isFeedbackDisabled}
          />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            <ProjectBar
              projectName={projectName}
              username={user?.username}
              onLogout={logout}
              mode="edit"
            />
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
              <MemoizedInputFieldsList
                fields={fields}
                onFieldChange={handleFieldChange}
                onRemoveField={handleRemoveField}
                onShowSource={handleJumpToSource}
                onSwitchSpecification={handleSwitchSpecification}
                onFlag={handleFlag}

                onFlagAndRetry={handleFlagAndRetry}
                correctingFieldId={correctingFieldId}
                correctionStatus={correctionStatus}

                onUpdateMetadata={handleUpdateMetadata}
                readOnly={isAnalyzing || isSaving || isExporting || isApproving}
              />
            </Box>
          </Box>

          <Box onMouseDown={startResizing} sx={{ width: '6px', cursor: 'col-resize', transition: '0.2s', '&:hover': { bgcolor: colors.primary } }} />

          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#f4f4f5' }}>
            <DocumentRouter fileUrl={activeDoc?.fileUrl || null} fileType={activeDoc?.fileType || null} activeHighlight={activeSource} />
          </Box>
        </Box>
      </Box>

      {/* --- MODALS & NOTIFICATIONS --- */}

      <UploadModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleDocumentUploadAndRefresh}
        isUploaded={!!activeFileId}
        isLoading={isDocLoading}
      />
      
      {user?.id && activeProjectId && (
        <FeedbackModal
          open={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          userId={user.id}
          projectId={activeProjectId}
          documents={(uploadedFiles || []).map((file: any) => ({
            id: file.id,
            name: file.name || file.filename || file.file_name || file.title || `Document ${file.id.substring(0, 4)}...`
          }))}
        />
      )}

      {/* The Templates Manager Modal */}
      <Dialog 
        open={isTemplatesModalOpen} 
        onClose={() => setIsTemplatesModalOpen(false)}
        fullWidth
        maxWidth="xl"
        PaperProps={{ sx: { height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          p: 2, 
          borderBottom: `1px solid ${colors.border}` 
        }}>
          <Typography variant="h6">Manage Templates</Typography>
          <IconButton onClick={() => setIsTemplatesModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TemplatesManager />
        </Box>
      </Dialog>

      <Snackbar open={saveSuccess} autoHideDuration={3000} onClose={() => setSaveSuccess(false)}>
        <Alert severity="success">State saved to database.</Alert>
      </Snackbar>

      <Snackbar open={approveSuccess} autoHideDuration={3000} onClose={() => setApproveSuccess(false)}>
        <Alert severity="success">Document successfully approved!</Alert>
      </Snackbar>
      
      <Snackbar
        open={!!correctionError}
        autoHideDuration={5000}
        onClose={clearCorrectionError}
      >
        <Alert severity="error" onClose={clearCorrectionError}>{correctionError}</Alert>
      </Snackbar>
    </ThemeProvider>
  );
}