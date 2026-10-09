'use client';

import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import ViewCompactOutlinedIcon from '@mui/icons-material/ViewCompactOutlined';
import ViewComfyOutlinedIcon from '@mui/icons-material/ViewComfyOutlined';

export type Density = 'comfortable' | 'compact';

/**
 * Comfortable / compact, for the Review table (step 8) and anywhere else a
 * dense list earns the option. Controlled: the caller owns persistence (e.g.
 * `useLocalStorageFlag`), since different screens key it independently.
 */
export function DensityToggle({ value, onChange }: { value: Density; onChange: (next: Density) => void }) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={(_, next: Density | null) => next && onChange(next)}
      aria-label="Row density"
    >
      <ToggleButton value="comfortable" aria-label="Comfortable rows">
        <Tooltip title="Comfortable">
          <ViewComfyOutlinedIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="compact" aria-label="Compact rows">
        <Tooltip title="Compact">
          <ViewCompactOutlinedIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
