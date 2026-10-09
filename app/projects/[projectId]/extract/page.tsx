'use client';

import { useParams } from 'next/navigation';
import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';

export default function ExtractPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ScreenPlaceholder
      title="Extract"
      step="Step 7"
      summary="Upload documents and run an extraction, with the full run timeline and a card per category."
      routes={['POST /files/upload-documents/', 'POST /specs/stream-specs', 'GET /projects/{id}/extraction-runs']}
      action={{ label: 'Review parameters', href: `/projects/${projectId}/review` }}
    />
  );
}
