
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { BookOpen, UserCog } from 'lucide-react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from '@/components/AppHeader';
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: 'Weekly Projects Hub',
  description: 'Access and download your weekly project PDFs easily.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppHeader />
          <main className="flex-grow container mx-auto p-4 sm:p-6">
            {children}
          </main>
          <footer className="bg-muted text-muted-foreground text-center p-4 text-sm">
            © {new Date().getFullYear()} Weekly Projects Hub. All rights reserved.
          </footer>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
