import React from 'react';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../../lib/context/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export default function JFKFilesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="jfk-files-layout">
      <AuthProvider>
        <div className={inter.className}>
          {children}
        </div>
      </AuthProvider>
    </div>
  );
} 