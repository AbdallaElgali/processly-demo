'use client';

import { ScreenPlaceholder } from '@/components/shell/ScreenPlaceholder';

export default function SettingsPage() {
  return (
    <ScreenPlaceholder
      title="Settings"
      step="Step 12"
      summary="Appearance, project members and project status."
      routes={['POST /projects/{id}/contributors', 'POST /projects/{id}/auditors', 'POST /projects/update-project-status']}
    />
  );
}
