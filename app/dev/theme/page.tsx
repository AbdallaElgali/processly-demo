'use client';

import { notFound } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { tokens } from '@/theme/tokens';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { useThemePreference } from '@/hooks/useThemePreference';

/**
 * Dev-only token preview. It exists so "both modes" can actually be reviewed:
 * the pre-redesign screens still import the deprecated colours shim and so stay
 * dark in light mode until their own step migrates them.
 *
 * Step 5 grows this into the full component gallery (plan-A section 2).
 */
export default function ThemePreviewPage() {
  const { mode, ready } = useThemePreference();

  if (process.env.NODE_ENV === 'production') notFound();

  const swatchGroups = [
    ['accent', tokens.light.accent],
    ['surface', tokens.light.surface],
    ['border', tokens.light.border],
    ['status', tokens.light.status],
  ] as const;

  return (
    <Box sx={{ p: 4, minHeight: '100dvh', bgcolor: 'surface.canvas' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ color: 'text.primary' }}>
          Theme tokens
        </Typography>
        <ThemeToggle />
        <Chip
          size="small"
          label={ready ? `mode: ${mode}` : 'mode: resolving'}
          sx={{ bgcolor: 'status.neutralBg', color: 'status.neutral' }}
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
        Every colour below is a palette token, so this page follows the colour
        scheme. Verified by <code>npm run check:contrast</code>.
      </Typography>

      {swatchGroups.map(([group, values]) => (
        <Box key={group} sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1.5 }}>
            {group}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {Object.keys(values)
              .filter((key) => !key.startsWith('$'))
              .map((key) => (
                <Paper
                  key={key}
                  elevation={0}
                  sx={{
                    width: 150,
                    p: 1.5,
                    border: 1,
                    borderColor: 'border.subtle',
                    bgcolor: 'surface.panel',
                  }}
                >
                  <Box
                    sx={{
                      height: 40,
                      borderRadius: 1,
                      mb: 1,
                      border: 1,
                      borderColor: 'border.subtle',
                      bgcolor: `${group}.${key}`,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {group}.{key}
                  </Typography>
                </Paper>
              ))}
          </Box>
        </Box>
      ))}

      <Divider sx={{ my: 4 }} />

      <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1.5 }}>
        Controls — tab through these to check the focus ring
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="contained">Contained</Button>
        <Button variant="outlined">Outlined</Button>
        <Button variant="text">Text</Button>
        <Button variant="contained" disabled>
          Disabled
        </Button>
        <TextField size="small" label="Input" defaultValue="4.2" />
        <Switch defaultChecked />
        <Chip label="Chip" />
      </Stack>

      <Divider sx={{ my: 4 }} />

      <Typography variant="subtitle2" sx={{ color: 'text.muted', mb: 1.5 }}>
        Document surface — stays light in both modes (CLAUDE.md 8.3)
      </Typography>
      <Box sx={{ p: 3, bgcolor: 'document.canvas', borderRadius: 1 }}>
        <Box
          sx={{
            p: 3,
            bgcolor: 'document.page',
            color: 'document.text',
            border: 1,
            borderColor: 'document.gridLine',
            position: 'relative',
            maxWidth: 420,
          }}
        >
          <Typography variant="body2" sx={{ color: 'document.text' }}>
            Nennkapazitat: 4.2 Ah
          </Typography>
          <Box
            sx={{
              position: 'absolute',
              inset: '8px 8px auto 8px',
              height: 28,
              border: 2,
              borderColor: 'document.highlightStroke',
              bgcolor: 'document.highlightFill',
              borderRadius: 0.5,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
