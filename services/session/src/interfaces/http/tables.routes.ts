import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  CreateTableUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from '../../application/TableUseCases';
import { TableRepository } from '@packages/shared-types';

export function createTablesRouter(deps: {
  tableRepo: TableRepository;
  createTableUseCase: CreateTableUseCaseImpl;
  generateTableQrUseCase: GenerateTableQrUseCaseImpl;
  rotateTableQrKeyUseCase: RotateTableQrKeyUseCaseImpl;
}): Router {
  const router = Router();
  const { tableRepo, createTableUseCase, generateTableQrUseCase, rotateTableQrKeyUseCase } = deps;

  // POST /tables -> staff (admin/manager)
  router.post(
    '/',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await createTableUseCase.execute({
          tenantId,
          label: req.body.label,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /tables -> staff
  router.get(
    '/',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const list = await tableRepo.listByTenant(tenantId);
        res.status(200).json(list);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /tables/:tableId -> admin/manager
  router.patch(
    '/:tableId',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const table = await tableRepo.findById(tenantId, req.params.tableId);
        if (!table) {
          return res.status(404).json({ error: { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' } });
        }
        const updated = await tableRepo.save(tenantId, {
          ...table,
          ...(req.body.label ? { label: req.body.label } : {}),
          ...(req.body.status ? { status: req.body.status } : {}),
        });
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /tables/:tableId/qr -> staff
  router.get(
    '/:tableId/qr',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const qr = await generateTableQrUseCase.execute({
          tenantId,
          tableId: req.params.tableId,
        });
        res.status(200).json(qr);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /tables/:tableId/qr/rotate -> admin/manager
  router.post(
    '/:tableId/qr/rotate',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const qr = await rotateTableQrKeyUseCase.execute({
          tenantId,
          tableId: req.params.tableId,
        });
        res.status(200).json(qr);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
