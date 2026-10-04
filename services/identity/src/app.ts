import express, { Request, Response, NextFunction } from 'express';
import { DomainError } from '@packages/shared-types';
import { RegisterTenantUseCaseImpl } from './application/RegisterTenant';
import { LoginUseCaseImpl } from './application/Login';
import { RefreshSessionUseCaseImpl } from './application/RefreshSession';
import { InviteUserUseCaseImpl } from './application/InviteUser';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
} from './infrastructure/fakes/InMemoryIdentityAdapters';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher';
import { JwtTokenIssuer } from './infrastructure/security/JwtTokenIssuer';

const sharedTenantRepo = new InMemoryTenantRepository();
const sharedUserRepo = new InMemoryUserRepository();
const sharedRefreshTokenRepo = new InMemoryRefreshTokenRepository();
const sharedPasswordHasher = new BcryptPasswordHasher();
const sharedTokenIssuer = new JwtTokenIssuer();

export function createIdentityApp(): express.Application {
  const app: express.Application = express();
  app.use(express.json());

  const registerTenant = new RegisterTenantUseCaseImpl(
    sharedTenantRepo,
    sharedUserRepo,
    sharedRefreshTokenRepo,
    sharedPasswordHasher,
    sharedTokenIssuer
  );

  const login = new LoginUseCaseImpl(
    sharedTenantRepo,
    sharedUserRepo,
    sharedRefreshTokenRepo,
    sharedPasswordHasher,
    sharedTokenIssuer
  );

  const refreshSession = new RefreshSessionUseCaseImpl(
    sharedUserRepo,
    sharedRefreshTokenRepo,
    sharedTokenIssuer
  );

  const inviteUser = new InviteUserUseCaseImpl(sharedUserRepo);

  // Health
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth routes
  app.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerTenant.execute(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await login.execute(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await refreshSession.execute(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Identity routes
  app.get('/identity/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = (req.headers['x-user-role'] as string) || 'STAFF';

      if (!userId || !tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      const user = await sharedUserRepo.findById(userId);
      if (user) {
        return res.status(200).json(user);
      }

      return res.status(200).json({
        id: userId,
        tenantId,
        email: `${userId}@resto.com`,
        displayName: 'Usuario Resto',
        role,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/identity/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const invited = await inviteUser.execute({
        tenantId,
        email: req.body.email,
        displayName: req.body.displayName,
        role: req.body.role || 'STAFF',
      });

      res.status(201).json(invited);
    } catch (err) {
      next(err);
    }
  });

  // Error middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = err.message || 'Error interno del servidor';

    if (err instanceof DomainError) {
      code = err.code;
      switch (err.code) {
        case 'VALIDATION_ERROR':
          status = 400;
          break;
        case 'INVALID_CREDENTIALS':
        case 'UNAUTHENTICATED':
          status = 401;
          break;
        case 'FORBIDDEN':
          status = 403;
          break;
        case 'NOT_FOUND':
          status = 404;
          break;
        case 'EMAIL_TAKEN':
        case 'SLUG_TAKEN':
        case 'CONFLICT':
          status = 409;
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
  });

  return app;
}

export const app: express.Application = createIdentityApp();
