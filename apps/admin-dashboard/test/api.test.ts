import { ApiClient } from '../src/lib/api';

describe('ApiClient (contrato real)', () => {
  afterEach(() => {
    ApiClient.token = null;
  });

  it('propaga el error cuando fetch rechaza (red/CORS) en vez de devolver 200 vacio', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as any;
    try {
      await expect(ApiClient.request('/v1/identity/me')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    } finally {
      global.fetch = original;
    }
  });

  it('register() guarda tokens.accessToken del cuerpo de respuesta', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({
        tokens: { accessToken: 'registered-access-token', refreshToken: 'r', expiresIn: 900 },
      }),
    })) as any;
    try {
      await ApiClient.register({ restaurantName: 'X' });
      expect(ApiClient.token).toBe('registered-access-token');
    } finally {
      global.fetch = original;
    }
  });

  it('login() guarda tokens.accessToken y tokens.refreshToken del cuerpo { user, tokens }', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        user: { id: 'u1' },
        tokens: { accessToken: 'login-access', refreshToken: 'login-refresh', expiresIn: 900 },
      }),
    })) as any;
    try {
      await ApiClient.login({ email: 'a@b.c', password: 'x' });
      expect(ApiClient.token).toBe('login-access');
      expect((ApiClient as any).refreshToken).toBe('login-refresh');
    } finally {
      global.fetch = original;
    }
  });

  it('ante 401 hace POST /v1/auth/refresh con { refreshToken }, rota tokens y reintenta el request original', async () => {
    const original = global.fetch;
    ApiClient.token = 'expired';
    (ApiClient as any).refreshToken = 'old-refresh';
    const json = (status: number, body: any) => ({
      ok: status < 400,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
    });
    const mock = jest
      .fn()
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', message: 'expired' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    global.fetch = mock as any;
    try {
      const res = await ApiClient.request('/v1/identity/me');
      expect(res.status).toBe(200);
      const [refreshUrl, refreshOpts] = mock.mock.calls[1];
      expect(String(refreshUrl)).toContain('/v1/auth/refresh');
      expect(refreshOpts.method).toBe('POST');
      expect(JSON.parse(refreshOpts.body)).toEqual({ refreshToken: 'old-refresh' });
      const [, retryOpts] = mock.mock.calls[2];
      expect(retryOpts.headers.Authorization).toBe('Bearer new-access');
      expect(ApiClient.token).toBe('new-access');
      expect((ApiClient as any).refreshToken).toBe('new-refresh');
    } finally {
      global.fetch = original;
    }
  });

  it('ante 401 sin refreshToken almacenado propaga el 401 original sin llamar a refresh', async () => {
    const original = global.fetch;
    ApiClient.token = 'expired';
    (ApiClient as any).refreshToken = null;
    const mock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ code: 'UNAUTHORIZED', message: 'expired' }),
    });
    global.fetch = mock as any;
    try {
      await expect(ApiClient.request('/v1/identity/me')).rejects.toMatchObject({ status: 401 });
      expect(mock).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = original;
    }
  });

  it('si el refresh falla propaga el 401 original sin reintentar', async () => {
    const original = global.fetch;
    ApiClient.token = 'expired';
    (ApiClient as any).refreshToken = 'bad-refresh';
    const mock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ code: 'UNAUTHORIZED', message: 'x' }),
    });
    global.fetch = mock as any;
    try {
      await expect(ApiClient.request('/v1/identity/me')).rejects.toMatchObject({ status: 401 });
      expect(mock).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = original;
    }
  });
});

