import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: string;
  [key: string]: any;
}

export function authMiddleware(requiredRoles?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token de autorización requerido',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
      (req as any).user = decoded;

      if (requiredRoles && requiredRoles.length > 0) {
        if (!decoded.role || !requiredRoles.includes(decoded.role)) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Permisos insuficientes para acceder al recurso',
            },
          });
        }
      }

      next();
    } catch {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token inválido o expirado',
        },
      });
    }
  };
}
