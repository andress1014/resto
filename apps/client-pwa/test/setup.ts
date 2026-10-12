import '@testing-library/jest-dom';

['backgroundColor', 'color', 'background', 'borderColor'].forEach((prop) => {
  const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
  if (desc && desc.set) {
    const origSet = desc.set;
    const kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
      get: desc.get,
      set(this: any, val: any) {
        if (typeof val === 'string' && val.includes('var(')) {
          if (typeof this._setProperty === 'function') {
            this._setProperty(kebab, val);
            return;
          }
        }
        return origSet.call(this, val);
      },
      configurable: true,
      enumerable: true,
    });
  }
});

const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn((url: string) => {
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', url);
      }
    }),
    replace: jest.fn((url: string) => {
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState({}, '', url);
      }
    }),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const originalFetch = global.fetch;

type MockHandler = (url: string, options: any) => Promise<any> | any;
let customHandlers: MockHandler[] = [];

function matchHandler(handler: any, url: string, options: any) {
  if (typeof handler === 'function') {
    return handler(url, options);
  }
  if (handler && handler.resolver && handler.method) {
    if ((options?.method || 'GET').toUpperCase() !== handler.method.toUpperCase()) {
      return undefined;
    }
    const path = handler.pathOrUrl;
    const matches = !path || path === '*' || url.includes(path.replace(/^\*/, ''));
    if (!matches) {
      return undefined;
    }
    const req = {
      url,
      method: options?.method || 'GET',
      headers: options?.headers,
      json: async () => (options?.body ? JSON.parse(options.body) : {}),
      text: async () => (options?.body || ''),
    };
    return handler.resolver({ request: req });
  }
  return undefined;
}

export const server = {
  use: (...handlers: any[]) => {
    customHandlers.unshift(...handlers);
  },
  listen: () => {
    global.fetch = jest.fn(async (url: any, options: any) => {
      const urlStr = url.toString();

      for (const handler of customHandlers) {
        const res = await matchHandler(handler, urlStr, options);
        if (res !== undefined) {
          return res;
        }
      }
      
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
    customHandlers = [];
  },
  close: () => {
    global.fetch = originalFetch;
    customHandlers = [];
  }
};

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  if (typeof window !== 'undefined' && window.history) {
    window.history.pushState({}, '', '/');
  }
});
afterAll(() => server.close());
