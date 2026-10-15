'use client';

import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import { Card } from '@/components/overview/Card';
import { toast } from '@/components/ui/Toast';
import { addAuditor, addContributor } from '@/lib/project-data/actions';
import { errorMessage } from '@/lib/errors';
import { UserNotFoundError } from '@/api/projects';

type Role = 'contributor' | 'auditor';

/** One "add a person" form. Explicit button types: the submit button submits, nothing else does. */
function AddMemberForm({ projectId, role }: { projectId: string; role: Role }) {
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
      await (role === 'contributor' ? addContributor : addAuditor)(projectId, trimmed);
      toast.show(`${trimmed} added as ${role}.`, { severity: 'success' });
      setUsername('');
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
 * Members (plan-A 6.8). Adding works; **listing does not**: no route returns a
 * project's members (backend item B8), so the list is a labelled placeholder.
 * There is no real authentication either (CLAUDE.md 4), so adding someone
 * here grants nothing the app enforces.
 */
export function MembersCard({ projectId }: { projectId: string }) {
  return (
    <Card title="Members" icon={GroupOutlinedIcon} id="members">
      <AddMemberForm projectId={projectId} role="contributor" />
      <AddMemberForm projectId={projectId} role="auditor" />
      <Alert severity="info" icon={false} variant="outlined" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Member list unavailable</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          The app cannot list a project&apos;s contributors or auditors, so who is already a member cannot be shown here.
          There is no sign-in check, so membership is a record, not a permission the app enforces.
        </Typography>
      </Alert>
    </Card>
  );
}
