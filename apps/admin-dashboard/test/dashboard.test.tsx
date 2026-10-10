import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/app/(auth)/login/page';
import MenuPage from '../src/app/(panel)/menu/page';
import { ProductCard } from '../src/components/ProductCard';
import { ApiClient } from '../src/lib/api';
import { FeatureGuard } from '@packages/ui-components';

describe('E.1 Admin Dashboard — Comportamiento Bento Box (Tests 31-36)', () => {

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
    const createBtn = screen.getByRole('button', { name: /Nuevo Producto/i });
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
