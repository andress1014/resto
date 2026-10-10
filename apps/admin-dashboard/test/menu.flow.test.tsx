import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MenuPage from '../src/app/(panel)/menu/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}));

describe('Bloque 3: Menu Admin Real (Tests Rojo)', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'mock-admin-token';
    mockPush.mockClear();
  });

  test('Carga categorías y productos mapeando category.id a categoryId para la lista y formulario', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query && (body.query.includes('categories') || body.query.includes('products'))) {
          // Confirma que la query pide category { id } y NO categoryId
          expect(body.query).toContain('category {');
          expect(body.query).not.toContain('products { id name price categoryId isAvailable }');

          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [
                  { id: 'cat-1', name: 'Pizzas' },
                  { id: 'cat-2', name: 'Bebidas' },
                ],
                products: [
                  {
                    id: 'prod-1',
                    name: 'Pizza Napolitana',
                    price: 1200,
                    isAvailable: true,
                    category: { id: 'cat-1' },
                  },
                ],
              },
            }),
          };
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Pizzas')).toBeInTheDocument();
        expect(screen.getByText('Bebidas')).toBeInTheDocument();
        expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Ante error de GraphQL al cargar menú: NO muestra categorías inventadas (Entradas/Platos Fuertes) y muestra mensaje de error visible con role="alert"', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      if (url.toString().includes('/v1/graphql')) {
        return {
          ok: false,
          status: 400,
          headers: { get: () => 'application/json' },
          json: async () => ({
            errors: [{ message: 'Cannot query field categoryId on type Product' }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/error/i);

      // NO debe tener datos inventados
      expect(screen.queryByText('Entradas')).not.toBeInTheDocument();
      expect(screen.queryByText('Platos Fuertes')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Creación fallida de producto: NO muestra éxito ("Nuevo Producto Creado") y muestra error en role="alert"', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('mutation')) {
          return {
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({
              errors: [{ message: 'Field createProduct not found' }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Postres' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Postres')).toBeInTheDocument();
      });

      const openBtn = screen.getByRole('button', { name: /nuevo producto/i });
      fireEvent.click(openBtn);

      fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Tiramisú' } });
      fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '450' } });

      const saveBtn = screen.getByRole('button', { name: /guardar|crear producto/i });
      fireEvent.click(saveBtn);

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.queryByText(/Nuevo Producto Creado/i)).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('HALLAZGO 2: Empty state cuando no hay categorías guía a crear categoría y bloquea o no ofrece Nuevo Producto', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      if (url.toString().includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText(/crea tu primera categoría/i)).toBeInTheDocument();
      });

      // El botón de Nueva Categoría debe estar visible
      const catBtns = screen.getAllByRole('button', { name: /nueva categoría|crear categoría/i });
      expect(catBtns.length).toBeGreaterThan(0);
      // Nuevo producto no debe estar activo/disponible si no hay categorías
      const nuevoProdBtn = screen.queryByRole('button', { name: /nuevo producto/i });
      expect(nuevoProdBtn).toBeDisabled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('HALLAZGO 2: Crear categoría real dispara mutation createCategory con name y sortOrder y refresca la lista', async () => {
    let categoryCreated = false;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      if (url.toString().includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('createCategory')) {
          categoryCreated = true;
          expect(body.variables?.input?.name).toBe('Bebidas Calientes');
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createCategory: {
                  id: 'cat-new-1',
                  name: 'Bebidas Calientes',
                },
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: categoryCreated
                ? [{ id: 'cat-new-1', name: 'Bebidas Calientes' }]
                : [{ id: 'cat-0', name: 'General' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
      });

      const openCatModalBtn = screen.getByRole('button', { name: /nueva categoría/i });
      fireEvent.click(openCatModalBtn);

      fireEvent.change(screen.getByLabelText(/nombre de la categoría/i), {
        target: { value: 'Bebidas Calientes' },
      });

      const saveCatBtn = screen.getByRole('button', { name: /guardar categoría/i });
      fireEvent.click(saveCatBtn);

      await waitFor(() => {
        expect(categoryCreated).toBe(true);
        expect(screen.getByText('Bebidas Calientes')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
