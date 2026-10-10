'use client';

import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Card, Fact } from '@/components/overview/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { getUserTemplates } from '@/api/templates';
import type { FullProjectDetails } from '@/api/types/projects';

type TemplateLookup = { key: string; name: string | null; failed: boolean };

/** The name of the template the project was made from, via the user's template list (the project only carries its id). */
function useTemplateName(templateId: string | null, userId: string | null): { loading: boolean; name: string | null; failed: boolean } {
  const key = `${userId}:${templateId}`;
  const [lookup, setLookup] = useState<TemplateLookup | null>(null);

  useEffect(() => {
    if (!templateId || !userId) return;
    let live = true;
    getUserTemplates(userId)
      .then((list) => live && setLookup({ key, name: list.find((t) => t.id === templateId)?.name ?? null, failed: false }))
      .catch(() => live && setLookup({ key, name: null, failed: true }));
    return () => {
      live = false;
    };
  }, [key, templateId, userId]);

  if (!templateId || !userId) return { loading: false, name: null, failed: false };
  if (lookup?.key !== key) return { loading: true, name: null, failed: false };
  return { loading: false, name: lookup.name, failed: lookup.failed };
}

/**
 * The project's fixed facts. Read-only: the backend has no route that changes
 * a project's alias or description, and the status change is switched off (B22).
 */
export function ProjectDetailsCard({ details, userId }: { details: FullProjectDetails; userId: string | null }) {
  const template = useTemplateName(details.source_template_id, userId);
  return (
    <Card title="Project details" icon={InfoOutlinedIcon} id="project-details">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1.5 }}>
        <Fact label="Name">{details.alias_id}</Fact>
        <Fact label="Status"><StatusChip status={details.status} /></Fact>
        <Fact label="Created">{new Date(details.created_at).toLocaleDateString()}</Fact>
        <Fact label="Template used">
          {!details.source_template_id
            ? <Typography component="span" variant="body2" sx={{ color: 'text.muted', fontStyle: 'italic' }}>None (made without a template)</Typography>
            : template.loading
              ? <Typography component="span" variant="body2" sx={{ color: 'text.muted' }}>Loading…</Typography>
              : template.name
                ? template.name
                : <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                    {template.failed ? 'Could not load templates' : 'Not in your template list'} (id {details.source_template_id.slice(0, 8)}…)
                  </Typography>}
        </Fact>
      </Box>
      <Fact label="Description">
        {details.description || <Typography component="span" variant="body2" sx={{ color: 'text.muted', fontStyle: 'italic' }}>No description.</Typography>}
      </Fact>
      <Typography variant="caption" sx={{ color: 'text.muted' }}>
        Read-only: the backend has no route to change a project&apos;s name or description. The status is shown as stored; changing it is off for now (backend B22).
      </Typography>
    </Card>
  );
}
