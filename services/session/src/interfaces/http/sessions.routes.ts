import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  GetTableSessionUseCaseImpl,
  ListTableSessionsUseCaseImpl,
} from '../../application/SessionUseCases';

export function createSessionsRouter(deps: {
  openTableSessionUseCase: OpenTableSessionUseCaseImpl;
  closeTableSessionUseCase: CloseTableSessionUseCaseImpl;
  getTableSessionUseCase: GetTableSessionUseCaseImpl;
  listTableSessionsUseCase: ListTableSessionsUseCaseImpl;
}): Router {
  const router = Router();
  const {
    openTableSessionUseCase,
    closeTableSessionUseCase,
    getTableSessionUseCase,
    listTableSessionsUseCase,
  } = deps;

  // POST /sessions/open -> PÚBLICA
  router.post('/open', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, tableId, qrKey } = req.body;
      const result = await openTableSessionUseCase.execute({
        tenantId,
        tableId,
        qrKey,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /sessions/:id -> staff o guest con x-session-id coincidente
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const userRole = (req.headers['x-user-role'] as string || '').toLowerCase();
      const guestSessionId = req.headers['x-session-id'] as string;

      const isStaff = ['staff', 'manager', 'admin'].includes(userRole);

      if (!isStaff) {
        if (!guestSessionId || guestSessionId !== req.params.id) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'No autorizado para acceder a esta sesión',
            },
          });
        }
      }

      const role = isStaff ? userRole : 'guest';
      const session = await getTableSessionUseCase.execute({
        tenantId,
        sessionId: req.params.id,
        requester: { role, sessionId: guestSessionId },
      });

      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /sessions/:id/close -> staff
  router.patch(
    '/:id/close',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await closeTableSessionUseCase.execute({
          tenantId,
          sessionId: req.params.id,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /sessions -> staff
  router.get(
    '/',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const status = req.query.status as 'active' | 'closed' | undefined;
        const tableId = req.query.tableId as string | undefined;

        const list = await listTableSessionsUseCase.execute({
          tenantId,
          filter: { status, tableId },
        });
        res.status(200).json(list);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
