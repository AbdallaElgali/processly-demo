'use client';

import '@/hooks/url-polyfill'; // <--- THIS MUST BE LINE 1

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Skeleton, Snackbar, Alert, Dialog, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useAuth } from '@/contexts/AuthContext';
import { useResizer } from '@/hooks/Resizer';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { colors } from '@/theme/colors';
import { MemoizedInputFieldsList } from '@/components/input-fields-list';
import { LayoutHeader } from '@/components/Headers/LayoutHeader';
import { MemoizedSidebar } from '@/components/ProjectsSideBar/BDASideBar';
import { ActionToolbar } from '@/components/ActionToolbar';
import { NoProjectsScreen } from '@/components/NoProjectsScreen';
import { UploadModal } from '@/components/UploadModal';
import { ProjectBar } from '@/components/ProjectBar';
import { JobBanner } from '@/components/jobs/JobBanner';
import dynamic from 'next/dynamic';
import { FrontendBatteryFileExport } from '@/static/battery-template';
import { InputField } from '@/types';
import { inputFieldToParameterInput, mapFieldsToSpecs } from '@/lib/parameter-adapter';
import { FeedbackModal } from '@/components/FeedbackModal';

import { TemplatesManager } from '@/components/TemplatesManager';
import { updateProjectParameter } from '@/api/projects';

import { useProjectsIndex } from '@/lib/project-data/provider';
import { projectsIndex } from '@/lib/project-data/projects-index';
import {
  approveProject,
  createProject,
  loadProjectDetails,
  saveParameters,
  updateParameterMetadata,
} from '@/lib/project-data/actions';
import { useCanStart, useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import { createJob, jobRuntime } from '@/lib/jobs/runtime';

const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((mod) => mod.MemoizedDocumentRouter),
  { ssr: false, loading: () => <p>Loading document viewer...</p> }
);

const SIDEBAR_WIDTH = 260;
const MIN_MAIN_WIDTH = 400;

