'use client';

import '@/hooks/url-polyfill';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Button, Divider, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';

import { useAuth } from '@/contexts/AuthContext';
import { useParameterManager } from '@/hooks/ParameterManager';
import { useDocumentWorkspace } from '@/hooks/useDocumentWorkspace';
import { useCanonicalParameters } from '@/hooks/useCanonicalParameters';
import { useLocalStorageFlag } from '@/hooks/useLocalStorageFlag';
import { Dropzone } from '@/components/ui/Dropzone';
import { SplitPane } from '@/components/ui/SplitPane';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { ParameterTable } from '@/components/workspace/ParameterTable';
import { JobStatusLine } from '@/components/workspace/JobStatusLine';
import { DocumentTabs } from '@/components/workspace/DocumentTabs';
import { DocumentViewport } from '@/components/workspace/DocumentViewport';
import { SourceBar } from '@/components/workspace/SourceBar';
import { documentFiles, isSpreadsheetDocument } from '@/lib/documents/fileStore';
import { useDocumentFiles } from '@/lib/documents/hooks';
import { useMatchInfo } from '@/lib/excel/matchNav';
import { FrontendBatteryFileExport, missingExportKeys } from '@/static/battery-template';
import type { InputField, SpecificationSource } from '@/types';
import { inputFieldToParameterInput, mapFieldsToSpecs } from '@/lib/parameter-adapter';
import { approveProject, saveParameters } from '@/lib/project-data/actions';
import { useCanStart, useJobTray, useJobs, useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import { JOB_CAP } from '@/lib/jobs/config';
import { createJob, jobRuntime } from '@/lib/jobs/runtime';

const ACCEPT = '.pdf,.xlsx,.xlsm';
const COMPACT_KEY = 'bda.workspace.compact';
const REVIEW_FIRST_KEY = 'bda.workspace.reviewFirst';

/**
 * The Workspace (AM11): extraction and review on one screen, replacing the
 * separate Extract and Review screens.
 *
 * Toolbar: add documents, Analyze, the project's job as one line, then Save /
 * Approve / Export. Body: the parameter table and the document viewer in a
 * resizable split, full-bleed (AM14). With no documents yet, the whole body is
 * the dropzone; with documents, files dropped anywhere on the screen upload.
 *
 * The project stays fully reviewable while its own run is going (CLAUDE.md
 * 8.1): nothing here is disabled by a running job except Analyze and the row
 * being re-extracted.
 */
export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  const projectState = useProjectData(projectId);
  const details = projectState?.details ?? null;
  const detailsLoading = projectState?.loading.details ?? false;
  const documents = useMemo(() => details?.documents ?? [], [details?.documents]);
  const { parameters: canonical } = useCanonicalParameters();

  const activity = useProjectActivity(projectId);
  const analyzeGate = useCanStart(projectId, 'extraction');
  const tray = useJobTray();
  const jobs = useJobs();
  const uploadJobs = useMemo(
    () => jobs.filter((j) => j.projectId === projectId && j.kind === 'upload'),
    [jobs, projectId],
  );

  const [compact, setCompact] = useLocalStorageFlag(COMPACT_KEY, false);
  const [reviewFirst, setReviewFirst] = useLocalStorageFlag(REVIEW_FIRST_KEY, true);

  const [isSaving, setSaving] = useState(false);
  const [isApproving, setApproving] = useState(false);
  const [exportCheck, setExportCheck] = useState<string[] | null>(null);

  // ---- parameters -------------------------------------------------------
  const persistFields = useCallback(
    async (next: InputField[]) => {
      await saveParameters(projectId, next.map((f) => inputFieldToParameterInput(f, user?.id ?? null)), { silent: true });
    },
    [projectId, user?.id],
  );

  const {
    fields, handleFieldChange, handleSwitchSpecification, handleFlag, flagError, clearFlagError,
  } = useParameterManager({ persist: persistFields, projectId });

  useEffect(() => {
    if (!flagError) return;
    toast.show(flagError, { severity: 'error' });
    clearFlagError();
  }, [flagError, clearFlagError]);

  const handleFlagAndRetry = useCallback(
    async (fieldId: string, reason: string) => {
      const newFlagId = await handleFlag(fieldId, true, reason);
      const field = fields.find((f) => f.id === fieldId);
      // handleFlag reports its own failure; a correction without its flag would
      // re-extract with nothing to correct against.
      if (!field || newFlagId === null) return;
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

  // ---- documents (AM12) -------------------------------------------------
  const viewer = useDocumentWorkspace(projectId, documents);
  const files = useDocumentFiles();
  // Matching cells of the open workbook's highlight, for the source bar's "Cell N of M".
  const matchInfo = useMatchInfo(projectId, viewer.activeId);
  const activeHighlight = viewer.activeId ? viewer.highlights[viewer.activeId] : undefined;
  const shownMatches = matchInfo && activeHighlight && matchInfo.nonce === activeHighlight.nonce ? matchInfo : undefined;

  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);
  const { jump } = viewer;
  // Reads fields through a ref so the table's handlers stay stable while values change.
  const onJumpToSource = useCallback(
    (s: SpecificationSource, fieldId?: string) => jump(s, fieldId ? fieldsRef.current.find((f) => f.id === fieldId) : undefined),
    [jump],
  );

  const isSpreadsheet = useCallback(
    (id: string | null | undefined) => {
      const doc = id ? documents.find((d) => d.id === id) : undefined;
      return !!doc && isSpreadsheetDocument(doc);
    },
    [documents],
  );

  const tableHandlers = useMemo(
    () => ({
      onJumpToSource,
      isSpreadsheet,
      onSelectCandidate: handleSwitchSpecification,
      onEdit: handleFieldChange,
      onFlag: (id: string, flagged: boolean, reason?: string | null) => void handleFlag(id, flagged, reason),
      onFlagAndRetry: (id: string, reason: string) => void handleFlagAndRetry(id, reason),
    }),
    [onJumpToSource, isSpreadsheet, handleSwitchSpecification, handleFieldChange, handleFlag, handleFlagAndRetry],
  );

  // ---- upload & analyze -------------------------------------------------
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const upload = useCallback(
    (files: File[]) => {
      const accepted = files.filter((f) => /\.(pdf|xlsx|xlsm)$/i.test(f.name));
      const skipped = files.length - accepted.length;
      if (skipped > 0) toast.show(`${skipped} file(s) skipped: only PDF and Excel (.xlsx, .xlsm) can be analysed.`, { severity: 'warning' });
      if (accepted.length) void jobRuntime.enqueue(createJob(projectId, { kind: 'upload', fileRefs: [] }), accepted);
    },
    [projectId],
  );

  const flaggedCount = fields.filter((f) => f.isFlagged).length;
  const handleAnalyze = () => {
    const iterative = flaggedCount > 0;
    void jobRuntime.enqueue(
      createJob(projectId, {
        kind: 'extraction',
        mode: iterative ? 'ITERATIVE' : 'BLIND',
        previousSpecs: iterative ? mapFieldsToSpecs(fields) : null,
      }),
    );
  };
  const extractionBusy = activity.running?.kind === 'extraction' || activity.queued?.job.kind === 'extraction';

  // ---- save / approve / export ------------------------------------------
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveParameters(projectId, fields.map((f) => inputFieldToParameterInput(f, user?.id ?? null)));
      toast.show('Saved.', { severity: 'success' });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Save failed.', { severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approveProject(projectId);
      toast.show('Parameters approved.', { severity: 'success' });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Approve failed.', { severity: 'error' });
    } finally {
      setApproving(false);
    }
  };

  const runExport = () => {
    setExportCheck(null);
    try {
      const { content, filename } = new FrontendBatteryFileExport().generate(fields, details?.alias_id ?? '');
      if (!content?.trim()) throw new Error('The export was empty.');
      const url = URL.createObjectURL(new Blob([content], { type: 'application/xml;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show(`Exported ${filename}.`, { severity: 'success' });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Export failed.', { severity: 'error' });
    }
  };

  // D8: list the mapped keys with no value before exporting.
  const handleExport = () => {
    const missing = missingExportKeys(fields);
    if (missing.length > 0) setExportCheck(missing);
    else runExport();
  };

  // ---- derived ----------------------------------------------------------
  const running = activity.running;
  const extractionJob = running && (running.kind === 'extraction' || running.kind === 'correction') ? running : undefined;
  const correctingFieldId =
    running?.payload.kind === 'correction' ? running.payload.parameterKey : null;
  const inFlightUploads = uploadJobs.some((j) => j.status === 'queued' || j.status === 'running');
  const noDocuments = !!details && documents.length === 0 && !inFlightUploads;
  const firstLoad = !details && detailsLoading;

  // ---- drop anywhere ----------------------------------------------------
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current += 1;
      setDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      upload(Array.from(e.dataTransfer.files));
    },
  };

  return (
    <Box
      {...(noDocuments ? {} : dropHandlers)}
      sx={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* ---- toolbar ---- */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        useFlexGap
        sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'border.subtle', bgcolor: 'surface.panel', flexWrap: 'wrap', minHeight: 52 }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={ACCEPT}
          onChange={(e) => {
            upload(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <Tooltip title={tray.running >= JOB_CAP ? 'This browser is busy; the upload will queue and start automatically.' : 'PDF and Excel (.xlsx, .xlsm). You can also drop files anywhere here.'}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => fileInput.current?.click()}>
            Add documents
          </Button>
        </Tooltip>
        <Tooltip
          title={
            !analyzeGate.allowed && 'reason' in analyzeGate
              ? analyzeGate.reason
              : documents.length === 0
                ? 'Add a document first'
                : flaggedCount > 0
                  ? `${flaggedCount} flagged parameter(s) will be sent back as an iterative correction`
                  : 'Extract every parameter from this project\'s documents'
          }
        >
          <span>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={handleAnalyze}
              loading={extractionBusy}
              loadingPosition="start"
              disabled={documents.length === 0 || !analyzeGate.allowed}
            >
              {flaggedCount > 0 ? `Analyze (${flaggedCount} flagged)` : 'Analyze'}
            </Button>
          </span>
        </Tooltip>

        <JobStatusLine projectId={projectId} />

        <Box sx={{ flex: 1 }} />

        <Button size="small" component={Link} href={`/projects/${projectId}/audit`} startIcon={<HistoryOutlinedIcon />} sx={{ color: 'text.secondary' }}>
          Runs
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={handleSave} loading={isSaving} loadingPosition="start" disabled={fields.length === 0}>
          Save
        </Button>
        <Button size="small" startIcon={<DoneAllIcon />} onClick={handleApprove} loading={isApproving} loadingPosition="start" disabled={fields.length === 0}>
          Approve
        </Button>
        <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={fields.length === 0}>
          Export .battery
        </Button>
      </Stack>

      {/* ---- body ---- */}
      {firstLoad ? (
        <Box sx={{ flex: 1, display: 'flex', gap: 0.75, p: 2 }} aria-busy="true">
          <Skeleton variant="rounded" sx={{ flex: 55, height: '100%' }} />
          <Skeleton variant="rounded" sx={{ flex: 45, height: '100%' }} />
        </Box>
      ) : noDocuments ? (
        <Box sx={{ flex: 1, p: 3, display: 'flex' }}>
          <Dropzone
            onFiles={upload}
            queuedHint={tray.running >= JOB_CAP}
            sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', '& .MuiSvgIcon-root': { fontSize: 56 } }}
          />
        </Box>
      ) : (
        <SplitPane
          storageKey="bda.workspace.split"
          label="Resize parameters and document"
          left={
            <ParameterTable
              projectId={projectId}
              fields={fields}
              canonical={canonical}
              loading={detailsLoading}
              job={extractionJob}
              correctingFieldId={correctingFieldId}
              correctionPhase={extractionJob?.kind === 'correction' ? extractionJob.phase : undefined}
              density={compact ? 'compact' : 'comfortable'}
              onDensityChange={(d) => setCompact(d === 'compact')}
              reviewFirst={reviewFirst}
              onReviewFirstChange={setReviewFirst}
              handlers={tableHandlers}
            />
          }
          right={
            <>
              <DocumentTabs documents={documents} activeId={viewer.activeId} onSelect={viewer.select} uploadJobs={uploadJobs} files={files} />
              {viewer.nav && (
                <SourceBar
                  key={`${viewer.nav.fieldId}-${viewer.nav.index}`}
                  nav={viewer.nav}
                  documents={documents}
                  activeId={viewer.activeId}
                  onCycle={viewer.cycle}
                  onClose={viewer.clearSource}
                  matches={shownMatches}
                  matchIndex={activeHighlight?.matchIndex ?? 0}
                  onStepMatch={(dir) => shownMatches && viewer.stepMatch(dir, shownMatches.count)}
                />
              )}
              <DocumentViewport
                projectId={projectId}
                documents={documents}
                activeId={viewer.activeId}
                mountedIds={viewer.mountedIds}
                highlights={viewer.highlights}
                files={files}
                uploadsInFlight={inFlightUploads}
                onRetry={(doc) => documentFiles.retry(projectId, doc)}
                onReload={(doc) => documentFiles.reload(projectId, doc)}
              />
            </>
          }
        />
      )}

      {/* ---- drop overlay ---- */}
      {dragOver && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 8,
            zIndex: 10,
            borderRadius: 2,
            border: '2px dashed',
            borderColor: 'accent.fill',
            bgcolor: 'accent.tint',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <CloudUploadOutlinedIcon sx={{ fontSize: 48, color: 'accent.text' }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mt: 1 }}>Drop to add to this project</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>PDF and Excel (.xlsx, .xlsm)</Typography>
        </Box>
      )}

      <ConfirmDialog
        open={exportCheck !== null}
        title={`${exportCheck?.length ?? 0} exported parameter(s) have no value`}
        description={`The .battery file will carry a placeholder (or, for the safety voltages, a value derived from U_MAX/U_MIN) for: ${exportCheck?.join(', ') ?? ''}.`}
        confirmLabel="Export anyway"
        onConfirm={runExport}
        onClose={() => setExportCheck(null)}
      />
    </Box>
  );
}
