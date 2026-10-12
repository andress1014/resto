import React from 'react';
import { ProductDTO } from '@packages/shared-types';
import { BentoCard, KpiValue } from '@packages/ui-components';

export interface ProductListCardProps {
  product: ProductDTO;
  onSelect?: () => void;
}

export function ProductListCard({ product, onSelect }: ProductListCardProps) {
  return (
    <BentoCard onClick={onSelect} interactive>
      {product.imageUrl && (
        <div style={{ marginBottom: 'var(--bento-spacing-sm)' }}>
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: '100%',
              borderRadius: 'var(--bento-card-radius)',
              display: 'block',
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--bento-spacing-sm)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--bento-font-size-base, 1rem)',
            color: 'var(--bento-text)',
          }}
        >
          {product.name}
        </h3>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          fill="none"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'var(--bento-spacing-sm)',
        }}
      >
        <KpiValue
          label="Precio"
          value={`$${product.price.toFixed(2)}`}
          tone="accent"
        />

        {!product.isAvailable && (
          <span
            style={{
              color: 'var(--bento-destructive)',
              fontWeight: 600,
            }}
          >
            No disponible
          </span>
        )}
      </div>
    </BentoCard>
  );
}
