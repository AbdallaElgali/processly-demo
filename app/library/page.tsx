'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography } from '@mui/material';

import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';
import { AppHeader } from '@/components/shell/AppHeader';
import { SectionTabs } from '@/components/ui/SectionTabs';
import { TemplatesPanel } from '@/components/parameters/TemplatesPanel';
import { ParametersSection } from '@/components/library/ParametersSection';
import { ToastHost } from '@/components/ui/Toast';
import { CustomersSection } from '@/components/library/CustomersSection';

/**
 * The Library: templates and the canonical parameter dictionary, usable before
 * any project exists. Customers (S4) hold a default template and prompt choices.
 */
export default function LibraryPage() {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (hasMounted && !isLoading && !user) router.push('/login');
  }, [hasMounted, isLoading, user, router]);

  if (!hasMounted || !user) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: 'surface.canvas' }}>
      <AppHeader />
      <Box component="main" sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
        <Typography variant="h4" sx={{ color: 'text.primary' }}>Library</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Templates, the parameter dictionary and customers. They belong to you, not to a project.
        </Typography>
        <SectionTabs
          label="Library sections"
          tabs={[
            {
              value: 'templates',
              label: 'Templates',
              content: (
                <Box sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 1, overflow: 'hidden', height: 'calc(100dvh - 300px)', minHeight: 420 }}>
                  <TemplatesPanel />
                </Box>
              ),
            },
            { value: 'parameters', label: 'Parameters', content: <ParametersSection /> },
            { value: 'customers', label: 'Customers', content: <CustomersSection /> },
          ]}
        />
      </Box>
      <ToastHost />
    </Box>
  );
}
