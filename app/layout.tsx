import { AuthProvider } from '@/contexts/AuthContext';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from '@/contexts/ProjectContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voltavision Demo",
  description: "Automated Specification Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 1. Added suppressHydrationWarning to html tag
    <html lang="en" suppressHydrationWarning>
      <body 
        suppressHydrationWarning 
        style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}
      >
        <AuthProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </AuthProvider>
      </body>
    </html>
  );
}