'use client';

import { useCallback, useState } from 'react';
import { Button, Chip, Skeleton, Stack, TextField, Typography } from '@mui/material';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import { Card } from '@/components/overview/Card';
import { toast } from '@/components/ui/Toast';
import { addAuditor, addContributor } from '@/lib/project-data/actions';
import { errorMessage } from '@/lib/errors';
import { UserNotFoundError } from '@/api/projects';
import { fetchMembers } from '@/api/roles';
import { useResource } from '@/hooks/useResource';
import { useControl } from '@/components/shell/ProjectAccessProvider';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatAdded, groupMembers } from '@/lib/members/members';

type Role = 'contributor' | 'auditor';

/** One "add a person" form. Explicit button types: the submit button submits, nothing else does. */
function AddMemberForm({ projectId, role, onAdded }: { projectId: string; role: Role; onAdded: () => void }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = username.trim();
  const inputId = `add-${role}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await (role === 'contributor' ? addContributor : addAuditor)(projectId, trimmed);
      if (result.alreadyMember) {
        // The role is never changed by this form.
        toast.show(`${trimmed} is already a member${result.role ? ` (${result.role.toLowerCase()})` : ''}; their role was not changed.`, { severity: 'info' });
      } else {
        toast.show(`${trimmed} added as ${role}.`, { severity: 'success' });
      }
      setUsername('');
      onAdded();
    } catch (e) {
      setError(e instanceof UserNotFoundError ? 'User not found. Check the username; people must have registered first.' : errorMessage(e, `Could not add the ${role}.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack component="form" onSubmit={submit} noValidate direction="row" spacing={1} alignItems="flex-start" useFlexGap sx={{ flexWrap: 'wrap' }}>
      <TextField
        id={inputId}
        size="small"
        label={`${role === 'contributor' ? 'Contributor' : 'Auditor'} username`}
        value={username}
        onChange={(e) => { setUsername(e.target.value); if (error) setError(null); }}
        disabled={busy}
        error={!!error}
        helperText={error ?? ' '}
        autoComplete="off"
        sx={{ flex: 1, minWidth: 200 }}
      />
      <Button type="submit" variant="outlined" disabled={!trimmed} loading={busy} sx={{ mt: '1px', height: 40 }}>
        Add {role}
      </Button>
    </Stack>
  );
}

/**
 * Members: the read-only list from `GET /projects/{id}/members`, grouped by
 * role, and the add forms, which only an author sees (`manage_members`).
 * Removing people and changing roles are not built here.
 */
export function MembersCard({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => fetchMembers(projectId, signal), [projectId]);
  const { data, error, loading, reload } = useResource(load, 'Could not load the members.');
  const canManage = useControl('manageMembers').enabled;
  const groups = data ? groupMembers(data.members) : [];

  return (
    <Card title="Members" icon={GroupOutlinedIcon} id="members">
      {canManage && (
        <>
          <AddMemberForm projectId={projectId} role="contributor" onAdded={reload} />
          <AddMemberForm projectId={projectId} role="auditor" onAdded={reload} />
        </>
      )}
      {loading && <Skeleton variant="rounded" height={72} />}
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
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
    </Card>
  );
}
