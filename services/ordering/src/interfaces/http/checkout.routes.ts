import { Router } from 'express';
import { CheckoutUseCases } from '../../application/CheckoutUseCases';
import { ConfirmCheckoutResult } from '../../application/ConfirmCheckout';

export function createCheckoutRouter(checkoutUseCases: CheckoutUseCases): Router {
  const router = Router();

  // GET /checkout/:sessionId
  router.get('/:sessionId', async (req, res, next) => {
    try {
      const tenantId = req.auth?.tenantId;
      if (!tenantId) {
        return res.status(401).json({
          error: { code: 'TENANT_REQUIRED', message: 'Falta cabecera x-tenant-id' },
        });
      }

      const role = req.auth?.role?.toLowerCase();
      if (role && !['staff', 'manager', 'admin'].includes(role)) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Acceso denegado' },
        });
      }

      const bill = await checkoutUseCases.getBill.execute({
        tenantId,
        sessionId: req.params.sessionId,
      });

      return res.status(200).json(bill);
    } catch (err) {
      next(err);
    }
  });

  // POST /checkout/confirm
  router.post('/confirm', async (req, res, next) => {
    try {
      const tenantId = req.auth?.tenantId;
      if (!tenantId) {
        return res.status(401).json({
          error: { code: 'TENANT_REQUIRED', message: 'Falta cabecera x-tenant-id' },
        });
      }

      const role = req.auth?.role?.toLowerCase();
      if (!role || !['staff', 'manager', 'admin'].includes(role)) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo personal autorizado puede registrar cobros' },
        });
      }

      const { sessionId, tableId, method } = req.body;
      const recordedBy = req.auth?.userId || 'staff-unknown';

      const result = (await checkoutUseCases.confirmCheckout.execute({
        tenantId,
        sessionId,
        tableId,
        method,
        recordedBy,
      })) as ConfirmCheckoutResult;

      const statusCode = result.isExisting ? 200 : 201;
      return res.status(statusCode).json({
        bill: result.bill,
        payment: result.payment,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
