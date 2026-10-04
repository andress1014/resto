import React from 'react';
import { OrderDTO } from '@packages/shared-types';
import { BentoCard } from '@packages/ui-components';

export interface OrderConfirmationCardProps {
  order: OrderDTO;
}

export function OrderConfirmationCard({ order }: OrderConfirmationCardProps) {
  return (
    <BentoCard style={{ padding: 'var(--bento-spacing-md)', textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--bento-spacing-xs)',
          padding: 'var(--bento-spacing-xs) var(--bento-spacing-sm)',
          borderRadius: 'var(--bento-card-radius)',
          backgroundColor: 'var(--bento-success, #22c55e)',
          color: 'var(--bento-card-bg)',
          fontWeight: 700,
          marginBottom: 'var(--bento-spacing-sm)',
        }}
      >
        <span>{order.status}</span>
      </div>

      <h3 style={{ margin: '0 0 var(--bento-spacing-xs) 0', color: 'var(--bento-text)' }}>
        Orden #{order.id.slice(-6)}
      </h3>

      <p style={{ margin: 0, color: 'var(--bento-text-muted)' }}>
        El personal ha recibido tu pedido
      </p>
    </BentoCard>
  );
}
