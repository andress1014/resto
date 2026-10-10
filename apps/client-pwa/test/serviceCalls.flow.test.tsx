import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('RONDA 5: FIX B2 & B3 - PWA Pedir la Cuenta con llamada de servicio y error inline (TDD Rojo)', () => {
  const provider = new StaticFeatureFlagProvider({ payments: true });

  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = 'guest-session-token';
    PwaApiClient.session = {
      sessionId: 'sess-pwa-1',
      tenantId: 'tenant-1',
      tableId: 'Mesa 3',
      status: 'active',
    };
    jest.clearAllMocks();
  });

  test('Botón "Pedir la cuenta" realiza POST /v1/service-calls y muestra confirmación inline', async () => {
    let capturedCallBody: any = null;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Entradas' }],
              products: [],
            },
          }),
        };
      }

      if (urlStr.endsWith('/v1/cart')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ cartId: 'c-1', sessionId: 'sess-pwa-1', items: [], total: 0 }),
        };
      }

      if (urlStr.includes('/v1/service-calls') && opts?.method === 'POST') {
        capturedCallBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            callId: 'sc-1',
            tenantId: 'tenant-1',
            sessionId: 'sess-pwa-1',
            tableId: 'Mesa 3',
            note: capturedCallBody.note,
            status: 'pending',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <ClientMenuPage params={{ tenantId: 'tenant-1', tableId: 'Mesa 3' }} />
        </FeatureFlagProviderRoot>
      );

      // El botón ahora debe ser "Pedir la cuenta", no "Pagar en Efectivo (Cerrar Mesa)"
      const requestBillBtn = await screen.findByRole('button', { name: /pedir la cuenta/i });
      expect(requestBillBtn).toBeInTheDocument();

      fireEvent.click(requestBillBtn);

      await waitFor(() => {
        expect(capturedCallBody).not.toBeNull();
      });

      expect(capturedCallBody.tableId).toBe('Mesa 3');
      expect(capturedCallBody.note).toMatch(/cuenta/i);

      // Confirmación inline amigable
      expect(
        await screen.findByText(/la cuenta fue solicitada, un mesero pasará por tu mesa/i)
      ).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Fallo al pedir la cuenta muestra error con role="alert" y NO llama alert() nativo', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: { categories: [], products: [] },
          }),
        };
      }

      if (urlStr.endsWith('/v1/cart')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ cartId: 'c-1', sessionId: 'sess-pwa-1', items: [], total: 0 }),
        };
      }

      if (urlStr.includes('/v1/service-calls') && opts?.method === 'POST') {
        return {
          ok: false,
          status: 500,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'Error en servicio de llamados' }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <ClientMenuPage params={{ tenantId: 'tenant-1', tableId: 'Mesa 3' }} />
        </FeatureFlagProviderRoot>
      );

      const requestBillBtn = await screen.findByRole('button', { name: /pedir la cuenta/i });
      fireEvent.click(requestBillBtn);

      const alertEl = await screen.findByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent(/error/i);
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      alertSpy.mockRestore();
      global.fetch = originalFetch;
    }
  });
});
