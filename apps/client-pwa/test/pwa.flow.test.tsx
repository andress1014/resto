import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TableLandingPage from '../src/app/t/[tenantId]/[tableId]/page';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}));

describe('Bloque 4: PWA Flujos Reales (Tests Rojo)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = null;
    PwaApiClient.session = null;
    mockPush.mockClear();
  });

  test('Landing navega con router.push a la ruta anidada /t/:tenantId/:tableId/menu tras openSession', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      if (url.toString().includes('/v1/sessions/open')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            guestToken: 'session-token-xyz',
            session: { sessionId: 's-1', tableId: 'tb-1', tenantId: 't-1', status: 'active' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <TableLandingPage
          params={{ tenantId: 'tenant-abc', tableId: 'table-123' }}
          searchParams={{ k: 'qr-key-1' }}
        />
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/t/tenant-abc/table-123/menu');
        expect(sessionStorage.getItem('resto_guest_token')).toBe('session-token-xyz');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Menu carga productos, abre detalle, agrega al carrito y confirma pedido con checkout CASH', async () => {
    const originalFetch = global.fetch;
    PwaApiClient.guestToken = 'token-guest-real';
    PwaApiClient.session = { sessionId: 'sess-real', tableId: 'tb-real', tenantId: 'tenant-real' };

    let cartState = {
      tenantId: 'tenant-real',
      sessionId: 'sess-real',
      items: [] as any[],
      total: 0,
    };

    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Entradas' }],
              products: [
                {
                  id: 'prod-pwa-1',
                  name: 'Tacos Dorados',
                  price: 85,
                  categoryId: 'cat-1',
                  isAvailable: true,
                  modifierGroups: [],
                },
              ],
            },
          }),
        };
      }

      if (urlStr.includes('/v1/cart/items') && opts?.method === 'POST') {
        const item = {
          cartItemId: 'item-1',
          productId: 'prod-pwa-1',
          productName: 'Tacos Dorados',
          quantity: 1,
          unitPrice: 85,
          lineTotal: 85,
          addedBy: 'Cliente',
        };
        cartState.items.push(item);
        cartState.total += 85;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => cartState,
        };
      }

      if (urlStr.endsWith('/v1/cart') && (!opts?.method || opts?.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => cartState,
        };
      }

      if (urlStr.includes('/v1/cart/confirm') && opts?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ id: 'order-123', status: 'CONFIRMED' }),
        };
      }

      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ paymentId: 'pay-1', status: 'PAID' }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      // Carga productos
      await waitFor(() => {
        expect(screen.getByText('Tacos Dorados')).toBeInTheDocument();
      });

      // Tocar producto abre detalle
      fireEvent.click(screen.getByText('Tacos Dorados'));
      const addBtn = await screen.findByRole('button', { name: /añadir al carrito|agregar/i });
      fireEvent.click(addBtn);

      // Ver carrito con CartFab
      await waitFor(() => {
        const fab = screen.getByTestId('stub-cart-fab');
        expect(fab).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('stub-cart-fab'));
      expect(await screen.findByText('Tu Carrito')).toBeInTheDocument();

      // Confirmar pedido
      const sendBtn = screen.getByRole('button', { name: /enviar pedido/i });
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/v1/cart/confirm'),
          expect.anything()
        );
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('HALLAZGO 3: addToCart envía display con productName, unitPrice y modifierNames reales desde la selección', async () => {
    let capturedBody: any = null;
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
              categories: [{ id: 'cat-1', name: 'Platos' }],
              products: [
                {
                  id: 'prod-42',
                  name: 'Hamburguesa Doble',
                  price: 850,
                  isAvailable: true,
                  category: { id: 'cat-1' },
                  modifierGroups: [
                    {
                      id: 'mg-1',
                      name: 'Salsas',
                      options: [{ id: 'opt-1', name: 'BBQ', priceDelta: 50 }],
                    },
                  ],
                },
              ],
            },
          }),
        };
      }

      if (urlStr.includes('/v1/cart/items') && opts?.method === 'POST') {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            cartId: 'cart-1',
            sessionId: 's-tb-real',
            items: [
              {
                cartItemId: 'item-1',
                productId: 'prod-42',
                quantity: 1,
                unitPrice: 850,
                display: capturedBody.display,
              },
            ],
            total: 900,
          }),
        };
      }

      if (urlStr.endsWith('/v1/cart')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ cartId: 'cart-1', sessionId: 's-tb-real', items: [], total: 0 }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      PwaApiClient.guestToken = 'mock-guest-token';
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      await waitFor(() => {
        expect(screen.getByText('Hamburguesa Doble')).toBeInTheDocument();
      });

      // Abre modal de detalle
      fireEvent.click(screen.getByText('Hamburguesa Doble'));

      // Selecciona modificador si aplica
      const modOption = await screen.findByText(/BBQ/i);
      fireEvent.click(modOption);

      const addBtn = await screen.findByRole('button', { name: /añadir al carrito|agregar/i });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(capturedBody).not.toBeNull();
      });

      expect(capturedBody.productId).toBe('prod-42');
      expect(capturedBody.display).toBeDefined();
      expect(capturedBody.display.productName).toBe('Hamburguesa Doble');
      expect(capturedBody.display.unitPrice).toBe(850);
      expect(capturedBody.display.modifierNames).toEqual(expect.arrayContaining(['BBQ']));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
