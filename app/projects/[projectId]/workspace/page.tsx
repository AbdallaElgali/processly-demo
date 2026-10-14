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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { useAuth } from '@/contexts/AuthContext';
import { useDocumentWorkspace } from '@/hooks/useDocumentWorkspace';
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
import { FrontendBatteryFileExport, exportReport, type ExportReport } from '@/static/battery-template';
import type { SpecificationSource } from '@/types';
import { mapFieldsToSpecs } from '@/lib/parameter-adapter';
import { useCanStart, useJobTray, useJobs, useProjectActivity, useProjectData } from '@/lib/jobs/hooks';
import {
  acceptRow, chooseCandidate, editRowValue, flagAndReextract, flagRow, removeFlag, reextractRow, revertRowValue,
  saveAndApprove, saveChanges,
} from '@/lib/review/actions';
import { approvalCheck, approveBlockReason } from '@/lib/review/approval';
import { errorMessage } from '@/lib/errors';
import { COMPACT_KEY, REVIEW_FIRST_KEY } from '@/lib/review/preferences';
import type { RowBusy } from '@/components/workspace/ParameterRow';
import { JOB_CAP } from '@/lib/jobs/config';
import { createJob, jobRuntime } from '@/lib/jobs/runtime';

const ACCEPT = '.pdf,.xlsx,.xlsm';

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

  const [isApproving, setApproving] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [exportCheck, setExportCheck] = useState<ExportReport | null>(null);

  // ---- parameters and review actions (step 10) --------------------------
  // The actions live in lib/review/actions.ts, keyed by project, so a flag
  // still posting when the user leaves lands in the right project.
  const fields = useMemo(() => projectState?.fields ?? [], [projectState?.fields]);
  const dirty = projectState?.dirty ?? EMPTY;
  const rowOps = projectState?.rowOps;
  const isSaving = projectState?.loading.save ?? false;
  const userId = user?.id ?? null;

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

  const documentName = useCallback(
    (id: string | null | undefined) => (id ? documents.find((d) => d.id === id)?.name ?? null : null),
    [documents],
  );

  const tableHandlers = useMemo(
    () => ({
      onJumpToSource,
      isSpreadsheet,
      documentName,
      onSelectCandidate: (key: string, specId: string) => void chooseCandidate(projectId, key, specId),
      onEdit: (key: string, value: string, unit: string) => editRowValue(projectId, key, value, unit),
      onRevert: (key: string) => revertRowValue(projectId, key),
      onFlag: (key: string, reason: string) => {
        if (userId) void flagRow(projectId, key, userId, reason);
      },
      onFlagAndReextract: (key: string, reason: string) => {
        if (userId) void flagAndReextract(projectId, key, userId, reason);
      },
      onReextract: (key: string, hint: string) => reextractRow(projectId, key, hint),
      onRemoveFlag: (key: string) => void removeFlag(projectId, key, userId),
      onAccept: (key: string) => void acceptRow(projectId, key, userId),
    }),
    [onJumpToSource, isSpreadsheet, documentName, projectId, userId],
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
  // Save sends only the rows with unsaved edits, each with its real review
  // state (lib/parameter-adapter.ts), so saving never un-approves a row.
  const handleSave = async () => {
    try {
      const n = await saveChanges(projectId, userId);
      toast.show(n === 1 ? 'Saved 1 parameter.' : `Saved ${n} parameters.`, { severity: 'success' });
    } catch (e) {
      toast.show(`Save failed: ${errorMessage(e)}. Your edits are still here; try again.`, { severity: 'error' });
    }
  };

  const handleApprove = async () => {
    setApproveOpen(false);
    setApproving(true);
    try {
      const n = await saveAndApprove(projectId, userId);
      toast.show(n === 1 ? 'Approved 1 parameter.' : `Approved ${n} parameters.`, { severity: 'success' });
    } catch (e) {
      toast.show(`Approve failed: ${errorMessage(e)}`, { severity: 'error' });
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
    const report = exportReport(fields);
    if (report.missing.length + report.unconvertible.length > 0) setExportCheck(report);
    else runExport();
  };

  // ---- derived ----------------------------------------------------------
  const running = activity.running;
  const extractionJob = running && (running.kind === 'extraction' || running.kind === 'correction') ? running : undefined;

  // Row-level loading only (CLAUDE.md 8.1): a backend call or a correction job
  // marks its own row and nothing else.
  const rowBusy = useMemo(() => {
    const out: Record<string, RowBusy> = {};
    for (const j of jobs) {
      if (j.projectId !== projectId || j.payload.kind !== 'correction') continue;
      if (j.status === 'queued') out[j.payload.parameterKey] = { kind: 'queued' };
      // The job starts in the generic "routing" phase; a single-parameter
      // correction never routes, so its phase is shown once events arrive.
      else if (j.status === 'running') out[j.payload.parameterKey] = { kind: 'correcting', phase: j.events.length > 0 ? j.phase : undefined };
    }
    for (const [key, op] of Object.entries(rowOps ?? {})) out[key] = { kind: op };
    return out;
  }, [jobs, projectId, rowOps]);

  const parameterJobBusy = jobs.some(
    (j) => j.projectId === projectId && (j.kind === 'extraction' || j.kind === 'correction') && (j.status === 'queued' || j.status === 'running'),
  );
  // Rows a correction is about to replace are not saved (lib/review/actions.ts rowsToSave).
  const unsaved = dirty.filter((k) => rowBusy[k]?.kind !== 'queued' && rowBusy[k]?.kind !== 'correcting').length;
  const approval = useMemo(() => approvalCheck(fields, { unsaved, jobBusy: parameterJobBusy }), [fields, unsaved, parameterJobBusy]);
  const approveBlocked = approveBlockReason(approval);
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

        <Button size="small" component={Link} href={`/projects/${projectId}/audit?tab=runs`} startIcon={<HistoryOutlinedIcon />} sx={{ color: 'text.secondary' }}>
          Runs
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title={unsaved > 0 ? `Save ${unsaved} edited parameter${unsaved === 1 ? '' : 's'}` : 'No unsaved changes'}>
          <span>
            <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={() => void handleSave()} loading={isSaving} loadingPosition="start" disabled={unsaved === 0}>
              {unsaved > 0 ? `Save (${unsaved})` : 'Save'}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={approveBlocked ?? 'Accept every pending parameter of this project'}>
          <span>
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={() => setApproveOpen(true)}
              loading={isApproving}
              loadingPosition="start"
              disabled={fields.length === 0 || !!approveBlocked}
            >
              Approve
            </Button>
          </span>
        </Tooltip>
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
              loading={detailsLoading}
              job={extractionJob?.kind === 'extraction' ? extractionJob : undefined}
              rowBusy={rowBusy}
              dirty={dirty}
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
        open={approveOpen}
        title={`Approve ${details?.alias_id ?? 'this project'}?`}
        description={<ApproveSummary check={approval} />}
        confirmLabel={approval.unsaved > 0 ? 'Save and approve' : 'Approve'}
        onConfirm={() => void handleApprove()}
        onClose={() => setApproveOpen(false)}
      />

      <ConfirmDialog
        open={exportCheck !== null}
        title={`${(exportCheck?.missing.length ?? 0) + (exportCheck?.unconvertible.length ?? 0)} exported parameter(s) will carry a placeholder`}
        description={exportCheckText(exportCheck)}
        confirmLabel="Export anyway"
        onConfirm={runExport}
        onClose={() => setExportCheck(null)}
      />
    </Box>
  );
}

