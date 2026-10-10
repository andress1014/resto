import '@testing-library/jest-dom';

const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

let registeredAttempts = 0;

const originalFetch = global.fetch;

export const server = {
  listen: () => {
    global.fetch = jest.fn(async (url: any, options: any) => {
      const urlStr = url.toString();
      
      if (urlStr.includes('/v1/auth/register') && options?.method === 'POST') {
        registeredAttempts++;
        if (registeredAttempts > 1) {
          return {
            ok: false,
            status: 409,
            headers: { get: () => 'application/json' },
            json: async () => ({ code: 'CONFLICT', message: 'Slug ya registrado' })
          } as any;
        }
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({ ok: true, tokens: { accessToken: 'registered-access-token', refreshToken: 'registered-refresh-token', expiresIn: 900 } })
        } as any;
      }

      if (urlStr.includes('/v1/auth/login') && options?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ user: { id: 'user-1' }, tokens: { accessToken: 'logged-in-access-token', refreshToken: 'logged-in-refresh-token', expiresIn: 900 } })
        } as any;
      }

      if (urlStr.includes('/v1/auth/refresh') && options?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ accessToken: 'refreshed-access-token' })
        } as any;
      }

      if (urlStr.includes('/v1/graphql') && options?.method === 'POST') {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (body.query && body.query.includes('mutation') && body.query.includes('createProduct')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createProduct: {
                  id: 'prod-new',
                  name: 'Nuevo Producto Test',
                  price: 100,
                  isAvailable: true,
                  category: { id: 'cat-1' },
                },
              },
            }),
          } as any;
        }

        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-1', name: 'Entradas' },
                { id: 'cat-2', name: 'Platos Fuertes' },
              ],
              products: [],
            },
          }),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({})
      } as any;
    });
  },
  resetHandlers: () => {
    // Intentionally do not reset registeredAttempts here, 
    // to preserve the test interdependency that test 30 expects.
  },
  close: () => {
    global.fetch = originalFetch;
  }
};

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());
