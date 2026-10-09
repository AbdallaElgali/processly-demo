'use client';

import { Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * The Workspace's keyboard shortcuts (`?`, plan-A 6.4, AM12).
 *
 * Document and source keys are single unmodified keys, active whenever focus
 * is not in a text field or menu. They were chosen to avoid browser and OS
 * bindings in Chrome, Edge and Firefox on Windows (Alt+arrows navigate
 * history, Ctrl+PageUp/PageDown and Ctrl+Tab switch browser tabs, Alt+letter
 * opens Firefox menus), and to be reachable without AltGr on a German layout,
 * where `[` and `]` (plan-A §8's first choice for sources) need AltGr+8/9.
 */
const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Parameters',
    keys: [
      ['↑ / ↓', 'Previous / next parameter'],
      ['Home / End', 'First / last parameter'],
      ['Enter or Space', 'Open or close the detail'],
      ['Esc', 'Close the detail'],
      ['S', 'Show the selected value in the document'],
    ],
  },
  {
    title: 'Documents',
    keys: [
      ['.', 'Next document'],
      [',', 'Previous document'],
      ['N', 'Next source of the shown parameter'],
      ['Shift + N', 'Previous source'],
      ['+ / − / 0', 'Zoom in / out / fit width (PDF, when the page has focus)'],
    ],
  },
  {
    title: 'General',
    keys: [['?', 'This list']],
  },
];

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="shortcut-sheet-title">
      <DialogTitle id="shortcut-sheet-title" sx={{ pr: 6 }}>
        Keyboard shortcuts
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          {GROUPS.map((g) => (
            <Box key={g.title}>
              <Typography variant="overline" sx={{ color: 'text.muted' }}>{g.title}</Typography>
              <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '9.5rem 1fr', columnGap: 2, rowGap: 0.75 }}>
                {g.keys.map(([k, label]) => (
                  <Box key={k} sx={{ display: 'contents' }}>
                    <Box component="dt" sx={{ m: 0 }}>
                      <Box
                        component="kbd"
                        sx={{
                          fontFamily: 'inherit', fontSize: 12, fontWeight: 600, px: 0.75, py: 0.25, borderRadius: 0.75,
                          border: 1, borderColor: 'border.strong', bgcolor: 'surface.sunken', color: 'text.primary', whiteSpace: 'nowrap',
                        }}
                      >
                        {k}
                      </Box>
                    </Box>
                    <Typography component="dd" variant="body2" sx={{ m: 0, color: 'text.secondary' }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
