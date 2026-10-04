import React, { useEffect, useState } from 'react';
import { PwaApiClient, MenuResult } from '../../../../../lib/api';
import { GuestSessionGuard } from '../../../../../components/GuestSessionGuard';
import { ProductListCard } from '../../../../../components/ProductListCard';
import { ProductDetailSheet } from '../../../../../components/ProductDetailSheet';
import { BentoGrid, FeatureGuard } from '@packages/ui-components';
import { ProductDTO, CategoryDTO } from '@packages/shared-types';

export interface ClientMenuPageProps {
  params: {
    tenantId: string;
    tableId: string;
  };
}

export default function ClientMenuPage({ params }: ClientMenuPageProps) {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);

  useEffect(() => {
    if (!PwaApiClient.guestToken) {
      return;
    }

    let isMounted = true;
    PwaApiClient.fetchMenu(params.tenantId).then((res: MenuResult) => {
      if (isMounted) {
        setCategories(res.categories || []);
        setProducts(res.products || []);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [params.tenantId]);

  return (
    <GuestSessionGuard>
      <main
        style={{
          padding: 'var(--bento-spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--bento-spacing-md)',
          minHeight: '100vh',
          backgroundColor: 'var(--bento-page-bg)',
        }}
      >
        <header
          role="tablist"
          aria-label="Categorías"
          style={{
            display: 'flex',
            gap: 'var(--bento-touch-gap)',
            overflowX: 'auto',
          }}
        >
          {categories.map((c) => (
            <div
              key={c.id}
              role="tab"
              data-component="bento-card"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--bento-spacing-xs) var(--bento-spacing-sm)',
                minHeight: 'var(--bento-touch-target)',
                borderRadius: 'var(--bento-card-radius)',
                backgroundColor: 'var(--bento-card-bg)',
                color: 'var(--bento-text)',
                whiteSpace: 'nowrap',
              }}
            >
              {c.name}
            </div>
          ))}
        </header>

        <section aria-label="Catálogo">
          <BentoGrid cols={2}>
            {products.map((p) => (
              <ProductListCard
                key={p.id}
                product={p}
                onSelect={() => setSelectedProduct(p)}
              />
            ))}
          </BentoGrid>
        </section>

        <footer style={{ marginTop: 'auto', paddingTop: 'var(--bento-spacing-md)' }}>
          <FeatureGuard flag="payments">
            <button
              type="button"
              style={{
                minHeight: 'var(--bento-touch-target)',
                width: '100%',
                backgroundColor: 'var(--bento-accent)',
                color: 'var(--bento-card-bg)',
                borderRadius: 'var(--bento-card-radius)',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Pagar
            </button>
          </FeatureGuard>
        </footer>

        <ProductDetailSheet
          isOpen={Boolean(selectedProduct)}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      </main>
    </GuestSessionGuard>
  );
}
