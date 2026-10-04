import { Request, Response, NextFunction } from 'express';
import { DomainError } from '@packages/shared-types';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = err.message || 'Error interno del servidor';

  if (err instanceof DomainError) {
    code = err.code;
    switch (err.code) {
      case 'VALIDATION_ERROR':
      case 'QR_KEY_INVALID':
      case 'TABLE_INACTIVE':
        status = 400;
        break;
      case 'UNAUTHENTICATED':
        status = 401;
        break;
      case 'FORBIDDEN':
        status = 403;
        break;
      case 'TABLE_NOT_FOUND':
      case 'SESSION_NOT_FOUND':
      case 'SESSION_EXPIRED':
      case 'NOT_FOUND':
        status = 404;
        break;
      default:
        status = 400;
        break;
    }
  }

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
