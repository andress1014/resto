import React from 'react';
import { PwaApiClient } from '../lib/api';
import { BentoCard } from '@packages/ui-components';

export interface GuestSessionGuardProps {
  children: React.ReactNode;
}

export function GuestSessionGuard({ children }: GuestSessionGuardProps) {
  if (!PwaApiClient.guestToken) {
    return (
      <BentoCard>
        <h2>Escanea el QR de tu mesa</h2>
      </BentoCard>
    );
  }

  return <>{children}</>;
}
