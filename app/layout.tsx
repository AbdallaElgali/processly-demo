import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import './globals.css';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectDataProvider } from '@/lib/project-data/provider';
import { RunningJobGuard } from '@/components/jobs/RunningJobGuard';
import { ThemeRegistry } from '@/theme/ThemeRegistry';

// One font for the whole app. latin-ext carries the umlauts and eszett in the
// German datasheets this tool reads (e.g. "Nennkapazitat" with an umlaut).
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Voltavision BDA',
  description: 'Battery Document Analysis',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/*
          Sets data-mui-color-scheme on <html> from localStorage (or the OS
          preference on a first visit) before first paint, so a dark-mode user
          never sees a light flash. defaultMode="system" is CLAUDE.md 8.3's
          "default to the OS preference".
        */}
        <InitColorSchemeScript defaultMode="system" attribute="data-mui-color-scheme" />
        {/*
          Emotion needs this to inject its SSR styles in the order the client
          expects. Without it the server emitted CssBaseline's global <style>
          where the client rendered the first element, which React reported as
          a hydration mismatch. The app never had this provider; the mismatch
          only became visible once CssBaseline moved from each page up to the
          root. MUI's docs require it for the App Router.
        */}
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <AuthProvider>
              <ProjectDataProvider>
                <RunningJobGuard />
                {children}
              </ProjectDataProvider>
            </AuthProvider>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
