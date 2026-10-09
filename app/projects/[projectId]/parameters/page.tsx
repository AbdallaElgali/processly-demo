'use client';

import { useParams } from 'next/navigation';
import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';

export default function ParametersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ScreenPlaceholder
      title="Parameters"
      step="Step 11"
      summary="This project's parameter schema and the extraction templates it came from."
      routes={['GET /extraction-templates/parameters', 'PATCH /projects/project-parameter/{id}/', 'GET /extraction-templates/user/{id}']}
      action={{ label: 'Review parameters', href: `/projects/${projectId}/review` }}
    />
  );
}
