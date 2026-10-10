import React from 'react';
import '@packages/ui-components/src/bento/bento.css';
import { FeatureFlagsProvider } from '../components/FeatureFlagsProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <FeatureFlagsProvider>
          {children}
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
