'use client';

import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';

export default function PromptsAndModelsPage() {
  return (
    <ScreenPlaceholder
      title="Prompts & Models"
      step="Step 13"
      summary="Which prompt versions and models this project pinned, and what the next run would resolve."
      routes={['GET /projects/{id}/prompt-pins', 'GET /projects/{id}/prompt-resolution', 'GET /prompts/slots']}
    />
  );
}
