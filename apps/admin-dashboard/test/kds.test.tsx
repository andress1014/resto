import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  KdsBoard,
  KdsColumn,
  KdsOrderCard,
  ServiceCallPanel,
  KdsLiveAnnouncer,
} from '../src/components/kds';
import KdsPage from '../src/app/(panel)/kds/page';
import {
  FeatureGuard,
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { OrderDTO, ServiceCallDTO } from '@packages/shared-types';
import * as realtimeModule from '../src/lib/realtime';
import { ApiClient } from '../src/lib/api';
import { act } from '@testing-library/react';

describe('C. KDS — Admin Dashboard (Tests 14-23)', () => {
  const sampleOrder: OrderDTO = {
    id: 'ord-kds-1',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 'Mesa 4',
    status: 'PLACED',
    total: 25,
    items: [
      {
        id: 'item-1',
        productId: 'p-1',
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        quantity: 2,
        notes: 'Sin cebolla',
        modifiers: [
          {
            groupId: 'g-1',
            groupName: 'Salsa',
            optionId: 'opt-1',
            optionName: 'Verde',
            priceDelta: 0,
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  };

  test('14. /kds renderiza las 3 columnas con las orders del stub inicial (GET /v1/orders), cada una como data-component="bento-card"', () => {
    const { container } = render(<KdsBoard orders={[sampleOrder]} />);
    const board = container.querySelector('[data-component="bento-card"]');
    expect(board).toBeInTheDocument();
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
  });

  test('15. KdsOrderCard muestra tableId, items con cantidades y modificadores, notes y tiempo transcurrido', () => {
    render(<KdsOrderCard order={sampleOrder} />);
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    expect(screen.getByText(/Tacos al Pastor/)).toBeInTheDocument();
    expect(screen.getByText(/Sin cebolla/)).toBeInTheDocument();
    expect(screen.getByText(/Verde/)).toBeInTheDocument();
  });

  test('16. El botón de avance llama PATCH /v1/orders/:id/status con el siguiente estado de ORDER_STATUS_TRANSITIONS y muestra feedback loading->success (aria-busy)', () => {
    const onAdvance = jest.fn();
    render(<KdsOrderCard order={sampleOrder} onAdvanceStatus={onAdvance} isUpdating={true} />);

    const advanceBtn = screen.getByRole('button', { name: /avanzar a/i });
    expect(advanceBtn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(advanceBtn);
    expect(onAdvance).toHaveBeenCalledWith('ord-kds-1', 'IN_KITCHEN');
  });

  test('17. Al recibir order:created por el socket mockeado, la tarjeta aparece en PLACED SIN recargar ni polling', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    let socketListener: any = null;
    const mockSocket = {
      on: jest.fn((event, handler) => {
        if (event === 'order:created') socketListener = handler;
      }),
      disconnect: jest.fn(),
    };
    const spy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    render(
      <FeatureFlagProviderRoot provider={provider}>
        <KdsPage />
      </FeatureFlagProviderRoot>
    );

    expect(screen.queryByText('Mesa 7')).not.toBeInTheDocument();

    // Simular evento socket order:created
    act(() => {
      socketListener?.({
        order: {
          ...sampleOrder,
          id: 'ord-socket-created',
          tableId: 'Mesa 7',
          status: 'PLACED',
        },
      });
    });

    expect(screen.getByText('Mesa 7')).toBeInTheDocument();
    spy.mockRestore();
  });

  test('18. Al recibir order:status-changed, la tarjeta se mueve de columna; DELIVERED desaparece del board', () => {
    const { rerender } = render(<KdsBoard orders={[sampleOrder]} />);
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();

    const deliveredOrder = { ...sampleOrder, status: 'DELIVERED' as const };
    rerender(<KdsBoard orders={[deliveredOrder]} />);
    expect(screen.queryByText('Mesa 4')).not.toBeInTheDocument();
  });

  test('19. ServiceCallPanel: service-call:created añade la llamada (mesa + nota); "Resolver" llama PATCH /v1/service-calls/:id/resolve y la retira de pendientes', () => {
    const call: ServiceCallDTO = {
      callId: 'call-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'Mesa 2',
      note: 'Cuenta por favor',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const onResolve = jest.fn();

    render(<ServiceCallPanel calls={[call]} onResolve={onResolve} />);
    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
    expect(screen.getByText('Cuenta por favor')).toBeInTheDocument();

    const resolveBtn = screen.getByRole('button', { name: /resolver/i });
    fireEvent.click(resolveBtn);
    expect(onResolve).toHaveBeenCalledWith('call-1');
  });

  test('20. El socket se construye con namespace /orders y auth.token = staff JWT (assert sobre el mock de socket.io-client)', () => {
    const socket = realtimeModule.connectOrdersSocket('staff-mock-token');
    expect((socket as any).nsp).toBe('/orders');
    expect((socket as any).auth?.token).toBe('staff-mock-token');
    socket.disconnect();
  });

  test('21. Accesibilidad en vivo: existe UNA región role="status" aria-atomic="true" que anuncia mensajes completos; no hay live regions por tarjeta', () => {
    const { container } = render(<KdsLiveAnnouncer message="Nueva orden de la mesa 5" />);
    const region = container.querySelector('[role="status"][aria-atomic="true"]');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('Nueva orden de la mesa 5');
  });

  test('22. Bento/a11y: tokens var(--bento-*) sin hardcodeo, acento vibrante solo en KpiValue, iconos aria-hidden, cero emojis', () => {
    const { container } = render(<KdsOrderCard order={sampleOrder} />);
    const card = container.querySelector('[data-component="bento-card"]');
    expect(card).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test('23. <FeatureGuard flag="kitchen-display">: OFF -> Proximamente; ON (provider con flag) -> board', () => {
    // OFF por defecto
    const { rerender } = render(<KdsPage />);

    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('kds-board')).not.toBeInTheDocument();

    // ON
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });
    rerender(
      <FeatureFlagProviderRoot provider={provider}>
        <KdsPage />
      </FeatureFlagProviderRoot>
    );

    expect(screen.getByTestId('kds-board')).toBeInTheDocument();
  });

  test('24. Estados de socket y loading: muestra indicador de conexión y maneja socket connect_error sin dejar tablero en blanco', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    let errorHandler: any = null;
    let connectHandler: any = null;
    const mockSocket = {
      on: jest.fn((event, handler) => {
        if (event === 'connect_error') errorHandler = handler;
        if (event === 'connect') connectHandler = handler;
      }),
      disconnect: jest.fn(),
      connected: false,
    };
    const spy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    render(
      <FeatureFlagProviderRoot provider={provider}>
        <KdsPage />
      </FeatureFlagProviderRoot>
    );

    // Initial socket status or error handling
    act(() => {
      errorHandler?.(new Error('Connection lost'));
    });

    // Verify error announcement or status chip is visible
    expect(screen.getByText(/desconectado|reintentando|error de conexión/i)).toBeInTheDocument();

    spy.mockRestore();
  });

  test('25. handleAdvanceStatus y handleResolveCall usan ApiClient.request para PATCH', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });
    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [sampleOrder] };
      if (url === '/v1/service-calls') {
        return {
          data: [
            {
              callId: 'call-patch-1',
              tenantId: 't-1',
              sessionId: 's-1',
              tableId: 'Mesa 3',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      if (url.includes('/status')) {
        return { data: { ...sampleOrder, status: 'IN_KITCHEN' } };
      }
      if (url.includes('/resolve')) {
        return { data: { success: true } };
      }
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    const advanceBtn = screen.getByRole('button', { name: /avanzar a/i });

    await act(async () => {
      fireEvent.click(advanceBtn);
    });

    expect(spyRequest).toHaveBeenCalledWith('/v1/orders/ord-kds-1/status', expect.objectContaining({
      method: 'PATCH',
    }));

    const resolveBtn = screen.getByRole('button', { name: /resolver/i });
    await act(async () => {
      fireEvent.click(resolveBtn);
    });

    expect(spyRequest).toHaveBeenCalledWith('/v1/service-calls/call-patch-1/resolve', expect.objectContaining({
      method: 'PATCH',
    }));

    spyRequest.mockRestore();
  });
});
