import { Request, Response, NextFunction } from 'express';

export function requireStaffRole(allowedRoles: string[] = ['staff', 'manager', 'admin']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req.headers['x-user-role'] as string || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!role || !normalizedAllowed.includes(role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Se requiere rol de personal autorizado',
        },
      });
    }

    next();
  };
}
