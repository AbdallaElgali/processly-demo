'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

function LoginForm() {
  const params = useSearchParams();
  // Prefilled when arriving from /register, so a new user does not retype it.
  const [username, setUsername] = useState(params.get('username') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace('/projects');
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim());
      router.replace('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ p: 4, width: '100%', maxWidth: 420, bgcolor: 'surface.panel', borderColor: 'border.subtle' }}
    >
      <Typography variant="h5" sx={{ color: 'text.primary', mb: 0.5 }}>
        Voltavision <Box component="span" sx={{ color: 'accent.text' }}>BDA</Box>
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Battery Document Analysis. Sign in with your username.
      </Typography>

      <form onSubmit={handleLogin} noValidate>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            fullWidth
            required
            disabled={busy}
            autoComplete="username"
          />

          <Button type="submit" variant="contained" size="large" disabled={busy || !username.trim()} loading={busy}>
            Sign in
          </Button>

          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            No account yet?{' '}
            <Box component={Link} href="/register" sx={{ color: 'accent.text', fontWeight: 600 }}>
              Register
            </Box>
          </Typography>
        </Stack>
      </form>
    </Paper>
  );
}

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'surface.canvas',
      }}
    >
      {/* useSearchParams needs a Suspense boundary to prerender this route. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </Box>
  );
}
