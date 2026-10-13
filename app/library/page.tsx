'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography } from '@mui/material';

import { useAuth } from '@/contexts/AuthContext';
import { useHasMounted } from '@/hooks/useHasMounted';
import { AppHeader } from '@/components/shell/AppHeader';
import { SectionTabs } from '@/components/ui/SectionTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { TemplatesPanel } from '@/components/parameters/TemplatesPanel';
import { ParametersSection } from '@/components/library/ParametersSection';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';

/**
 * The Library: templates and the canonical parameter dictionary, usable before
 * any project exists. Customers will be the third section (step S4).
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
          Templates and the parameter dictionary. They belong to you, not to a project.
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
            {
              value: 'customers',
              label: 'Customers',
              content: (
                // Placeholder: the Customers section is step S4.
                <EmptyState
                  icon={PeopleOutlineIcon}
                  title="Customers are coming"
                  description="Managing customers from the Library is planned for a later step. Customers can still be added when you create a project."
                />
              ),
            },
          ]}
        />
      </Box>
    </Box>
  );
}
