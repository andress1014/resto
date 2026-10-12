import React from 'react';
import { BentoCard } from '@packages/ui-components';
import type { CategoryDTO } from '@packages/shared-types';

export interface CategoryCardProps {
  category: CategoryDTO | {
    id: string;
    name: string;
    sortOrder?: number;
  };
  productCount?: number;
}

export function CategoryCard({ category, productCount = 0 }: CategoryCardProps) {
  return (
    <BentoCard>
      <div style={{ padding: '8px 0' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--bento-text)' }}>
          {category.name}
        </h3>
        <p style={{ margin: 0, color: 'var(--bento-text-muted)', fontSize: '0.85rem' }}>
          {productCount} {productCount === 1 ? 'plato' : 'platos'}
        </p>
      </div>
    </BentoCard>
  );
}
