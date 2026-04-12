'use client';

import '@/hooks/url-polyfill'; // <--- THIS MUST BE LINE 1

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Box, ThemeProvider, CssBaseline, CircularProgress, Snackbar, Alert } from '@mui/material';

import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useResizer } from '@/hooks/Resizer';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { useAnalyze } from '@/hooks/useAnalyze';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { MemoizedInputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/LayoutHeader';
import { MemoizedSidebar } from '@/components/Sidebar';
import { ActionToolbar } from '@/components/ActionToolbar';
import { NoProjectsScreen } from '@/components/NoProjectsScreen';
import { UploadModal } from '@/components/UploadModal';
import { ProjectBar } from '@/components/ProjectBar';
import dynamic from 'next/dynamic';
import { FrontendBatteryFileExport } from '@/static/battery-template';
import { InputField } from '@/types';

const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((mod) => mod.MemoizedDocumentRouter),
  { ssr: false, loading: () => <p>Loading document viewer...</p> }
);

const SIDEBAR_WIDTH = 260;
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
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { viewerWidth, startResizing } = useResizer(isSidebarOpen);
  const {
    fields, handleFieldChange, handleRemoveField, handleSwitchSpecification,
    handlePopulateExtractedData, hydrateFieldsFromDB, resetFields, handleFlag,
  } = useParameterManager();
  const {
    uploadedFiles, activeFileId, activeDoc, activeSource, hydrateFiles,
    isLoading: isDocLoading, handleDocumentUpload, handleSelectFile, handleJumpToSource, clearFiles,
  } = useDocumentManager(activeProjectId);

  const { isAnalyzing, analyzeStatus, handleAnalyze } = useAnalyze(
    activeProjectId,
    handlePopulateExtractedData
  );

  const handleExport = () => {
    if (!activeProjectId || !currentProject) return;
    setIsExporting(true);
    try {
      const exporter = new FrontendBatteryFileExport();
      const projectName = currentProject.alias_id || currentProject.title || 'Export';
      const { content, filename } = exporter.generate(fields, projectName);
      const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export generation failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async () => {
    if (!activeProjectId) return;
    setIsSaving(true);
    try {
      const paramsToSave = fields.map(f => {
        const activeSpec = f.specifications.find(s => s.id === f.selectedSpecId) || f.specifications[0];
        const parsedValue = activeSpec?.value ? Number(activeSpec.value) : null;
        return {
          parameter_key: f.id,
          final_value: parsedValue !== null && !isNaN(parsedValue) ? parsedValue : null,
          final_unit: activeSpec?.unit || null,
          is_human_modified: activeSpec ? (activeSpec.confidence === null) : true,
          selected_candidate_id: activeSpec?.id || null,
        };
      });
      await saveParameters(activeProjectId, paramsToSave);
      setSaveSuccess(true);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
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
  // IMPORTANT: hydrateFieldsFromDB is intentionally inside isNewProject.
  // Calling it on every currentProject update (e.g. after a save triggers
  // loadProjectDetails) would overwrite in-memory AI specs — which carry
  // bounding boxes — with DB specs that only store page number + text snippet.
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

  if (projects.length === 0) {
    return (
      <NoProjectsScreen
        onCreateProject={async (alias) => {
          await createNewProject({ alias_id: alias, title: alias });
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
            onAnalyze={handleAnalyze}
            onSave={handleSave}
            onExport={handleExport}
            onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
            isSidebarOpen={isSidebarOpen}
            isAnalyzing={isAnalyzing}
            analyzeStatus={analyzeStatus}
            isSaving={isSaving}
            isExporting={isExporting}
            isAnalyzeDisabled={uploadedFiles.length === 0 || isAnalyzing}
            isExportDisabled={isExporting || !activeProjectId}
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
              />
            </Box>
          </Box>

          <Box onMouseDown={startResizing} sx={{ width: '6px', cursor: 'col-resize', transition: '0.2s', '&:hover': { bgcolor: colors.primary } }} />

          <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}`, bgcolor: '#f4f4f5' }}>
            <DocumentRouter fileUrl={activeDoc?.fileUrl || null} fileType={activeDoc?.fileType || null} activeHighlight={activeSource} />
          </Box>
        </Box>
      </Box>

      <UploadModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleDocumentUpload}
        isUploaded={!!activeFileId}
        isLoading={isDocLoading}
      />

      <Snackbar open={saveSuccess} autoHideDuration={3000} onClose={() => setSaveSuccess(false)}>
        <Alert severity="success">State saved to database.</Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
