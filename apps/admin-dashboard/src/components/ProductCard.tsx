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
      {product.imageUrl && <img src={product.imageUrl} alt={product.name} />}
      <h3>{product.name}</h3>
      <KpiValue
        label="Precio"
        value={`$${product.price.toFixed(2)}`}
        tone="accent"
      />
      {onAvailabilityChange && (
        <AvailabilityToggle
          label="Disponible"
          checked={product.isAvailable}
          onChange={onAvailabilityChange}
        />
      )}
    </BentoCard>
  );
}
