'use client';

import { ReactElement } from 'react';
import { Tooltip } from '@mui/material';
import { useControl } from '@/components/shell/ProjectAccessProvider';
import type { Control } from '@/lib/permissions/access';

/**
 * Wraps one control: when the person's permissions do not include it, the
 * control is disabled and a tooltip says why. The wrapper span makes the
 * tooltip work on a disabled button.
 */
export function Gated({ control, children }: { control: Control; children: (disabled: boolean) => ReactElement }) {
  const { enabled, reason } = useControl(control);
  const child = children(!enabled);
  if (enabled || !reason) return child;
  return (
    <Tooltip title={reason}>
      <span style={{ display: 'inline-flex' }}>{child}</span>
    </Tooltip>
  );
}
