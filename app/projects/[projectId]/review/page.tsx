'use client';

import '@/hooks/url-polyfill';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Alert, Box, Button, Divider, Skeleton, Snackbar, Stack, Tooltip, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';

import { useAuth } from '@/contexts/AuthContext';
import { useResizer } from '@/hooks/Resizer';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentManager } from '@/hooks/DocumentManager';
import { MemoizedInputFieldsList } from '@/components/input-fields-list';
import { UploadModal } from '@/components/UploadModal';
import { JobBanner } from '@/components/jobs/JobBanner';
import { FrontendBatteryFileExport } from '@/static/battery-template';
import type { InputField } from '@/types';
import { inputFieldToParameterInput, mapFieldsToSpecs } from '@/lib/parameter-adapter';
import { updateProjectParameter } from '@/api/projects';
import { approveProject, saveParameters, updateParameterMetadata } from '@/lib/project-data/actions';
import { useCanStart, useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import { createJob, jobRuntime } from '@/lib/jobs/runtime';

const DocumentRouter = dynamic(
  () => import('@/components/DocumentViewer/DocumentRouter').then((m) => m.MemoizedDocumentRouter),
  { ssr: false, loading: () => <Skeleton variant="rectangular" height="100%" /> },
);

/**
 * Review — the interim screen.
 *
 * This is the pre-redesign editor body, moved under the new shell so the app
 * stays fully usable while the real screens are built: Extract takes upload
 * and analyze in step 7, and steps 8-10 rebuild this as the split-pane review
 * with the row states from RFC section 4. The toolbar below replaces the old
 * 56px icon rail; everything it does is unchanged.
 */
export default function ReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  const [isSidebarOpen] = useState(true);
  const { viewerWidth, startResizing } = useResizer(isSidebarOpen);

  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isApproving, setApproving] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const projectState = useProjectData(projectId);
  const details = projectState?.details ?? null;
  const activity = useProjectActivity(projectId);
  const analyzeGate = useCanStart(projectId, 'extraction');

  const persistFields = useCallback(
    async (fields: InputField[]) => {
      await saveParameters(
        projectId,
        fields.map((f) => inputFieldToParameterInput(f, user?.id ?? null)),
        { silent: true },
      );
    },
    [projectId, user?.id],
  );

  const {
    fields, handleFieldChange, handleRemoveField, handleSwitchSpecification,
    handleFlag, handleUpdateMetadataLocal, flagError, clearFlagError,
  } = useParameterManager({ persist: persistFields, projectId });

  const {
    uploadedFiles, activeFileId, activeDoc, activeSource,
    hydrateFiles, isLoading: isDocLoading, handleJumpToSource, clearFiles,
  } = useDocumentManager(projectId);

  useEffect(() => {
    clearFiles();
  }, [projectId, clearFiles]);

  useEffect(() => {
    if (details?.documents?.length) void hydrateFiles(details.documents);
  }, [details?.id, details?.documents, hydrateFiles]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      await jobRuntime.enqueue(createJob(projectId, { kind: 'upload', fileRefs: [] }), files);
      setUploadOpen(false);
    },
    [projectId],
  );

  const handleAnalyze = useCallback(() => {
    const hasFlagged = fields.some((f) => f.isFlagged);
    void jobRuntime.enqueue(
      createJob(projectId, {
        kind: 'extraction',
        mode: hasFlagged ? 'ITERATIVE' : 'BLIND',
        previousSpecs: hasFlagged ? mapFieldsToSpecs(fields) : null,
      }),
    );
  }, [projectId, fields]);

  const handleFlagAndRetry = useCallback(
    async (fieldId: string, reason: string) => {
      const newFlagId = await handleFlag(fieldId, true, reason);
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;
      const scoped = mapFieldsToSpecs([
        { ...field, isFlagged: true, flagReason: reason, activeFlagId: newFlagId },
      ]) as Record<string, unknown> | null;
      void jobRuntime.enqueue(
        createJob(projectId, {
          kind: 'correction',
          parameterKey: field.id,
          previousMetrics: (scoped?.[field.id] ?? []) as unknown[],
          userHint: reason,
        }),
      );
    },
    [handleFlag, fields, projectId],
  );

  const handleUpdateMetadata = async (dbId: string, fieldId: string, data: updateProjectParameter) => {
    handleUpdateMetadataLocal(fieldId, data);
    try {
      await updateParameterMetadata(dbId, data);
    } catch (e) {
      console.error('Failed to persist metadata changes', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveParameters(projectId, fields.map((f) => inputFieldToParameterInput(f, user?.id ?? null)));
      setToast('Saved.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approveProject(projectId);
      setToast('Parameters approved.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Approve failed.');
    } finally {
      setApproving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { content, filename } = new FrontendBatteryFileExport().generate(
        fields, details?.alias_id ?? '',
      );
      if (!content?.trim()) throw new Error('The export was empty.');
      const url = URL.createObjectURL(new Blob([content], { type: 'application/xml;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast('Exported.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const correctionJob = activity.running?.kind === 'correction' ? activity.running : undefined;
  const correctingFieldId =
    correctionJob?.payload.kind === 'correction' ? correctionJob.payload.parameterKey : null;
  const isAnalyzing =
    activity.running?.kind === 'extraction' || activity.queued?.job.kind === 'extraction';
  const detailsLoading = projectState?.loading.details ?? false;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Actions, replacing the old icon rail. Each button carries its own
          loading state; nothing here disables the rest of the app (8.1). */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel' }}
      >
        <Button size="small" startIcon={<CloudUploadOutlinedIcon />} onClick={() => setUploadOpen(true)}>
          Upload
        </Button>
        <Tooltip title={analyzeGate.allowed ? '' : ('reason' in analyzeGate ? analyzeGate.reason : '')}>
          <span>
            <Button
              size="small"
              variant="contained"
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={handleAnalyze}
              loading={isAnalyzing}
              disabled={uploadedFiles.length === 0 || !analyzeGate.allowed}
            >
              Analyze
            </Button>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={handleSave} loading={isSaving}>
          Save
        </Button>
        <Button size="small" startIcon={<DoneAllIcon />} onClick={handleApprove} loading={isApproving}>
          Approve
        </Button>
        <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} loading={isExporting}>
          Export
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.muted' }}>
          {fields.length} parameters
        </Typography>
      </Stack>

      <JobBanner projectId={projectId} />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minWidth: 360, overflowY: 'auto', p: 3 }}>
          {detailsLoading && fields.length === 0 ? (
            <Stack spacing={1}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} height={48} />
              ))}
            </Stack>
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
              readOnly={isSaving || isExporting || isApproving}
            />
          )}
        </Box>

        <Box
          onMouseDown={startResizing}
          role="separator"
          aria-orientation="vertical"
          sx={{ width: 6, cursor: 'col-resize', bgcolor: 'border.subtle', '&:hover': { bgcolor: 'accent.fill' } }}
        />

        {/* The document stays light in both modes (8.3). */}
        <Box sx={{ width: viewerWidth, display: 'flex', flexDirection: 'column', bgcolor: 'document.canvas' }}>
          <DocumentRouter
            fileUrl={activeDoc?.fileUrl || null}
            fileType={activeDoc?.fileType || null}
            activeHighlight={activeSource}
          />
        </Box>
      </Box>

      <UploadModal
        open={isUploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        isUploaded={!!activeFileId}
        isLoading={isDocLoading}
      />

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
      <Snackbar open={!!flagError} autoHideDuration={6000} onClose={clearFlagError}>
        <Alert severity="error" onClose={clearFlagError}>{flagError}</Alert>
      </Snackbar>
    </Box>
  );
}
