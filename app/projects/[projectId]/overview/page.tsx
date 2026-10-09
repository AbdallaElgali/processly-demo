'use client';

import { useParams } from 'next/navigation';
import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ScreenPlaceholder
      title="Overview"
      step="Step 12"
      summary="Project status, document and parameter counts, and the last extraction run."
      routes={['GET /projects/{id}', 'GET /projects/{id}/extraction-runs']}
      action={{ label: 'Go to Extract', href: `/projects/${projectId}/extract` }}
    />
  );
}
