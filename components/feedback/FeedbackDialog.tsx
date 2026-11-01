'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MenuItem, TextField } from '@mui/material';
import { submitFeedback } from '@/api/feedback';
import { FormDialog } from '@/components/ui/FormDialog';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errors';
import { buildFeedbackBody, projectIdFromPath, validateFeedback, type FeedbackParameter } from '@/lib/feedback/payload';
import { useProjectsIndex } from '@/lib/project-data/provider';

/**
 * Sends feedback to `POST /feedback/submit`. The project is the one in the
 * address; on a page outside a project (the list, the library) the person
 * picks it. Opened from the review screen it is pre-filled with the parameter.
 * Mount it only while open, so each opening starts with an empty form.
 */
export function FeedbackDialog({ onClose, parameter }: { onClose: () => void; parameter?: FeedbackParameter }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { projects } = useProjectsIndex();
  const fixedProjectId = projectIdFromPath(pathname);
  const [picked, setPicked] = useState('');
  const projectId = fixedProjectId ?? (picked || null);
  const [title, setTitle] = useState(parameter ? `Parameter ${parameter.alias || parameter.key}` : '');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const problem = validateFeedback({ projectId, description });
    if (problem || !projectId || !user) {
      setError(problem ?? 'Sign in to send feedback.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitFeedback(buildFeedbackBody({ userId: user.id, projectId, title, description, parameter }));
      toast.show('Thank you. Your feedback was sent.', { severity: 'success' });
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Feedback could not be sent. Try again.'));
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={parameter ? `Feedback on ${parameter.alias || parameter.key}` : 'Send feedback'}
      error={error}
      submitLabel="Send"
      onSubmit={() => void submit()}
      busy={busy}
    >
      {!fixedProjectId && (
        <TextField select required label="Project" value={picked} onChange={(e) => setPicked(e.target.value)}>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.alias_id}</MenuItem>
          ))}
        </TextField>
      )}
      <TextField label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField
        required
        autoFocus
        multiline
        minRows={4}
        label="Your feedback"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </FormDialog>
  );
}
