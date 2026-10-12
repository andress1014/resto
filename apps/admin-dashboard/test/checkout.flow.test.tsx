import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CheckoutPage from '../src/app/(panel)/checkout/page';
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

      // Confirmar pago (click abre ModalConfirm obligatorio)
      const registrarBtn = screen.getByRole('button', { name: /registrar cobro/i });
      fireEvent.click(registrarBtn);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/cuenta actual/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/total a cobrar/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/método/i)).toBeInTheDocument();
      expect(within(dialog).getByText('Efectivo')).toBeInTheDocument();

      const confirmBtn = within(dialog).getByRole('button', { name: 'Confirmar cobro' });
      fireEvent.click(confirmBtn);

      // Debe mostrar tarjeta de éxito
      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Tratamiento de error SESSION_CLOSE_FAILED ofrece reintento y al reintentar completa el cobro', async () => {
    let attempt = 0;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions?status=active')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-active-fail',
              tenantId: 't-1',
              tableId: 'Mesa 5',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-active-fail')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-active-fail',
            tableId: 'Mesa 5',
            ordersCount: 1,
            total: 200,
            payment: null,
            orders: [],
          }),
        };
      }

      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        attempt += 1;
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({
              code: 'SESSION_CLOSE_FAILED',
              message: 'SESSION_CLOSE_FAILED',
            }),
          };
        }
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-retry-1',
            sessionId: 'sess-active-fail',
            tableId: 'Mesa 5',
            amount: 200,
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

      await waitFor(() => {
        expect(screen.getByText('Mesa 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 5'));

      await waitFor(() => {
        expect(screen.getByText(/\$200/i)).toBeInTheDocument();
      });

      const cashBtn = screen.getByRole('radio', { name: /efectivo/i });
      fireEvent.click(cashBtn);

      const registrarBtn = screen.getByRole('button', { name: /registrar cobro/i });
      fireEvent.click(registrarBtn);

      const confirmBtn = screen.getByRole('button', { name: 'Confirmar cobro' });
      fireEvent.click(confirmBtn);

      // Debe mostrar alerta de error SESSION_CLOSE_FAILED y botón Reintentar cierre
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reintentar cierre/i })).toBeInTheDocument();
      });

      // Click en Reintentar cierre
      const retryBtn = screen.getByRole('button', { name: /reintentar cierre/i });
      fireEvent.click(retryBtn);

      // Segundo intento tiene éxito
      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('H9: Flujo completo con GET /v1/tables — resuelve nombres de mesa, distingue sesiones gemelas y muestra métodos en español', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      // GET /v1/tables
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              tableId: 'tbl-vip-77',
              tenantId: 't-1',
              label: 'Mesa VIP 77',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }

      // GET /v1/sessions?status=active: dos sesiones en la misma mesa (sesiones gemelas)
      if (urlStr.includes('/v1/sessions?status=active')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-gemela-111111',
              tenantId: 't-1',
              tableId: 'tbl-vip-77',
              status: 'active',
              createdAt: '2026-10-11T12:00:00.000Z',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            {
              sessionId: 'sess-gemela-222222',
              tenantId: 't-1',
              tableId: 'tbl-vip-77',
              status: 'active',
              createdAt: '2026-10-11T13:30:00.000Z',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      // GET /v1/checkout/sess-gemela-111111
      if (urlStr.includes('/v1/checkout/sess-gemela-111111')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-gemela-111111',
            tableId: 'tbl-vip-77',
            ordersCount: 1,
            total: 3500,
            payment: null,
            orders: [
              {
                id: 'order-33334444',
                tenantId: 't-1',
                sessionId: 'sess-gemela-111111',
                tableId: 'tbl-vip-77',
                status: 'READY',
                total: 3500,
                items: [
                  {
                    id: 'it-1',
                    productId: 'p-1',
                    productName: 'Asado Especial',
                    unitPrice: 3500,
                    quantity: 1,
                    modifiers: [],
                  },
                ],
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        };
      }

      // POST /v1/checkout/confirm
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-card-1',
            sessionId: 'sess-gemela-111111',
            tableId: 'tbl-vip-77',
            amount: 3500,
            method: 'CARD',
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

      // (a) Nombre de mesa resuelto con getTableDisplayName
      await waitFor(() => {
        const vipHeaders = screen.getAllByText('Mesa VIP 77');
        expect(vipHeaders).toHaveLength(2);
      });

      // (b) Sesiones gemelas son distinguibles en la grilla
      expect(screen.getByText(/Sesión #111111/i)).toBeInTheDocument();
      expect(screen.getByText(/Sesión #222222/i)).toBeInTheDocument();

      // Seleccionar la primera sesión
      fireEvent.click(screen.getByText(/Sesión #111111/i));

      // Resumen de cuenta muestra el nombre real y formato de orden
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa VIP 77')).toBeInTheDocument();
        expect(screen.getByText(/Orden #334444/i)).toBeInTheDocument();
      });

      // (c) Elegir Tarjeta
      const cardRadio = screen.getByRole('radio', { name: 'Tarjeta' });
      fireEvent.click(cardRadio);

      // Confirmar cobro
      fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Tarjeta')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cobro' }));

      // Tarjeta de éxito muestra nombre real y método en español
      await waitFor(() => {
        expect(screen.getByText(/Mesa VIP 77 • Total: \$3500 • Medio: Tarjeta/i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
