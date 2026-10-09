'use client';

import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';

export default function AuditPage() {
  return (
    <ScreenPlaceholder
      title="Audit"
      step="Step 13"
      summary="Per-parameter history: every candidate, flag and run that produced the current value."
      routes={['GET /audit/project/{id}', 'GET /audit/project/{id}/parameter/{key}/lineage', 'GET /projects/{id}/extraction-runs']}
    />
  );
}
