import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        // FORCE inline styles to override any potential CSS framework conflicts
        style={{ 
          width: '100vw', 
          height: '100vh', 
          margin: 0, 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        {children}
      </body>
    </html>
  );
}