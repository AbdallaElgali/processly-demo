'use client';

import { IconButton, Tooltip } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import { useThemePreference, type ThemeMode } from '@/hooks/useThemePreference';

const NEXT_LABEL: Record<ThemeMode, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
};

const CURRENT_LABEL: Record<ThemeMode, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System mode',
};

const ICON: Record<ThemeMode, typeof LightModeOutlinedIcon> = {
  light: LightModeOutlinedIcon,
  dark: DarkModeOutlinedIcon,
  system: SettingsBrightnessOutlinedIcon,
};

/**
 * The quick toggle required in the shell header by CLAUDE.md 8.3. It cycles
 * light -> dark -> system; the full three-way control lives in Settings.
 *
 * Until hydration the preference is unknown (the server cannot read the OS
 * setting), so the button renders disabled with a neutral icon rather than
 * guessing a mode and flipping on hydration.
 */
export function ThemeToggle() {
  const { mode, ready, cycleThemeMode } = useThemePreference();

  const Icon = ready ? ICON[mode] : SettingsBrightnessOutlinedIcon;
  const label = ready ? NEXT_LABEL[mode] : 'Theme';

  return (
    <>
      <Tooltip title={label}>
        {/* A disabled IconButton does not fire the events Tooltip listens for,
            so the span keeps the tooltip reachable before hydration. */}
        <span>
          <IconButton
            onClick={cycleThemeMode}
            disabled={!ready}
            aria-label={label}
            size="small"
            sx={{ color: 'text.secondary', '&:hover': { color: 'accent.text' } }}
          >
            <Icon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {/* Announces the result of the change, since the icon alone is not
          conveyed to a screen reader after activation. */}
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {ready ? CURRENT_LABEL[mode] : ''}
      </span>
    </>
  );
}
