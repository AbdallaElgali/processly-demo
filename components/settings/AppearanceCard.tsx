'use client';

import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import { Card } from '@/components/overview/Card';
import { useThemePreference, type ThemeMode } from '@/hooks/useThemePreference';

const OPTIONS: { value: ThemeMode; label: string; icon: typeof LightModeOutlinedIcon }[] = [
  { value: 'light', label: 'Light', icon: LightModeOutlinedIcon },
  { value: 'dark', label: 'Dark', icon: DarkModeOutlinedIcon },
  { value: 'system', label: 'System', icon: SettingsBrightnessOutlinedIcon },
];

/**
 * The main theme control (CLAUDE.md 8.3); the header toggle is the quick
 * version. The choice is applied at once, kept in this browser by MUI, and
 * saved to the account's `user_settings.theme` by `useThemePreference`.
 */
export function AppearanceCard() {
  const { mode, ready, setThemeMode } = useThemePreference();
  return (
    <Card title="Appearance" icon={PaletteOutlinedIcon} id="appearance">
      <ToggleButtonGroup
        exclusive
        size="small"
        value={ready ? mode : null}
        disabled={!ready}
        aria-label="Colour mode"
        onChange={(_, next: ThemeMode | null) => next && setThemeMode(next)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <ToggleButton key={value} value={value} sx={{ gap: 0.75, px: 2, textTransform: 'none' }}>
            <Icon fontSize="small" aria-hidden />
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" sx={{ color: 'text.muted' }}>
        System follows your operating system&apos;s setting. Saved to your account and remembered in this browser.
        Documents stay light in both modes, because they are the document.
      </Typography>
    </Card>
  );
}
