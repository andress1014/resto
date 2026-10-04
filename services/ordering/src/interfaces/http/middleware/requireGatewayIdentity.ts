import { Request, Response, NextFunction } from 'express';

export interface GatewayAuth {
  tenantId: string;
  role?: string;
  userId?: string;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: GatewayAuth;
    }
  }
}

export function requireGatewayIdentity(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] as string;
  const role = req.headers['x-user-role'] as string;
  const userId = req.headers['x-user-id'] as string;
  const sessionId = req.headers['x-session-id'] as string;

  if (!tenantId) {
    return res.status(401).json({
      error: { code: 'TENANT_REQUIRED', message: 'Falta cabecera x-tenant-id' },
    });
  }

  req.auth = {
    tenantId,
    role,
    userId,
    sessionId,
  };

  // Rutas de carrito requieren sesión activa del guest
  if (req.path.startsWith('/cart') && !sessionId) {
    return res.status(401).json({
      error: { code: 'SESSION_REQUIRED', message: 'Sesión requerida para operaciones de carrito' },
    });
  }

  next();
}
