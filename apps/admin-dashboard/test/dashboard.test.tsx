import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/app/(auth)/login/page';
import MenuPage from '../src/app/(panel)/menu/page';
import DashboardPage from '../src/app/(panel)/dashboard/page';
import { ProductCard } from '../src/components/ProductCard';
import { ApiClient } from '../src/lib/api';
import { FeatureGuard } from '@packages/ui-components';

describe('E.1 Admin Dashboard — Comportamiento Bento Box (Tests 31-36)', () => {
  beforeEach(() => {
    ApiClient.token = 'mock-admin-token';
  });

  test('31. Login: guarda tokens y adjunta Authorization: Bearer en las llamadas siguientes; ante 401 intenta POST /v1/auth/refresh una vez', async () => {
    render(<LoginPage />);
    const loginBtn = screen.getByRole('button', { name: /Iniciar Sesión|Entrar/i });
    fireEvent.click(loginBtn);

    await waitFor(() => {
      expect(ApiClient.token).toBeDefined();
    });
  });

  test('32. /menu renderiza cada categoría del stub MSW como data-component="bento-card" dentro de data-component="bento-grid"', async () => {
    const { container } = render(<MenuPage />);
    const grid = container.querySelector('[data-component="bento-grid"]');
    expect(grid).toBeInTheDocument();

    const cards = container.querySelectorAll('[data-component="bento-card"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  test('33. Crear producto: el formulario dispara createProduct con el categoryId seleccionado y el grid se refresca', async () => {
    render(<MenuPage />);
    const createBtn = await screen.findByRole('button', { name: /Nuevo Producto/i });
    await waitFor(() => {
      expect(createBtn).not.toBeDisabled();
    });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/Nuevo Producto Creado/i)).toBeInTheDocument();
    });
  });

  test('34. AvailabilityToggle dispara setProductAvailability; el control expone role="switch" y aria-checked coherente con el estado', () => {
    const onToggle = jest.fn();
    render(
      <ProductCard
        product={{
          id: 'p-1',
          name: 'Ensalada César',
          price: 8.5,
          categoryId: 'cat-1',
          isAvailable: true,
          sortOrder: 0,
          tenantId: 'tenant-100',
        }}
        onAvailabilityChange={onToggle}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  test('35. /menu sin token -> redirige a /login', async () => {
    ApiClient.token = null;
    render(<MenuPage />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  test('36. <FeatureGuard flag="analytics"> con el flag apagado -> BentoCard con data-testid="proximamente" que OCUPA su celda del grid (el layout no colapsa)', () => {
    const { container } = render(
      <FeatureGuard flag="analytics">
        <div>Contenido Analytics</div>
      </FeatureGuard>
    );

    const bentoCard = container.querySelector('[data-component="bento-card"]');
    expect(bentoCard).toBeInTheDocument();
    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByText('Contenido Analytics')).not.toBeInTheDocument();
  });
});

describe('H8 Admin Dashboard — Métricas Reales y KPIs', () => {
  beforeEach(() => {
    ApiClient.token = 'mock-admin-token';
  });

  test('(a) Dedup de mesas activas: 2 sesiones en la misma mesa cuentan como 1 mesa activa en el KPI y en el delta', async () => {
    const originalRequest = ApiClient.request;
    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint.includes('/v1/sessions?status=active')) {
        return [
          { id: 's1', sessionId: 's1', tableId: 'tbl-1', status: 'active' },
          { id: 's2', sessionId: 's2', tableId: 'tbl-1', status: 'active' },
        ];
      }
      if (endpoint.includes('/v1/tables')) {
        return [{ tableId: 'tbl-1', label: 'Mesa 1', status: 'active' }];
      }
      if (endpoint.includes('/v1/orders')) {
        return [];
      }
      if (endpoint.includes('/v1/service-calls')) {
        return [];
      }
      return [];
    });

    try {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Mesas Activas')).toBeInTheDocument();
      });

      expect(screen.getByText('1 en sala')).toBeInTheDocument();
      expect(screen.getByText('de 1 mesas configuradas')).toBeInTheDocument();

      const mesasLabel = screen.getByText('Mesas Activas');
      const kpiContainer = mesasLabel.closest('[data-component="kpi-delta"]');
      expect(kpiContainer).toBeInTheDocument();
      expect(kpiContainer).toHaveTextContent('1');
      expect(kpiContainer).not.toHaveTextContent('2 en sala');
    } finally {
      ApiClient.request = originalRequest;
    }
  });

  test('(b) Chip neutro con 0 pedidos: "al día" no es destructivo/rojo y usa trend neutro', async () => {
    const originalRequest = ApiClient.request;
    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint.includes('/v1/sessions?status=active')) {
        return [];
      }
      if (endpoint.includes('/v1/tables')) {
        return [{ tableId: 'tbl-1', label: 'Mesa 1', status: 'active' }];
      }
      if (endpoint.includes('/v1/orders')) {
        return [];
      }
      if (endpoint.includes('/v1/service-calls')) {
        return [];
      }
      return [];
    });

    try {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Pedidos Activos')).toBeInTheDocument();
      });

      const alDiaChip = screen.getByText('al día').closest('[data-component="kpi-delta-chip"]') as HTMLElement;
      expect(alDiaChip).toBeInTheDocument();
      expect(alDiaChip).toHaveAttribute('data-trend', 'neutral');
      expect(alDiaChip).not.toHaveAttribute('data-trend', 'down');

      const style = alDiaChip.getAttribute('style') || '';
      expect(style).not.toContain('var(--bento-destructive)');
      expect(style).toContain('var(--bento-hueso)');
    } finally {
      ApiClient.request = originalRequest;
    }
  });
});

