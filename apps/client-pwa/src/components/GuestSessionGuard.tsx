"use client";
import React, { useEffect, useState } from 'react';
import { PwaApiClient } from '../lib/api';
import { BentoCard } from '@packages/ui-components';

export interface GuestSessionGuardProps {
  children: React.ReactNode;
}

export function GuestSessionGuard({ children }: GuestSessionGuardProps) {
  const [mounted, setMounted] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(PwaApiClient.guestToken));
    setMounted(true);
  }, []);

  // Pre-mount / SSR: renderizar placeholder neutro identico para evitar mismatch de hidratacion
  if (!mounted) {
    return (
      <div
        data-testid="guest-guard-loading"
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bento-page-bg, #F5F5F7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
    );
  }

  if (!hasToken) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bento-page-bg, #F5F5F7)' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <BentoCard>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--bento-text)' }}>
                Escanea el QR de tu mesa
              </h2>
              <p style={{ margin: 0, color: 'var(--bento-text-muted)', fontSize: '0.9rem' }}>
                Para poder ver la carta y pedir, escanea el código QR que se encuentra en tu mesa.
              </p>
            </div>
          </BentoCard>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