/** The pre-export dialog text: exactly the keys written as the placeholder, and why. */
function exportCheckText(report: ExportReport | null): string {
  if (!report) return '';
  const parts: string[] = [];
  if (report.missing.length > 0) parts.push(`no value: ${report.missing.join(', ')}`);
  for (const { key, unit } of report.unconvertible) parts.push(`unit not convertible: ${key} (${unit})`);
  return `The .battery file will carry a placeholder for these parameters. ${parts.join('. ')}.`;
}

const EMPTY: readonly string[] = [];

/**
 * The approval confirmation: what Approve does, and the machine's doubts
 * (auto-flags), which warn but do not block (open human flags block; the
 * button is disabled before this dialog can open).
 */
function ApproveSummary({ check }: { check: ReturnType<typeof approvalCheck> }) {
  const list = (keys: string[]) => (keys.length > 6 ? `${keys.slice(0, 6).join(', ')} and ${keys.length - 6} more` : keys.join(', '));
  return (
    <Stack spacing={1.25} component="span" sx={{ display: 'flex' }}>
      <Typography component="span" variant="body2">
        {check.pending === 1 ? '1 pending parameter becomes' : `${check.pending} pending parameters become`} accepted. Approving
        does not lock the project: a later Save or re-extraction returns the rows it touches to pending.
      </Typography>
      {check.unsaved > 0 && (
        <Typography component="span" variant="body2">
          <strong>{check.unsaved} unsaved edit{check.unsaved === 1 ? '' : 's'}</strong> will be saved first.
        </Typography>
      )}
      {check.bounds.length > 0 && (
        <Stack component="span" direction="row" spacing={1} alignItems="flex-start" sx={{ display: 'flex', color: 'status.warning' }}>
          <WarningAmberIcon sx={{ fontSize: 18, mt: 0.1 }} aria-hidden />
          <Typography component="span" variant="body2" sx={{ color: 'text.primary' }}>
            <strong>{check.bounds.length} value{check.bounds.length === 1 ? ' is' : 's are'} out of bounds</strong> (auto-flag, raised by the backend):{' '}
            {list(check.bounds)}.
          </Typography>
        </Stack>
      )}
      {check.needsReview.length > 0 && (
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
          {check.needsReview.length} still marked for review: {list(check.needsReview)}.
        </Typography>
      )}
      {check.empty.length > 0 && (
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
          {check.empty.length} without a value.
        </Typography>
      )}
    </Stack>
  );
}
