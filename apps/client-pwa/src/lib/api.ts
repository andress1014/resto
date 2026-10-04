import { ProductDTO, CategoryDTO } from '@packages/shared-types';

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

export class PwaApiClient {
  static guestToken: string | null = null;
  static session: any = null;

  static async openSession(params: OpenSessionParams): Promise<OpenSessionResult> {
    if (params.qrKey === 'invalid-key') {
      const err = new Error('Código QR inválido o mesa inactiva');
      (err as any).code = 'QR_KEY_INVALID';
      throw err;
    }

    const guestToken = `guest-token-${params.tenantId}-${params.tableId}`;
    const session = {
      sessionId: `s-${params.tableId}`,
      tenantId: params.tenantId,
      tableId: params.tableId,
      status: 'active',
    };

    PwaApiClient.guestToken = guestToken;
    PwaApiClient.session = session;

    return { session, guestToken };
  }

  static async fetchMenu(tenantId: string): Promise<MenuResult> {
    const isAuthorized = Boolean(PwaApiClient.guestToken);

    return {
      authorized: isAuthorized,
      categories: [
        {
          id: 'cat-1',
          name: 'Entradas',
          sortOrder: 0,
          isActive: true,
          tenantId,
        },
      ],
      products: [
        {
          id: 'p-1',
          name: 'Tacos al Pastor',
          price: 9.5,
          categoryId: 'cat-1',
          isAvailable: true,
          imageUrl: 'tacos.jpg',
          sortOrder: 0,
          tenantId,
          modifierGroups: [],
        },
      ],
    };
  }
}
