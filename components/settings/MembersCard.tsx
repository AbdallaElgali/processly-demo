'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, MenuItem, Select, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import { Card } from '@/components/overview/Card';
import { toast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchMembers } from '@/api/roles';
import { useResource } from '@/hooks/useResource';
import { useAuth } from '@/contexts/AuthContext';
import { useControl, useReloadAccess } from '@/components/shell/ProjectAccessProvider';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatAdded, groupMembers, type Member, type MembersResponse } from '@/lib/members/members';
import { addMemberOutcomeText, memberErrorText, memberRowControls, removeConfirmText } from '@/lib/members/manage';
import { runAddMember, runChangeRole, runRemoveMember, type MemberRefresh } from '@/lib/members/actions';
import type { Role } from '@/lib/permissions/access';

const ROLE_OPTIONS: { role: Role; label: string }[] = [
  { role: 'AUTHOR', label: 'Author' },
  { role: 'CONTRIBUTOR', label: 'Contributor' },
  { role: 'AUDITOR', label: 'Auditor' },
];

/** One "add a person" form: username plus role. Explicit button types: the submit button submits, nothing else does. */
function AddMemberForm({ projectId, refresh }: { projectId: string; refresh: MemberRefresh }) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('CONTRIBUTOR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = username.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runAddMember(projectId, trimmed, role, refresh);
      toast.show(addMemberOutcomeText(trimmed, result, role), { severity: result.alreadyMember ? 'info' : 'success' });
      setUsername('');
    } catch (e) {
      setError(memberErrorText(e, 'add'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack component="form" onSubmit={submit} noValidate direction="row" spacing={1} alignItems="flex-start" useFlexGap sx={{ flexWrap: 'wrap' }}>
      <TextField
        id="add-member"
        size="small"
        label="Username"
        value={username}
        onChange={(e) => { setUsername(e.target.value); if (error) setError(null); }}
        disabled={busy}
        error={!!error}
        helperText={error ?? ' '}
        autoComplete="off"
        sx={{ flex: 1, minWidth: 200 }}
      />
      <TextField
        select
        size="small"
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        disabled={busy}
        sx={{ minWidth: 150 }}
      >
        {ROLE_OPTIONS.map((o) => <MenuItem key={o.role} value={o.role}>{o.label}</MenuItem>)}
      </TextField>
      <Button type="submit" variant="outlined" disabled={!trimmed} loading={busy} sx={{ mt: '1px', height: 40 }}>
        Add member
      </Button>
    </Stack>
  );
}

/** Role menu and Remove for one row (authors only). */
function ManageControls({ member, counts, busy, onRole, onRemove }: {
  member: Member;
  counts: MembersResponse['counts'];
  busy: boolean;
  onRole: (role: Role) => void;
  onRemove: () => void;
}) {
  const controls = memberRowControls(member, counts);
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip title={controls.roleMenu.reason ?? ''} disableHoverListener={controls.roleMenu.enabled}>
        <span>
          <Select
            size="small"
            value={member.role}
            onChange={(e) => onRole(e.target.value as Role)}
            disabled={!controls.roleMenu.enabled || busy}
            inputProps={{ 'aria-label': `Role of ${member.username}` }}
            sx={{ minWidth: 140, height: 32 }}
          >
            {ROLE_OPTIONS.map((o) => <MenuItem key={o.role} value={o.role}>{o.label}</MenuItem>)}
          </Select>
        </span>
      </Tooltip>
      <Tooltip title={controls.remove.reason ?? ''} disableHoverListener={controls.remove.enabled}>
        <span>
          <Button type="button" size="small" color="error" variant="text" disabled={!controls.remove.enabled || busy} onClick={onRemove} aria-label={`Remove ${member.username}`}>
            Remove
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
}

/**
 * Members: the list from `GET /projects/{id}/members`, grouped by role. An
 * author (`manage_members`) also gets the add form, a role menu per person and
 * Remove; everyone else sees the list only. After every change the list and
 * the caller's own permissions are read again.
 */
export function MembersCard({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => fetchMembers(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the members.');
  const canManage = useControl('manageMembers').enabled;
  const reloadAccess = useReloadAccess();
  const { user } = useAuth();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const groups = data ? groupMembers(data.members) : [];
  const refresh: MemberRefresh = { members: reload, access: reloadAccess };

  const changeRole = async (m: Member, role: Role) => {
    if (role === m.role) return;
    setBusyId(m.user_id);
    try {
      await runChangeRole(projectId, m.user_id, role, refresh);
      toast.show(`${m.username} is now ${role.toLowerCase()}.`, { severity: 'success' });
    } catch (e) {
      toast.show(memberErrorText(e, 'change'), { severity: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    const m = removing;
    if (!m) return;
    setBusyId(m.user_id);
    try {
      const { selfRemoved } = await runRemoveMember(projectId, m.user_id, user?.id ?? null, refresh);
      setRemoving(null);
      toast.show(selfRemoved ? 'You left the project.' : `${m.username} removed.`, { severity: 'success' });
      if (selfRemoved) router.push('/projects');
    } catch (e) {
      setRemoving(null);
      toast.show(memberErrorText(e, 'remove'), { severity: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Members" icon={GroupOutlinedIcon} id="members">
      {canManage && <AddMemberForm projectId={projectId} refresh={refresh} />}
      {loading && !data && <Skeleton variant="rounded" height={72} />}
      {error && <ErrorState title="Members unavailable" description={error} onRetry={reload} />}
      {groups.map((g) => (
        <Stack key={g.role} component="section" aria-label={g.title} spacing={0.5}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>{g.title} ({g.members.length})</Typography>
          <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {g.members.map((m) => (
              <Stack key={m.user_id} component="li" direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{m.username}</Typography>
                {m.is_creator && <Chip size="small" variant="outlined" label="creator" sx={{ height: 20 }} />}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{m.department ?? 'No department'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.muted', ml: 'auto' }}>Added {formatAdded(m.assigned_at)}</Typography>
                {canManage && data && (
                  <ManageControls member={m} counts={data.counts} busy={busyId === m.user_id} onRole={(r) => void changeRole(m, r)} onRemove={() => setRemoving(m)} />
                )}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
      <ConfirmDialog
        open={!!removing}
        title={removing ? `Remove ${removing.username}?` : 'Remove member?'}
        description={removing ? removeConfirmText(removing.username, removing.user_id === user?.id) : undefined}
        confirmLabel="Remove"
        destructive
        busy={!!removing && busyId === removing.user_id}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
}
