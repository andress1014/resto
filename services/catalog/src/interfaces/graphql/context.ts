import { Request } from 'express';
import { GraphQLError } from 'graphql';

export interface CatalogContext {
  tenantId: string;
  userId?: string;
  role?: string;
}

export async function buildCatalogContext({ req }: { req: Request }): Promise<CatalogContext> {
  const tenantId = req.headers['x-tenant-id'] as string;
  const userId = req.headers['x-user-id'] as string | undefined;
  const role = req.headers['x-user-role'] as string | undefined;

  if (!tenantId) {
    throw new GraphQLError('UNAUTHENTICATED', {
      extensions: {
        code: 'UNAUTHENTICATED',
      },
    });
  }

  return {
    tenantId,
    userId,
    role,
  };
}
