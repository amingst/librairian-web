import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
// import { AuthProvider } from '../lib/context/AuthContext';
import { DocumentDockProvider } from '../lib/context/DocumentDockContext';
import { DocumentDock } from '../components/ui/DocumentDock';
import Link from 'next/link';
import { DocumentGroupProvider } from '../lib/context/DocumentGroupContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ΛLΞXΛNDRIΛ LIBRΛIRIΛN',
  description: 'Your digital library of web content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        {/* <AuthProvider> */}
          <DocumentGroupProvider>
            <DocumentDockProvider>
              {children}
              <DocumentDock />
            </DocumentDockProvider>
          </DocumentGroupProvider>
        {/* </AuthProvider> */}
      </body>
    </html>
  );
} 