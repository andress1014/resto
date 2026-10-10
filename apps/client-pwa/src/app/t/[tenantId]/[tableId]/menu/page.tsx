"use client";
import React, { useEffect, useState } from 'react';
import { PwaApiClient, MenuResult } from '../../../../../lib/api';
import { GuestSessionGuard } from '../../../../../components/GuestSessionGuard';
import { ProductListCard } from '../../../../../components/ProductListCard';
import { ProductDetailSheet } from '../../../../../components/ProductDetailSheet';
import { CartFab, CartSheet, OrderConfirmationCard } from '../../../../../components/cart';
import { BentoGrid, FeatureGuard } from '@packages/ui-components';
import { ProductDTO, CategoryDTO, CartDTO } from '@packages/shared-types';

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
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);
  const [billRequested, setBillRequested] = useState<boolean>(false);
  const [requestingBill, setRequestingBill] = useState<boolean>(false);
  const [billError, setBillError] = useState<string | null>(null);

  const refreshCart = async () => {
    try {
      const currentCart = await PwaApiClient.getCart();
      setCart(currentCart);
    } catch {
      // Ignorar error silencioso de carrito vacío
    }
  };

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

    refreshCart();

    return () => {
      isMounted = false;
    };
  }, [params.tenantId]);

  const handleAddToCart = async (product: ProductDTO, modifiers: any[], quantity: number) => {
    try {
      setCartError(null);
      const modifierNames = (modifiers || []).map((m: any) => m.optionName || m.name).filter(Boolean);
      const updatedCart = await PwaApiClient.addToCart({
        productId: product.id,
        quantity,
        modifiers,
        display: {
          productName: product.name,
          unitPrice: product.price,
          modifierNames,
        },
      });
      setCart(updatedCart);
    } catch (err: any) {
      setCartError(err.message || 'Error al agregar item');
    }
  };

  const handleConfirmOrder = async () => {
    try {
      setIsConfirming(true);
      setCartError(null);
      const order = await PwaApiClient.confirmOrder(params.tableId);
      setConfirmedOrder(order);
      setIsCartOpen(false);
      await refreshCart();
    } catch (err: any) {
      setCartError(err.message || 'Error al confirmar pedido');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRequestBill = async () => {
    try {
      setRequestingBill(true);
      setBillError(null);
      await PwaApiClient.requestBill(params.tableId);
      setBillRequested(true);
    } catch (err: any) {
      setBillError(err.message || 'Error al solicitar la cuenta');
    } finally {
      setRequestingBill(false);
    }
  };

  const totalItemsCount = (cart?.items || []).reduce((acc, it) => acc + it.quantity, 0);

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
          paddingBottom: 'calc(var(--bento-touch-target) + var(--bento-spacing-xl))',
        }}
      >
        {confirmedOrder && (
          <div style={{ marginBottom: 'var(--bento-spacing-sm)' }}>
            <OrderConfirmationCard order={confirmedOrder} />
          </div>
        )}

        {billRequested && (
          <div
            role="status"
            style={{
              padding: '16px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-card-bg)',
              color: 'var(--bento-success, #16a34a)',
              fontWeight: 700,
              textAlign: 'center',
              boxShadow: 'var(--bento-card-shadow)',
            }}
          >
            La cuenta fue solicitada, un mesero pasará por tu mesa.
          </div>
        )}

        {billError && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {billError}
          </div>
        )}

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
              onClick={handleRequestBill}
              disabled={requestingBill || billRequested}
              style={{
                minHeight: 'var(--bento-touch-target)',
                width: '100%',
                backgroundColor: billRequested ? 'var(--bento-card-bg)' : 'var(--bento-accent)',
                color: billRequested ? 'var(--bento-text-muted)' : '#ffffff',
                borderRadius: 'var(--bento-card-radius)',
                border: 'none',
                fontWeight: 600,
                cursor: requestingBill || billRequested ? 'not-allowed' : 'pointer',
              }}
            >
              {requestingBill
                ? 'Solicitando cuenta...'
                : billRequested
                ? 'Cuenta Solicitada'
                : 'Pedir la cuenta'}
            </button>
          </FeatureGuard>
        </footer>

        <ProductDetailSheet
          isOpen={Boolean(selectedProduct)}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />

        <CartFab
          itemCount={totalItemsCount}
          onClick={() => setIsCartOpen(true)}
        />

        <CartSheet
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          onConfirm={handleConfirmOrder}
          error={cartError}
          isConfirming={isConfirming}
        />
      </main>
    </GuestSessionGuard>
  );
}
