import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutPage from '../src/app/checkout/page';
import { ApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('RONDA 5: FIX B1 - Admin Checkout Cableado Real (TDD Rojo)', () => {
  const provider = new StaticFeatureFlagProvider({ payments: true });

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'admin-jwt-token';
  });

  test('CheckoutPage carga sesiones activas al montar, obtiene cuenta al seleccionar mesa y registra pago en confirmación', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      // 1. GET /v1/sessions?status=active
      if (urlStr.includes('/v1/sessions?status=active')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-active-1',
              tenantId: 't-1',
              tableId: 'Mesa 10',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      // 2. GET /v1/checkout/sess-active-1
      if (urlStr.includes('/v1/checkout/sess-active-1')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-active-1',
            tableId: 'Mesa 10',
            ordersCount: 1,
            total: 1500,
            payment: null,
            orders: [],
          }),
        };
      }

      // 3. POST /v1/checkout/confirm
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        expect(body.sessionId).toBe('sess-active-1');
        expect(body.tableId).toBe('Mesa 10');
        expect(body.method).toBe('CASH');

        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-real-1',
            sessionId: 'sess-active-1',
            tableId: 'Mesa 10',
            amount: 1500,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      // Debe consultar sesiones activas y mostrar la mesa
      await waitFor(() => {
        expect(screen.getByText('Mesa 10')).toBeInTheDocument();
      });

      // Seleccionar la mesa
      fireEvent.click(screen.getByText('Mesa 10'));

      // Debe cargar el bill y mostrar el total
      await waitFor(() => {
        expect(screen.getByText(/Total a Cobrar/i)).toBeInTheDocument();
        expect(screen.getByText(/\$1500/i)).toBeInTheDocument();
      });

      // Seleccionar método de pago Efectivo
      const cashBtn = screen.getByRole('radio', { name: /efectivo/i });
      fireEvent.click(cashBtn);

      // Confirmar pago (primer click abre confirmación inline)
      const registrarBtn = screen.getByRole('button', { name: /registrar cobro/i });
      fireEvent.click(registrarBtn);

      const confirmBtn = screen.getByRole('button', { name: /confirmar cobro y liberar mesa/i });
      fireEvent.click(confirmBtn);

      // Debe mostrar tarjeta de éxito
      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
