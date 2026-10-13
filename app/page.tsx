'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Skeleton } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';

/** The root sends you to the projects list, or to sign in (decision D4). */
export default function RootPage() {
  const { user, isLoading } = useAuth();
  const hasMounted = useHasMounted();
  const router = useRouter();

  useEffect(() => {
    if (!hasMounted || isLoading) return;
    router.replace(user ? '/projects' : '/login');
  }, [user, isLoading, hasMounted, router]);

  return (
    <Box sx={{ p: 4 }}>
      <Skeleton variant="text" width={220} height={40} />
      <Skeleton variant="rounded" height={132} sx={{ mt: 2, maxWidth: 260 }} />
    </Box>
  );
}