export default function BDA() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { projects, activeProjectId, loading: projectsLoading } = useProjectsIndex();
  const router = useRouter();

  const hasMounted = useHasMounted();
  const prevProjectIdRef = useRef<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  const { viewerWidth, startResizing } = useResizer(isSidebarOpen);

  const projectState = useProjectData(activeProjectId);
  const currentProject = projectState?.details ?? null;
  const activity = useProjectActivity(activeProjectId);
  const analyzeGate = useCanStart(activeProjectId, 'extraction');

  const persistFields = useCallback(async (fieldsToPersist: InputField[]) => {
    if (!activeProjectId) return;
    await saveParameters(
      activeProjectId,
      fieldsToPersist.map(f => inputFieldToParameterInput(f, user?.id ?? null)),
      { silent: true },
    );
  }, [activeProjectId, user?.id]);

  const {
    fields, handleFieldChange, handleRemoveField, handleSwitchSpecification,
    handleFlag, handleUpdateMetadataLocal, flagError, clearFlagError,
  } = useParameterManager({ persist: persistFields, projectId: activeProjectId });

  const {
    uploadedFiles, activeFileId, activeDoc, activeSource, hydrateFiles,
    isLoading: isDocLoading, handleSelectFile, handleJumpToSource, clearFiles,
  } = useDocumentManager(activeProjectId);

  // --- jobs ---------------------------------------------------------------

  // Upload and Analyze now create jobs owned by the app-level runtime. The
  // page no longer awaits them, so navigating away neither cancels a run nor
  // sends its results to the wrong project (CLAUDE.md 8.1).
  const handleDocumentUploadAndRefresh = useCallback(async (files: File[]) => {
    if (!activeProjectId) return;
    void jobRuntime.enqueue(createJob(activeProjectId, { kind: 'upload', fileRefs: [] }), files);
    setIsUploadModalOpen(false);
  }, [activeProjectId]);

  const handleAnalyze = useCallback(() => {
    if (!activeProjectId) return;
    // A flagged field means this is an ITERATIVE correction run: the flagged
    // parameters go back as `previous_specs` so the backend re-extracts them.
    const hasFlagged = fields.some(f => f.isFlagged);
    const previousSpecs = hasFlagged ? mapFieldsToSpecs(fields) : null;
    void jobRuntime.enqueue(createJob(activeProjectId, {
      kind: 'extraction',
      mode: hasFlagged ? 'ITERATIVE' : 'BLIND',
      previousSpecs,
    }));
  }, [activeProjectId, fields]);

  const handleFlagAndRetry = useCallback(async (fieldId: string, reason: string) => {
    if (!activeProjectId) return;
    const newFlagId = await handleFlag(fieldId, true, reason);
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const scoped = mapFieldsToSpecs([
      { ...field, isFlagged: true, flagReason: reason, activeFlagId: newFlagId },
    ]) as Record<string, unknown> | null;

    void jobRuntime.enqueue(createJob(activeProjectId, {
      kind: 'correction',
      parameterKey: field.id,
      previousMetrics: (scoped?.[field.id] ?? []) as unknown[],
      userHint: reason,
    }));
  }, [handleFlag, fields, activeProjectId]);

  const correctionJob = activity.running?.kind === 'correction' ? activity.running : undefined;
  const correctingFieldId =
    correctionJob?.payload.kind === 'correction' ? correctionJob.payload.parameterKey : null;

  // --- actions ------------------------------------------------------------

  const handleUpdateMetadata = async (dbId: string, fieldId: string, data: updateProjectParameter) => {
    handleUpdateMetadataLocal(fieldId, data);
    try {
      await updateParameterMetadata(dbId, data);
    } catch (e) {
      console.error("Failed to persist metadata changes", e);
    }
  };

  const handleSave = async () => {
    if (!activeProjectId) return;
    setIsSaving(true);
    try {
      await saveParameters(
        activeProjectId,
        fields.map(f => inputFieldToParameterInput(f, user?.id ?? null)),
      );
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
      await approveProject(activeProjectId);
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
      // Delay revoking so the browser can finish writing the file to disk.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveSuccess(true);
    } catch (error) {
      console.error("Failed to export:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // --- effects ------------------------------------------------------------

  useEffect(() => {
    if (hasMounted && !authLoading && !user) router.push('/login');
  }, [user, authLoading, router, hasMounted]);

  // Load the selected project's details once per selection.
  useEffect(() => {
    if (!activeProjectId || activeProjectId === prevProjectIdRef.current) return;
    prevProjectIdRef.current = activeProjectId;
    clearFiles();
    void loadProjectDetails(activeProjectId);
  }, [activeProjectId, clearFiles]);

  // Documents come from the project's own cached details.
  useEffect(() => {
    if (currentProject?.documents?.length) {
      void hydrateFiles(currentProject.documents);
    }
  }, [currentProject?.id, currentProject?.documents, hydrateFiles]);

  // Opening a project marks its finished work as seen, clearing the badge.
  useEffect(() => {
    if (activeProjectId && activity.unseenCompleted.length > 0) {
      const timer = setTimeout(
        () => import('@/lib/jobs/store').then(({ jobStore }) =>
          jobStore.dispatch({ type: 'markSeen', projectId: activeProjectId })), 2500);
      return () => clearTimeout(timer);
    }
  }, [activeProjectId, activity.unseenCompleted.length]);

  if (!hasMounted) return null;
  if (authLoading || !user) return null;

  if (projects.length === 0 && !projectsLoading) {
    return (
      <NoProjectsScreen
        onCreateProject={async (alias, customerId, templateId) => {
          // Only fields ProjectCreateInput actually declares; the backend
          // ignores anything else.
          await createProject({
            alias_id: alias, template_id: templateId,
            customer_id: customerId, user_id: user.id,
          });
        }}
      />
    );
  }

  const projectName = currentProject?.alias_id || '';
  const isDetailsLoading = projectState?.loading.details ?? false;

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <LayoutHeader />
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          <Box sx={{ width: isSidebarOpen ? SIDEBAR_WIDTH : 0, transition: 'width 0.2s ease', borderRight: isSidebarOpen ? `1px solid ${colors.border}` : 'none', bgcolor: colors.surface, overflow: 'hidden' }}>
            <MemoizedSidebar currentFileId={activeFileId} onSelectFile={handleSelectFile} />
          </Box>

          <ActionToolbar
            onUploadClick={() => setIsUploadModalOpen(true)}
            onAnalyze={handleAnalyze}
            onFeedbackClick={() => setIsFeedbackModalOpen(prev => !prev)}
            onSave={handleSave}
            onApprove={handleApprove}
            onExport={handleExport}
            onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
            onManageTemplatesClick={() => setIsTemplatesModalOpen(true)}

            isSidebarOpen={isSidebarOpen}
            // Only THIS project's analyze state. Another project running does
            // not disable this button (CLAUDE.md 8.1).
            isAnalyzing={activity.running?.kind === 'extraction' || activity.queued?.job.kind === 'extraction'}
            analyzeStatus={activity.running?.phase ?? ''}
            isSaving={isSaving}
            isApproving={isApproving}
            isExporting={isExporting}
            isAnalyzeDisabled={uploadedFiles.length === 0 || !analyzeGate.allowed}
            isExportDisabled={isExporting || !activeProjectId}
            isApproveDisabled={isApproving || !activeProjectId}
            isFeedbackDisabled={false}
          />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: MIN_MAIN_WIDTH, bgcolor: colors.background }}>
            <ProjectBar
              projectName={projectName}
              username={user?.username}
              onLogout={logout}
              mode="edit"
            />
            <JobBanner projectId={activeProjectId} />
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
              {isDetailsLoading && fields.length === 0 ? (
                // A skeleton in place of the content, not a full-screen spinner
                // that unmounted the sidebar and the viewer (CLAUDE.md 8.4).
                <Box>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} height={48} sx={{ mb: 1 }} />
                  ))}
                </Box>
              ) : (
                <MemoizedInputFieldsList
                  fields={fields}
                  onFieldChange={handleFieldChange}
                  onRemoveField={handleRemoveField}
                  onShowSource={handleJumpToSource}
                  onSwitchSpecification={handleSwitchSpecification}
                  onFlag={handleFlag}
                  onFlagAndRetry={handleFlagAndRetry}
                  correctingFieldId={correctingFieldId}
                  correctionStatus={correctionJob?.phase ?? ''}
                  onUpdateMetadata={handleUpdateMetadata}
                  // Editing stays available during a run: only the row being
                  // corrected is locked, by correctingFieldId above.
                  readOnly={isSaving || isExporting || isApproving}
                />
              )}
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
          documents={(uploadedFiles || []).map((file) => ({
            id: file.id,
            name: file.name || `Document ${file.id.substring(0, 4)}...`
          }))}
        />
      )}

      <Dialog
        open={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        fullWidth
        maxWidth="xl"
        PaperProps={{ sx: { height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: `1px solid ${colors.border}` }}>
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

      <Snackbar open={!!flagError} autoHideDuration={6000} onClose={clearFlagError}>
        <Alert severity="error" onClose={clearFlagError}>{flagError}</Alert>
      </Snackbar>
    </>
  );
}
