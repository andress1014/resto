import { ProductDTO, CategoryDTO, CartDTO } from '@packages/shared-types';

export interface OpenSessionParams {
  tenantId: string;
  tableId: string;
  qrKey: string;
}

export interface OpenSessionResult {
  session: {
    sessionId: string;
    tenantId: string;
    tableId: string;
    status: string;
  };
  guestToken: string;
}

export interface MenuResult {
  authorized: boolean;
  categories: CategoryDTO[];
  products: ProductDTO[];
}

const GUEST_TOKEN_KEY = 'resto_guest_token';
const GUEST_SESSION_KEY = 'resto_guest_session';

function getStoredGuestToken(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage.getItem(GUEST_TOKEN_KEY);
  }
  return null;
}

function getStoredSession(): any | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const raw = window.sessionStorage.getItem(GUEST_SESSION_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export class PwaApiClient {
  private static _guestToken: string | null = getStoredGuestToken();
  private static _session: any | null = getStoredSession();

  static get guestToken(): string | null {
    if (this._guestToken === null && typeof window !== 'undefined' && window.sessionStorage) {
      this._guestToken = window.sessionStorage.getItem(GUEST_TOKEN_KEY);
    }
    return this._guestToken;
  }

  static set guestToken(val: string | null) {
    this._guestToken = val;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (val) {
        window.sessionStorage.setItem(GUEST_TOKEN_KEY, val);
      } else {
        window.sessionStorage.removeItem(GUEST_TOKEN_KEY);
      }
    }
  }

  static get session(): any | null {
    if (this._session === null && typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(GUEST_SESSION_KEY);
      if (raw) {
        try {
          this._session = JSON.parse(raw);
        } catch {
          this._session = null;
        }
      }
    }
    return this._session;
  }

  static set session(val: any | null) {
    this._session = val;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (val) {
        window.sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(val));
      } else {
        window.sessionStorage.removeItem(GUEST_SESSION_KEY);
      }
    }
  }

  static async openSession(params: OpenSessionParams): Promise<OpenSessionResult> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/sessions/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Error abriendo sesión');
      (err as any).code = data.code || 'UNKNOWN';
      throw err;
    }

    PwaApiClient.guestToken = data.guestToken;
    PwaApiClient.session = data.session;

    return data;
  }

  static async fetchMenu(tenantId: string): Promise<MenuResult> {
    const isAuthorized = Boolean(PwaApiClient.guestToken);
    
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isAuthorized ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({
        query: `
          query GetMenu {
            categories { id name sortOrder isActive }
            products { id name price isAvailable imageUrl sortOrder category { id } modifierGroups { id name } }
          }
        `,
      })
    });

    const data = await res.json();

    const categories = (data?.data?.categories || []).map((c: any) => ({ ...c, tenantId }));
    const products = (data?.data?.products || []).map((p: any) => ({
      ...p,
      categoryId: p.categoryId ?? p.category?.id,
      tenantId,
    }));

    return {
      authorized: isAuthorized,
      categories,
      products,
    };
  }

  static async getCart(): Promise<CartDTO> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart`, {
      headers: {
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
    });
    if (!res.ok) {
      const err = new Error(await res.text());
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async addToCart(params: {
    productId: string;
    quantity: number;
    modifiers?: any[];
    notes?: string;
    display?: {
      productName: string;
      unitPrice: number;
      modifierNames: string[];
    };
  }): Promise<CartDTO> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({
        productId: params.productId,
        quantity: params.quantity,
        modifiers: params.modifiers || [],
        notes: params.notes || '',
        addedBy: 'Cliente',
        ...(params.display ? { display: params.display } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error al agregar al carrito');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async confirmOrder(tableId: string): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({ tableId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error al confirmar pedido');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async checkout(params: { sessionId: string; tableId: string; method?: string }): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/checkout/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        tableId: params.tableId,
        method: params.method || 'CASH',
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error en checkout');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async requestBill(tableId: string): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/service-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({
        tableId,
        note: 'Cuenta por favor',
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || data.error?.message || 'Error al solicitar la cuenta');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }
}
