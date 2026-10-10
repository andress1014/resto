import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/app/(auth)/login/page';
import RegisterPage from '../src/app/(auth)/register/page';
import PanelLayout from '../src/app/(panel)/layout';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

describe('Bloque 2: Auth Admin Real (Tests Rojo)', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = null;
    ApiClient.refreshToken = null;
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  test('Login envía credenciales tipeadas, guarda tokens en localStorage y navega con router.push', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      if (url.toString().includes('/v1/auth/login')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            tokens: { accessToken: 'real-access-token', refreshToken: 'real-refresh-token' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<LoginPage />);
      const emailInput = screen.getByLabelText(/correo|email/i);
      const passwordInput = screen.getByLabelText(/contraseña|password/i);
      const submitBtn = screen.getByRole('button', { name: /iniciar sesión|entrar/i });

      fireEvent.change(emailInput, { target: { value: 'chef@resto.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/v1/auth/login'),
          expect.objectContaining({
            body: expect.stringContaining('"email":"chef@resto.com"'),
          })
        );
        expect(localStorage.getItem('resto_access_token')).toBe('real-access-token');
        expect(localStorage.getItem('resto_refresh_token')).toBe('real-refresh-token');
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Login muestra mensaje de error visible con role="alert" ante 401', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Credenciales inválidas' }),
    })) as any;

    try {
      render(<LoginPage />);
      const emailInput = screen.getByLabelText(/correo|email/i);
      const passwordInput = screen.getByLabelText(/contraseña|password/i);
      const submitBtn = screen.getByRole('button', { name: /iniciar sesión|entrar/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@resto.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrong' } });
      fireEvent.click(submitBtn);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/inválidas|error/i);
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Register envía datos de registro, guarda tokens y redirige a /menu', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      if (url.toString().includes('/v1/auth/register')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            tokens: { accessToken: 'reg-access-token', refreshToken: 'reg-refresh-token' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<RegisterPage />);
      fireEvent.change(screen.getByLabelText(/nombre del restaurante|restaurante/i), { target: { value: 'La Trattoria' } });
      fireEvent.change(screen.getByLabelText(/correo|email/i), { target: { value: 'owner@trattoria.com' } });
      fireEvent.change(screen.getByLabelText(/contraseña|password/i), { target: { value: 'Pass1234' } });

      const submitBtn = screen.getByRole('button', { name: /registrar|crear cuenta/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(localStorage.getItem('resto_access_token')).toBe('reg-access-token');
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('PanelLayout: si no hay token en localStorage, router.replace redirige a /login', async () => {
    render(
      <PanelLayout>
        <div>Panel Secreto</div>
      </PanelLayout>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('Panel Secreto')).not.toBeInTheDocument();
  });
});
