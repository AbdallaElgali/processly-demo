'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import { DEPARTMENTS, registerUser, UsernameTakenError, type Department } from '@/api/auth';

/**
 * Register a user (decision D3).
 *
 * Replaces the old "Settings: User Management" dialog, which was misnamed and
 * broken: it took a free-text department and also sent `email` and `password`,
 * none of which UserRegistration declares. Anything but the three enum values
 * failed validation with no explanation.
 *
 * A2 applies: there is no password and no session, so this creates an
 * identity, not an account. The page says so rather than implying security.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = username.trim().length > 0 && department !== '' && !busy;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await registerUser({ username: username.trim(), department: department as Department });
      setDone(true);
      // Hand the new name to the sign-in form rather than making them retype it.
      setTimeout(() => router.push(`/login?username=${encodeURIComponent(username.trim())}`), 900);
    } catch (e) {
      setError(
        e instanceof UsernameTakenError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Registration failed.',
      );
    } finally {
      setBusy(false);
    }
  };

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
      <Paper
        variant="outlined"
        sx={{ p: 4, width: '100%', maxWidth: 420, bgcolor: 'surface.panel', borderColor: 'border.subtle' }}
      >
        <Typography variant="h5" sx={{ color: 'text.primary', mb: 0.5 }}>
          Register a user
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Creates an identity for attributing extractions and flags. There is no
          password: anyone who knows the name can sign in as them.
        </Typography>

        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            {done && <Alert severity="success">Registered. Taking you to sign in…</Alert>}

            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              fullWidth
              disabled={busy || done}
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />

            <FormControl fullWidth required disabled={busy || done}>
              <InputLabel id="department-label">Department</InputLabel>
              <Select
                labelId="department-label"
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
              >
                {DEPARTMENTS.map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button type="submit" variant="contained" size="large" disabled={!canSubmit} loading={busy}>
              Register
            </Button>

            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Already registered?{' '}
              <Box component={Link} href="/login" sx={{ color: 'accent.text', fontWeight: 600 }}>
                Sign in
              </Box>
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
