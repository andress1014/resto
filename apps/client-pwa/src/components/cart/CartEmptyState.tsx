import React from 'react';
import { BentoCard } from '@packages/ui-components';

export function CartEmptyState() {
  return (
    <BentoCard style={{ padding: 'var(--bento-spacing-lg)', textAlign: 'center' }}>
      <p style={{ margin: 0, color: 'var(--bento-text-muted)', fontWeight: 500 }}>
        Tu mesa aún no ha pedido nada
      </p>
    </BentoCard>
  );
}
