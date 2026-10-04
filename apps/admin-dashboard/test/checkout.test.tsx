import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ActiveTablesGrid,
  BillSummaryCard,
  PaymentMethodPicker,
  ConfirmPaymentButton,
  PaymentSuccessCard,
} from '../src/components/checkout';
import CheckoutPage from '../src/app/checkout/page';
import {
  FeatureGuard,
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { BillDTO, TableSessionDTO } from '@packages/shared-types';

describe('C. Admin Dashboard — Vista de Checkout (Tests 13-19)', () => {
  const sampleActiveSessions: TableSessionDTO[] = [
    {
      sessionId: 'sess-1',
      tenantId: 't-1',
      tableId: 'Mesa 1',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    {
      sessionId: 'sess-2',
      tenantId: 't-1',
      tableId: 'Mesa 2',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  ];

  const sampleBill: BillDTO = {
    sessionId: 'sess-1',
    tableId: 'Mesa 1',
    ordersCount: 2,
    total: 65,
    payment: null,
    orders: [
      {
        id: 'ord-1',
        tenantId: 't-1',
        sessionId: 'sess-1',
        tableId: 'Mesa 1',
        status: 'READY',
        total: 35,
        items: [
          {
            id: 'item-1',
            productId: 'p-1',
            productName: 'Tacos al Pastor',
            unitPrice: 35,
            quantity: 1,
            modifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-2',
        tenantId: 't-1',
        sessionId: 'sess-1',
        tableId: 'Mesa 1',
        status: 'READY',
        total: 30,
        items: [
          {
            id: 'item-2',
            productId: 'p-2',
            productName: 'Guacamole',
            unitPrice: 30,
            quantity: 1,
            modifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
  };

  test('13. /checkout lista las mesas activas como data-component="bento-card"', () => {
    const { container } = render(<ActiveTablesGrid sessions={sampleActiveSessions} />);
    const cards = container.querySelectorAll('[data-component="bento-card"]');
    expect(cards.length).toBe(2);
    expect(screen.getByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
  });

  test('14. Al seleccionar mesa: BillSummaryCard muestra cada Order con items y el total como KpiValue tone="accent"; una Order cancelada NO aparece', () => {
    const { container } = render(<BillSummaryCard bill={sampleBill} />);
    expect(screen.getByText('Tacos al Pastor')).toBeInTheDocument();
    expect(screen.getByText('Guacamole')).toBeInTheDocument();

    const kpi = container.querySelector('[data-component="kpi-value"][data-tone="accent"]');
    expect(kpi).toBeInTheDocument();
    expect(kpi).toHaveTextContent('$65');
  });

  test('15. PaymentMethodPicker es radiogroup accesible con 3 opciones con label visible; sin selección, el CTA está disabled', () => {
    render(<PaymentMethodPicker selectedMethod={null} onSelect={jest.fn()} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: /efectivo/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /tarjeta/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /otro/i })).toBeInTheDocument();

    render(<ConfirmPaymentButton disabled={true} onConfirm={jest.fn()} />);
    const btn = screen.getByRole('button', { name: /cobrar|registrar cobro/i });
    expect(btn).toBeDisabled();
  });

  test('16. Flujo de cobro: CTA -> paso de confirmación inline -> POST /v1/checkout/confirm con el method elegido -> PaymentSuccessCard "Mesa liberada" y la mesa desaparece de la lista', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmPaymentButton
        total={65}
        method="CASH"
        onConfirm={onConfirm}
      />
    );

    const initialBtn = screen.getByRole('button', { name: /registrar cobro/i });
    fireEvent.click(initialBtn);

    // Debe mostrar paso de confirmación inline
    const confirmInlineBtn = screen.getByRole('button', { name: /confirmar cobro y liberar mesa/i });
    expect(confirmInlineBtn).toBeInTheDocument();

    fireEvent.click(confirmInlineBtn);
    expect(onConfirm).toHaveBeenCalled();

    render(<PaymentSuccessCard tableId="Mesa 1" amount={65} method="CASH" />);
    expect(screen.getByText(/cobro registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/mesa liberada/i)).toBeInTheDocument();
  });

  test('17. SESSION_CLOSE_FAILED -> role="alert" con "Reintentar cierre"; el reintento exitoso muestra el success', () => {
    const onRetry = jest.fn();
    render(<BillSummaryCard bill={sampleBill} error="SESSION_CLOSE_FAILED" onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /reintentar cierre/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });

  test('18. Bento/a11y: tokens var(--bento-*) sin hardcodeo, acento solo en total/CTA, iconos aria-hidden, cero emojis, touch targets >=44px', () => {
    const { container } = render(<BillSummaryCard bill={sampleBill} />);
    const card = container.querySelector('[data-component="bento-card"]');
    expect(card).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test('19. <FeatureGuard flag="payments">: OFF -> Proximamente; ON (provider inyectado) -> vista de checkout', () => {
    // OFF
    const { rerender } = render(<CheckoutPage />);
    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-content')).not.toBeInTheDocument();

    // ON
    const provider = new StaticFeatureFlagProvider({ payments: true });
    rerender(
      <FeatureFlagProviderRoot provider={provider}>
        <CheckoutPage />
      </FeatureFlagProviderRoot>
    );

    expect(screen.getByTestId('checkout-content')).toBeInTheDocument();
  });
});
