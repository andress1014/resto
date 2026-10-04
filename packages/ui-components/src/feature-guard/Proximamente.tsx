import React from 'react';
import { BentoCard } from '../bento/BentoCard';

export interface ProximamenteProps {
  featureName?: string;
  eta?: string;
}

export function Proximamente({ featureName, eta }: ProximamenteProps) {
  return (
    <BentoCard role="status" aria-live="polite" data-testid="proximamente">
      <span>Próximamente</span>
      {featureName && <span>: {featureName}</span>}
      {eta && <span> (Disponible: {eta})</span>}
    </BentoCard>
  );
}
