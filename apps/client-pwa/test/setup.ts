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

const originalFetch = global.fetch;

export const server = {
  listen: () => {
    global.fetch = jest.fn(async (url: any, options: any) => {
      const urlStr = url.toString();
      
      if (urlStr.includes('/v1/sessions/open') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        if (body.qrKey === 'invalid-key') {
          return {
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({ code: 'QR_KEY_INVALID', message: 'Código QR inválido' })
          } as any;
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            session: {
              sessionId: `s-${body.tableId}`,
              tenantId: body.tenantId,
              tableId: body.tableId,
              status: 'active',
            },
            guestToken: `guest-token-${body.tenantId}-${body.tableId}`
          })
        } as any;
      }

      if (urlStr.includes('/graphql') && options?.method === 'POST') {
        const authHeader = options?.headers?.Authorization || options?.headers?.authorization;
        const isAuthorized = Boolean(authHeader);
        
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-1', name: 'Entradas', sortOrder: 0, isActive: true, tenantId: 't-1' }
              ],
              products: [
                { id: 'p-1', name: 'Tacos al Pastor', price: 9.5, categoryId: 'cat-1', isAvailable: true, imageUrl: 'tacos.jpg', sortOrder: 0, tenantId: 't-1', modifierGroups: [] }
              ]
            },
            authorized: isAuthorized // passed via meta if needed, but the ApiClient returns it
          })
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
