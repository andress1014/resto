import React from 'react';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import '@packages/ui-components/src/bento/bento.css';
import { FeatureFlagsProvider } from '../components/FeatureFlagsProvider';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Restaurante OS - Admin Dashboard',
  description: 'Panel de administración y control operativo para Restaurante OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bricolageGrotesque.variable} ${dmSans.variable}`}>
      <body className={dmSans.className}>
        <FeatureFlagsProvider>
          {children}
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
