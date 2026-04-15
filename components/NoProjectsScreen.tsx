'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Paper,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { LayoutHeader } from '@/components/LayoutHeader';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';

interface NoProjectsScreenProps {
  onCreateProject: (alias: string) => Promise<void>;
}

export const NoProjectsScreen = ({ onCreateProject }: NoProjectsScreenProps) => {
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!alias.trim()) return;
    setError(null);
    try {
      await onCreateProject(alias.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project. Please try again.');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: colors.background }}>
        <LayoutHeader />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 450, width: '100%', textAlign: 'center' }}>
            <AddCircleOutlineIcon sx={{ fontSize: 60, color: colors.primary, mb: 2 }} />
            <Typography variant="h5" fontWeight="bold">Initialize BDA Project</Typography>

            {error && (
              <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Project Alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              sx={{ my: 3 }}
            />
            <Button
              fullWidth
              variant="contained"
              disabled={!alias.trim()}
              onClick={handleSubmit}
            >
              Start Project
            </Button>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
};
