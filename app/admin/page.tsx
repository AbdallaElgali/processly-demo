'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';

import { apiGetDashboardAnalytics, DashboardAnalytics } from '@/api/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/theme/theme';
import { colors } from '@/theme/colors';
import { LayoutHeader } from '@/components/LayoutHeader';
import { GlobalMetricsPanel } from '@/components/admin/GlobalMetricsPanel';
import { HotspotsTable } from '@/components/admin/HotspotsTable';
import { ABTestPanel } from '@/components/admin/ABTestPanel';
import { ConfidencePanel } from '@/components/admin/ConfidencePanel';
import { VelocityChart } from '@/components/admin/VelocityChart';
import { RegisterUserCard } from '@/components/admin/RegisterUserCard';

export default function AdminPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGetDashboardAnalytics();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasMounted && !authLoading && !user) {
      router.push('/login');
    }
  }, [hasMounted, authLoading, user, router]);

  useEffect(() => {
    if (hasMounted && user) {
      loadDashboard();
    }
  }, [hasMounted, user, loadDashboard]);

  if (!hasMounted) return null;

  if (authLoading || !user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: colors.background }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: colors.background }}>
        <LayoutHeader />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3,
            py: 1.5,
            borderBottom: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Admin Dashboard
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
              Human-in-the-loop performance · hotspots · pipeline experiments
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              onClick={loadDashboard}
              startIcon={<RefreshIcon />}
              size="small"
              disabled={isLoading}
              sx={{ color: colors.textPrimary, borderColor: colors.border }}
              variant="outlined"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Typography variant="caption" fontWeight="bold" sx={{ ml: 1 }}>
              {user.username}
            </Typography>
            <IconButton onClick={logout} color="error" size="small" aria-label="logout">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {isLoading && !data && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {data && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <GlobalMetricsPanel metrics={data.global_metrics} />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
                  gap: 2,
                }}
              >
                <VelocityChart data={data.velocity} />
                <RegisterUserCard />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <ABTestPanel data={data.ab_test} />
                <ConfidencePanel confidence={data.confidence} />
              </Box>

              <HotspotsTable hotspots={data.hotspots} />
            </Box>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
