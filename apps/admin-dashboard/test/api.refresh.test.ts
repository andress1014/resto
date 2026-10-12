import { ApiClient } from '../src/lib/api';

describe('ApiClient - Manejo de Token Vencido y Refresh (H10)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    ApiClient.clearAuth();
  });

  const mockJsonResponse = (status: number, body: any) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('(a) 401 en petición normal dispara POST /v1/auth/refresh; tras recibir nuevo accessToken, reintenta la petición original con el nuevo token y tiene éxito', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'valid-refresh-token';

    const fetchMock = jest
      .fn()
      // 1. Petición original -> 401 Unauthorized
      .mockResolvedValueOnce(
        mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Access token expired' })
      )
      // 2. Intento de refresh -> 200 OK con nuevo accessToken y nuevo refreshToken
      .mockResolvedValueOnce(
        mockJsonResponse(200, {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
          expiresIn: 900,
        })
      )
      // 3. Reintento de la petición original con nuevo token -> 200 OK
      .mockResolvedValueOnce(
        mockJsonResponse(200, { id: 'u1', email: 'admin@resto.test' })
      );

    global.fetch = fetchMock as any;

    const res = await ApiClient.request('/v1/identity/me');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 'u1', email: 'admin@resto.test' });

    // Verificamos los 3 llamados
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Llamado 1: Original con token expirado
    const [url1, opts1] = fetchMock.mock.calls[0];
    expect(String(url1)).toContain('/v1/identity/me');
    expect(opts1.headers.Authorization).toBe('Bearer expired-access-token');

    // Llamado 2: Refresh token endpoint
    const [url2, opts2] = fetchMock.mock.calls[1];
    expect(String(url2)).toContain('/v1/auth/refresh');
    expect(opts2.method).toBe('POST');
    expect(JSON.parse(opts2.body)).toEqual({ refreshToken: 'valid-refresh-token' });

    // Llamado 3: Reintento con nuevo token y _retried flag
    const [url3, opts3] = fetchMock.mock.calls[2];
    expect(String(url3)).toContain('/v1/identity/me');
    expect(opts3.headers.Authorization).toBe('Bearer fresh-access-token');
    expect(opts3._retried).toBe(true);

    // Verificamos actualización en memoria y localStorage
    expect(ApiClient.token).toBe('fresh-access-token');
    expect(ApiClient.refreshToken).toBe('fresh-refresh-token');
    expect(localStorage.getItem('resto_access_token')).toBe('fresh-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('fresh-refresh-token');
  });

  it('(b) 401 en petición normal dispara POST /v1/auth/refresh; si el refresh falla con 401, se limpian los tokens de ApiClient y localStorage y se redirige a /login', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'expired-refresh-token';

    expect(localStorage.getItem('resto_access_token')).toBe('expired-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('expired-refresh-token');

    // Mockeamos window.location para verificar redirección
    const originalLocation = window.location;
    const locationMock = {
      href: 'http://localhost/dashboard',
      pathname: '/dashboard',
    };
    try {
      delete (window as any).location;
      (window as any).location = locationMock;
    } catch {
      // jsdom puede impedir delete en algunas versiones
    }

    const fetchMock = jest
      .fn()
      // 1. Petición original -> 401 Unauthorized
      .mockResolvedValueOnce(
        mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Access token expired' })
      )
      // 2. Refresh falla -> 401 Invalid Refresh Token
      .mockResolvedValueOnce(
        mockJsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'Refresh token expired' })
      );

    global.fetch = fetchMock as any;

    let thrownError: any = null;
    try {
      await ApiClient.request('/v1/identity/me');
    } catch (err) {
      thrownError = err;
    } finally {
      // Restaurar location
      try {
        (window as any).location = originalLocation;
      } catch {
        // ignore
      }
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.status).toBe(401);
    expect(thrownError.message).toMatch(/sesión ha expirado/i);

    // Refresh fue llamado una vez
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Tokens en ApiClient y localStorage deben haberse limpiado completamente
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
    expect(localStorage.getItem('resto_access_token')).toBeNull();
    expect(localStorage.getItem('resto_refresh_token')).toBeNull();

    // Redirección a /login verificada en el mock
    expect(locationMock.href).toBe('/login');
  });

  it('(c) Petición con _retried: true ante 401 no reintenta en bucle', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'some-refresh-token';

    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Token still invalid' })
    );

    global.fetch = fetchMock as any;

    let thrownError: any = null;
    try {
      await ApiClient.request('/v1/identity/me', { _retried: true });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.status).toBe(401);

    // Se ejecutó EXACTAMENTE 1 sola vez; no disparó POST /v1/auth/refresh ni bucle infinito
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).not.toContain('/v1/auth/refresh');
  });
});
