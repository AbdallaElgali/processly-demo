'use client';

import { Suspense, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Tab, Tabs } from '@mui/material';

export interface SectionTab {
  value: string;
  label: string;
  content: ReactNode;
}

function Inner({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wanted = params.get('tab');
  const active = tabs.find((t) => t.value === wanted) ?? tabs[0];
  return (
    <Box>
      <Tabs
        value={active.value}
        onChange={(_, value: string) => router.replace(`${pathname}?tab=${value}`, { scroll: false })}
        aria-label={label}
        sx={{ borderBottom: 1, borderColor: 'border.subtle', mb: 2.5 }}
      >
        {tabs.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} id={`tab-${t.value}`} aria-controls={`panel-${t.value}`} />
        ))}
      </Tabs>
      <Box role="tabpanel" id={`panel-${active.value}`} aria-labelledby={`tab-${active.value}`}>
        {active.content}
      </Box>
    </Box>
  );
}

/** Tabs whose selection lives in `?tab=`, so a link (the Workspace's "Runs") can open one. Only the active panel is mounted. */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  return (
    <Suspense fallback={null}>
      <Inner tabs={tabs} label={label} />
    </Suspense>
  );
}
