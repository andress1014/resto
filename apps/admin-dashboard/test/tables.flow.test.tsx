import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TablesPage from '../src/app/(panel)/mesas/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}));

describe('Gestión de Mesas en Admin Dashboard (Tests Rojo/Verde)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'mock-admin-token';
    mockPush.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('1. Renderiza lista de mesas mockeadas con tableId en BentoGrid tras GET /v1/tables y /v1/sessions', async () => {
    const mockTables = [
      { tableId: 'tbl-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
      { tableId: 'tbl-2', label: 'Mesa Terraza', status: 'active', createdAt: '2026-10-06T11:00:00Z' },
    ];

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    const { container } = render(<TablesPage />);

    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('Mesa Terraza')).toBeInTheDocument();
    expect(container.querySelector('[data-component="bento-grid"]')).toBeInTheDocument();
  });

  test('2. Crear mesa envía POST /v1/tables con { label } y refresca la lista usando tableId', async () => {
    let tables = [{ tableId: 'tbl-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-06T10:00:00Z' }];

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        expect(body).toEqual({ label: 'Mesa Nueva 5' });
        const newTable = { tableId: 'tbl-5', label: 'Mesa Nueva 5', status: 'active', createdAt: '2026-10-06T12:00:00Z' };
        tables.push(newTable);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => newTable,
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [...tables],
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();

    const openModalBtn = screen.getByRole('button', { name: /Nueva Mesa/i });
    fireEvent.click(openModalBtn);

    const input = screen.getByLabelText(/Nombre o Identificador/i);
    fireEvent.change(input, { target: { value: 'Mesa Nueva 5' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar Mesa|Crear Mesa/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Mesa Nueva 5')).toBeInTheDocument();
  });

  test('3. Botón Ver QR fetchea GET /v1/tables/:tableId/qr usando tableId (sin undefined) y muestra pngDataUrl y URL textual', async () => {
    const mockTables = [
      { tableId: 'tbl-1', label: 'Mesa VIP', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
    ];

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables/tbl-1/qr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=key123',
            pngDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
          }),
        };
      }
      if (urlStr.includes('/v1/tables/undefined/qr')) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'Not found: undefined tableId' }),
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);
    expect(await screen.findByText('Mesa VIP')).toBeInTheDocument();

    const qrBtn = screen.getByRole('button', { name: /Ver QR/i });
    fireEvent.click(qrBtn);

    const qrImg = await screen.findByAltText(/QR Mesa VIP/i);
    expect(qrImg).toBeInTheDocument();
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA');
    expect(screen.getByText('http://localhost:3001/t/tenant-1/tbl-1?k=key123')).toBeInTheDocument();
  });

  test('4. Botón Rotar QR llama POST /v1/tables/:tableId/qr/rotate usando tableId real y actualiza el QR mostrado', async () => {
    const mockTables = [
      { tableId: 'tbl-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
    ];

    let rotated = false;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables/tbl-1/qr/rotate') && opts?.method === 'POST') {
        rotated = true;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=newkey456',
            pngDataUrl: 'data:image/png;base64,NEWROTATEDQRDATA',
          }),
        };
      }
      if (urlStr.includes('/v1/tables/tbl-1/qr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=key123',
            pngDataUrl: 'data:image/png;base64,OLDQRDATA',
          }),
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();

    const qrBtn = screen.getByRole('button', { name: /Ver QR/i });
    fireEvent.click(qrBtn);

    expect(await screen.findByText('http://localhost:3001/t/tenant-1/tbl-1?k=key123')).toBeInTheDocument();

    const rotateBtn = screen.getByRole('button', { name: /Rotar QR/i });
    fireEvent.click(rotateBtn);

    await waitFor(() => {
      expect(rotated).toBe(true);
      expect(screen.getByText('http://localhost:3001/t/tenant-1/tbl-1?k=newkey456')).toBeInTheDocument();
    });

    const qrImg = screen.getByAltText(/QR Mesa 1/i);
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,NEWROTATEDQRDATA');
  });

  test('5. Semántica de badge: Deshabilitada si status !== active, Ocupada si tiene sesión activa, Disponible si no', async () => {
    const mockTables = [
      { tableId: 'tbl-disab', label: 'Mesa Inactiva', status: 'inactive', createdAt: '2026-10-06T10:00:00Z' },
      { tableId: 'tbl-busy', label: 'Mesa Ocupada', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
      { tableId: 'tbl-free', label: 'Mesa Libre', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
    ];

    const mockActiveSessions = [
      { id: 'sess-1', tableId: 'tbl-busy', status: 'active' },
    ];

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockActiveSessions,
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);

    expect(await screen.findByText('Mesa Inactiva')).toBeInTheDocument();
    expect(screen.getByText('Mesa Ocupada')).toBeInTheDocument();
    expect(screen.getByText('Mesa Libre')).toBeInTheDocument();

    expect(screen.getByText('Deshabilitada')).toBeInTheDocument();
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  test('6. Error 403 al crear o rotar muestra mensaje inline accesible con role="alert"', async () => {
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables') && opts?.method === 'POST') {
        return {
          ok: false,
          status: 403,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'Acceso no autorizado: requiere permisos de administrador o encargado.' }),
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);

    const openModalBtn = await screen.findByRole('button', { name: /Nueva Mesa/i });
    fireEvent.click(openModalBtn);

    const input = screen.getByLabelText(/Nombre o Identificador/i);
    fireEvent.change(input, { target: { value: 'Mesa Prohibida' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar Mesa|Crear Mesa/i });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Acceso no autorizado/i);
  });

  test('7. Permite alternar entre vista Lista y Mapa de Mesas mostrando slots con tinta/punteado y leyenda', async () => {
    const mockTables = [
      { tableId: 'tbl-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
      { tableId: 'tbl-2', label: 'Mesa 2', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
    ];
    const mockActiveSessions = [{ id: 'sess-1', tableId: 'tbl-1', status: 'active' }];

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockActiveSessions,
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    const { container } = render(<TablesPage />);
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();

    // Cambiar a la vista Mapa
    const mapTab = screen.getByRole('tab', { name: /Mapa/i });
    fireEvent.click(mapTab);

    // Debe mostrar la leyenda y el contenedor del mapa
    expect(screen.getByText(/Leyenda/i)).toBeInTheDocument();
    expect(screen.getByTestId('tables-map-grid')).toBeInTheDocument();

    // Verificamos los slots de Mesa 1 (ocupada) y Mesa 2 (libre)
    const slotMesa1 = screen.getByTestId('slot-tbl-1');
    const slotMesa2 = screen.getByTestId('slot-tbl-2');
    expect(slotMesa1).toHaveAttribute('data-slot-status', 'ocupada');
    expect(slotMesa2).toHaveAttribute('data-slot-status', 'libre');

    // Cambiar de regreso a la vista Lista
    const listTab = screen.getByRole('tab', { name: /Lista/i });
    fireEvent.click(listTab);
    expect(container.querySelector('[data-component="bento-grid"]')).toBeInTheDocument();
  });

  test('8. Muestra estado vacío accesible (EmptyState) con acción de crear cuando no hay mesas', async () => {
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    const { container } = render(<TablesPage />);
    expect(await screen.findByText('No hay mesas registradas')).toBeInTheDocument();
    expect(container.querySelector('[data-component="empty-state"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear primera mesa/i })).toBeInTheDocument();
  });

  test('9. Muestra ErrorState accesible y permite reintentar cuando falla la carga', async () => {
    let attempts = 0;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables')) {
        attempts++;
        if (attempts === 1) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'Fallo al conectar con el servidor' }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [{ tableId: 'tbl-recov', label: 'Mesa Recuperada', status: 'active', createdAt: '2026-10-06T10:00:00Z' }],
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    const { container } = render(<TablesPage />);
    expect(await screen.findByText(/Fallo al conectar con el servidor/i)).toBeInTheDocument();
    expect(container.querySelector('[data-component="error-state"]')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByText('Mesa Recuperada')).toBeInTheDocument();
  });

  test('10. Modal QR puede cerrarse con la tecla Escape o el botón de cerrar', async () => {
    const mockTables = [
      { tableId: 'tbl-1', label: 'Mesa QR', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
    ];

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables/tbl-1/qr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=key123',
            pngDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
          }),
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);
    expect(await screen.findByText('Mesa QR')).toBeInTheDocument();

    const qrBtn = screen.getByRole('button', { name: /Ver QR/i });
    fireEvent.click(qrBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Presionar Escape para cerrar el modal
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('11. H3: Ningún botón en Mesas usa colores warning o amber (fondo ni borde) y Rotar QR usa tinta/papel', async () => {
    const mockTables = [
      { tableId: 'tbl-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-06T10:00:00Z' },
    ];

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/tables/tbl-1/qr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=key123',
            pngDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
          }),
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockTables,
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<TablesPage />);
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();

    // Abrir modal QR
    const qrBtn = screen.getByRole('button', { name: /Ver QR/i });
    fireEvent.click(qrBtn);

    const rotateBtn = await screen.findByRole('button', { name: /Rotar QR/i });
    expect(rotateBtn).toBeInTheDocument();

    // Comprobar todos los botones en el documento
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(0);

    for (const btn of allButtons) {
      const styleAttr = btn.getAttribute('style') || '';
      expect(styleAttr).not.toContain('var(--bento-warning)');
      expect(styleAttr).not.toContain('var(--bento-amber)');
    }

    // Lección aprendida: jsdom puede no retener CSS variables en inline styles.
    // Verificamos directamente el archivo fuente de mesas/page.tsx:
    const fs = require('fs');
    const path = require('path');
    const mesasSource = fs.readFileSync(path.resolve(__dirname, '../src/app/(panel)/mesas/page.tsx'), 'utf-8');

    expect(mesasSource).not.toContain('var(--bento-warning)');
    expect(mesasSource).not.toContain('var(--bento-amber)');
    expect(mesasSource).toMatch(/Rotar QR[\s\S]*?var\(--bento-tinta\)|var\(--bento-tinta\)[\s\S]*?Rotar QR/);
    expect(mesasSource).toMatch(/Rotar QR[\s\S]*?var\(--bento-papel\)|var\(--bento-papel\)[\s\S]*?Rotar QR/);
  });
});

