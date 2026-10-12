import React from 'react';
import { BentoCard, KpiValue, AvailabilityToggle } from '@packages/ui-components';

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    categoryId: string;
    isAvailable: boolean;
    sortOrder?: number;
    tenantId?: string;
    imageUrl?: string;
  };
  onAvailabilityChange?: (isAvailable: boolean) => void;
}

export function ProductCard({ product, onAvailabilityChange }: ProductCardProps) {
  return (
    <BentoCard>
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: '100%',
              height: '140px',
              objectFit: 'cover',
              borderRadius: 'var(--bento-inner-radius)',
            }}
          />
        )}
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--bento-text)' }}>
          {product.name}
        </h3>
        <KpiValue
          label="Precio"
          value={`$${Number(product.price).toFixed(2)}`}
          tone="accent"
        />
        {onAvailabilityChange && (
          <div style={{ marginTop: '4px' }}>
            <AvailabilityToggle
              label="Disponible"
              checked={Boolean(product.isAvailable)}
              onChange={onAvailabilityChange}
            />
          </div>
        )}
      </div>
    </BentoCard>
  );
}
