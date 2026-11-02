'use client';

import { Chip } from '@mui/material';
import { useMyRole } from '@/components/shell/ProjectAccessProvider';
import { roleBadge, type Role } from '@/lib/permissions/access';

/** The caller's role as a small badge; renders nothing when there is no role. */
export function RoleBadge({ role }: { role: Role | null | undefined }) {
  const badge = roleBadge(role);
  if (!badge) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={badge.label}
      title={`Your role in this project: ${badge.label}`}
      sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', borderColor: 'border.subtle' }}
    />
  );
}

/** The badge for the open project (from `GET /projects/{id}/me`). */
export function ProjectRoleBadge() {
  return <RoleBadge role={useMyRole()} />;
}
