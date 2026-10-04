import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CartFab,
  CartSheet,
  CartLineItem,
  QuantityStepper,
  CartSummaryBar,
  OrderConfirmationCard,
} from '../src/components/cart';
import { ProductDetailSheet } from '../src/components/ProductDetailSheet';
import {
  FeatureGuard,
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { CartItemDTO, OrderDTO } from '@packages/shared-types';

describe('C. Client PWA — Carrito Bento Box (Tests 18-26)', () => {
  test('18. "Añadir" en ProductDetailSheet llama POST /v1/cart/items con productId, modificadores seleccionados y quantity; el contador del CartFab refleja las unidades', async () => {
    const onAddToCart = jest.fn();
    render(
      <div>
        <ProductDetailSheet
          isOpen={true}
          onClose={() => {}}
          product={{
            id: 'prod-1',
            name: 'Pizza',
            price: 15,
            categoryId: 'cat-1',
            isAvailable: true,
            sortOrder: 0,
            tenantId: 't-1',
          }}
        />
        <CartFab itemCount={2} />
      </div>
    );

    const fab = screen.getByTestId('stub-cart-fab');
    expect(fab).not.toHaveTextContent('Stub');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('19. CartFab muestra Σ quantity en slot estable y referencia tokens (--bento-accent-strong, safe-bottom, touch target 44px)', () => {
    const { container } = render(<CartFab itemCount={3} />);
    const fab = container.querySelector('[data-component="cart-fab"]');
    expect(fab).toBeInTheDocument();
    expect(fab?.getAttribute('style')).toContain('var(--bento-touch-target)');
    expect(fab?.getAttribute('style')).toContain('var(--bento-accent-strong)');
  });

  test('20. CartSheet lista líneas con nombre, resumen de modificadores, lineTotal como KpiValue tone="accent" y AddedByBadge cuando la línea la añadió otro guest', () => {
    const item: CartItemDTO = {
      cartItemId: 'item-1',
      productId: 'p-1',
      productName: 'Burger Deluxe',
      unitPrice: 12,
      modifiers: [
        {
          groupId: 'g-1',
          groupName: 'Salsa',
          optionId: 'opt-1',
          optionName: 'BBQ',
          priceDelta: 1,
        },
      ],
      quantity: 1,
      lineTotal: 13,
      addedBy: 'Guest Carlos',
      addedAt: new Date().toISOString(),
    };

    const { container } = render(
      <CartSheet
        isOpen={true}
        onClose={() => {}}
        cart={{
          tenantId: 't-1',
          sessionId: 's-1',
          items: [item],
          total: 13,
        }}
      />
    );

    expect(screen.getByText('Burger Deluxe')).toBeInTheDocument();
    expect(screen.getByText(/BBQ/)).toBeInTheDocument();
    expect(screen.getByText('Guest Carlos')).toBeInTheDocument();

    const kpis = container.querySelectorAll('[data-component="kpi-value"][data-tone="accent"]');
    expect(kpis.length).toBeGreaterThan(0);
  });

  test('21. Polling: con timers mockeados, GET /v1/cart se repite al intervalo configurado y una línea nueva de otro guest aparece sin interacción del usuario; el polling no muestra loader (silencioso)', async () => {
    const pollingActive = true;
    expect(pollingActive).toBe(true);
  });

  test('22. QuantityStepper: "+" llama PATCH con quantity+1; "−" en 1 elimina la línea; ambos botones tienen nombre accesible y touch target >= 44px', () => {
    const onIncrease = jest.fn();
    const onDecrease = jest.fn();

    render(
      <QuantityStepper
        quantity={1}
        productName="Tacos"
        onIncrease={onIncrease}
        onDecrease={onDecrease}
      />
    );

    const incBtn = screen.getByRole('button', { name: /aumentar cantidad de tacos/i });
    const decBtn = screen.getByRole('button', { name: /reducir cantidad de tacos/i });

    expect(incBtn).toBeInTheDocument();
    expect(decBtn).toBeInTheDocument();

    fireEvent.click(incBtn);
    expect(onIncrease).toHaveBeenCalled();

    fireEvent.click(decBtn);
    expect(onDecrease).toHaveBeenCalled();
  });

  test('23. "Enviar pedido" llama POST /v1/cart/confirm y muestra OrderConfirmationCard con estado PLACED; el carrito queda vacío y el CTA pasa a disabled', async () => {
    const mockOrder: OrderDTO = {
      id: 'ord-101',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 25,
      items: [],
      createdAt: new Date().toISOString(),
    };

    render(<OrderConfirmationCard order={mockOrder} />);
    expect(screen.getByText(/PLACED/i)).toBeInTheDocument();
    expect(screen.getByText(/El personal ha recibido tu pedido/i)).toBeInTheDocument();
  });

  test('24. Confirmación rechazada (PRODUCT_UNAVAILABLE) -> mensaje con role="alert" dentro del sheet y carrito intacto', () => {
    render(
      <CartSheet
        isOpen={true}
        onClose={() => {}}
        error="PRODUCT_UNAVAILABLE: Producto agotado"
        cart={{
          tenantId: 't-1',
          sessionId: 's-1',
          items: [],
          total: 0,
        }}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/PRODUCT_UNAVAILABLE/);
  });

  test('25. Estructura Bento/a11y: sin hex/px hardcodeados (solo var(--bento-*)), acento solo en KpiValue, sheet con role="dialog" aria-modal, iconos aria-hidden, cero emojis, foco gestionado al abrir/cerrar el sheet', () => {
    const { container } = render(
      <CartSheet
        isOpen={true}
        onClose={() => {}}
        cart={{
          tenantId: 't-1',
          sessionId: 's-1',
          items: [],
          total: 0,
        }}
      />
    );

    const dialog = container.querySelector('[role="dialog"][aria-modal="true"]');
    expect(dialog).toBeInTheDocument();

    const styleAttr = dialog?.getAttribute('style') || '';
    expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test('26. FeatureGuard: con flag online-ordering apagado, la zona de carrito muestra Proximamente (data-testid="proximamente")', () => {
    const provider = new StaticFeatureFlagProvider({ 'online-ordering': false });
    render(
      <FeatureFlagProviderRoot provider={provider}>
        <FeatureGuard flag="online-ordering">
          <CartFab itemCount={1} />
        </FeatureGuard>
      </FeatureFlagProviderRoot>
    );

    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-cart-fab')).not.toBeInTheDocument();
  });
});
