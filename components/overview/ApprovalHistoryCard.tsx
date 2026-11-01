'use client';

import { useCallback, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { useResource } from '@/hooks/useResource';
import { loadApproval, loadApprovals } from '@/lib/approvals/history';
import { approvalRows } from '@/lib/approvals/view';
import type { Approval } from '@/api/types/approvals';
import { Card } from './Card';

const when = (iso: string) => new Date(iso).toLocaleString();

/**
 * Approval history: every approval version of the project, newest first.
 * Versions are immutable on the backend; each one opens read-only.
 * `approvalVersion` is the project's latest version, so a new approval
 * reloads the list.
 */
export function ApprovalHistoryCard({ projectId, approvalVersion }: { projectId: string; approvalVersion: number | null }) {
  const load = useCallback(() => {
    void approvalVersion;
    return loadApprovals(projectId);
  }, [projectId, approvalVersion]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the approval history.');
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Card title="Approval history" icon={VerifiedOutlinedIcon} id="approval-history" sx={{ gridColumn: '1 / -1' }}>
      {loading ? (
        <Skeleton variant="rounded" height={64} aria-label="Loading the approval history" />
      ) : error ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}>{error}</Alert>
      ) : !data || data.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.muted' }}>This project has not been approved yet.</Typography>
      ) : (
        <ApprovalTable approvals={data} onOpen={setOpen} />
      )}
      <VersionDialog projectId={projectId} version={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function ApprovalTable({ approvals, onOpen }: { approvals: Approval[]; onOpen: (version: number) => void }) {
  return (
    <Table size="small" aria-label="Approval versions">
      <TableHead>
        <TableRow>
          <TableCell>Version</TableCell>
          <TableCell>Approved by</TableCell>
          <TableCell>When</TableCell>
          <TableCell>Note</TableCell>
          <TableCell align="right">Parameters</TableCell>
          <TableCell align="right">Flags resolved</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {approvals.map((a) => (
          <TableRow key={a.id} hover>
            <TableCell>
              <Button size="small" onClick={() => onOpen(a.version)} aria-label={`Open version ${a.version}`}>v{a.version}</Button>
            </TableCell>
            <TableCell>{a.approved_by_username}</TableCell>
            <TableCell>{when(a.approved_at)}</TableCell>
            <TableCell sx={{ color: a.note ? 'text.primary' : 'text.muted' }}>{a.note || '—'}</TableCell>
            <TableCell align="right">{a.item_count}</TableCell>
            <TableCell align="right">{a.flags_resolved_count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A read-only view of one version's items. */
function VersionDialog({ projectId, version, onClose }: { projectId: string; version: number | null; onClose: () => void }) {
  const load = useCallback(
    () => (version === null ? Promise.resolve(null) : loadApproval(projectId, version)),
    [projectId, version],
  );
  const { data, error, loading, reload } = useResource(load, 'Could not load this version.');
  const rows = data ? approvalRows(data.items) : [];

  return (
    <Dialog open={version !== null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Approval version {version}
        {data && (
          <Typography variant="body2" component="div" sx={{ color: 'text.secondary' }}>
            {data.approval.approved_by_username} · {when(data.approval.approved_at)}
            {data.approval.note ? ` · ${data.approval.note}` : ''}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {version === null || loading ? (
          <Skeleton variant="rounded" height={120} />
        ) : error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}>{error}</Alert>
        ) : (
          <Table size="small" aria-label={`Parameters in version ${version}`}>
            <TableHead>
              <TableRow>
                <TableCell>Parameter</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Origin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                      <span>{r.name}</span>
                      {r.removed && <Typography variant="caption" sx={{ color: 'text.muted', fontStyle: 'italic' }}>removed from project</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: r.value === 'No value' ? 'text.muted' : 'text.primary' }}>{r.value}</TableCell>
                  <TableCell>{r.origin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
