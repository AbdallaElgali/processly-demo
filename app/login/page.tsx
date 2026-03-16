'use client';

import { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, ThemeProvider, CssBaseline } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/bda');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await login(username);
      router.push('/bda');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', bgcolor: colors.background }}>
        <Paper elevation={3} sx={{ p: 5, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 400, bgcolor: colors.surface }}>
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold', textAlign: 'center' }}>
            Voltavision BDA
          </Typography>
          <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary', textAlign: 'center' }}>
            Enter your engineer ID to continue
          </Typography>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={!!error}
              helperText={error}
              disabled={isSubmitting}
            />
            <Button 
              type="submit" 
              variant="contained" 
              size="large" 
              disabled={isSubmitting || !username.trim()}
              sx={{ mt: 2, bgcolor: colors.primary, '&:hover': { bgcolor: colors.secondary } }}
            >
              {isSubmitting ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}