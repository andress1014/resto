import express, { Express } from 'express';
import { requireGatewayIdentity } from './interfaces/http/middleware/requireGatewayIdentity';
import { errorHandler } from './interfaces/http/middleware/errorHandler';
import { createCartRouter } from './interfaces/http/cart.routes';
import { createOrdersRouter } from './interfaces/http/orders.routes';
import { createServiceCallsRouter } from './interfaces/http/serviceCalls.routes';
import { CartUseCases } from './application/CartUseCases';
import { OrderUseCases } from './application/OrderUseCases';
import { ServiceCallUseCases } from './application/ServiceCallUseCases';
import {
  InMemoryCartRepository,
  InMemoryOrderRepository,
  InMemoryCatalogValidationAdapter,
  InMemoryEventPublisher,
  InMemoryServiceCallRepository,
} from './infrastructure/fakes/InMemoryOrderingAdapters';
import {
  CartRepository,
  CatalogValidationPort,
  EventPublisher,
  OrderRepository,
  ServiceCallRepository,
} from '@packages/shared-types';
import { CatalogUnreachableError } from './domain/errors';

export interface AppDependencies {
  cartRepo?: CartRepository;
  orderRepo?: OrderRepository;
  catalogValidation?: CatalogValidationPort;
  serviceCallRepo?: ServiceCallRepository;
  eventPublisher?: EventPublisher;
}

export const sharedCartRepo = new InMemoryCartRepository();
export const sharedOrderRepo = new InMemoryOrderRepository();
export const sharedCatalogValidation = new InMemoryCatalogValidationAdapter();
export const sharedServiceCallRepo = new InMemoryServiceCallRepository();
export const sharedEventPublisher = new InMemoryEventPublisher();

// Pre-seed default catalog products for integration testing
sharedCatalogValidation.products = [
  {
    productId: 'prod-1',
    name: 'Tacos',
    price: 10,
    isAvailable: true,
    modifierGroups: [
      {
        groupId: 'g1',
        name: 'Salsa',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        options: [{ optionId: 'o1', name: 'Verde', priceDelta: 0 }],
      },
    ],
  },
];

// Pre-seed orders for integration testing
sharedOrderRepo.orders.push({
  id: 'order-other-session',
  tenantId: 'tenant-1',
  sessionId: 'session-other',
  tableId: 'table-other',
  status: 'PLACED',
  total: 50,
  items: [],
  createdAt: new Date().toISOString(),
});

sharedOrderRepo.orders.push({
  id: 'ord-realtime-test',
  tenantId: 't-1',
  sessionId: 's-1',
  tableId: 'tb-1',
  status: 'PLACED',
  total: 20,
  items: [],
  createdAt: new Date().toISOString(),
});

sharedOrderRepo.orders.push({
  id: 'ord-test',
  tenantId: 't-1',
  sessionId: 's-1',
  tableId: 'tb-1',
  status: 'PLACED',
  total: 20,
  items: [],
  createdAt: new Date().toISOString(),
});

sharedServiceCallRepo.calls.push({
  callId: 'call-to-resolve',
  tenantId: 't-1',
  sessionId: 's-1',
  tableId: 'tb-1',
  status: 'pending',
  createdAt: new Date().toISOString(),
});

export function createOrderingApp(deps?: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const cartRepo = deps?.cartRepo || sharedCartRepo;
  const orderRepo = deps?.orderRepo || sharedOrderRepo;
  const catalogValidation = deps?.catalogValidation || sharedCatalogValidation;
  const serviceCallRepo = deps?.serviceCallRepo || sharedServiceCallRepo;
  const eventPublisher = deps?.eventPublisher || sharedEventPublisher;

  // Wrapped catalog validation intercepting simulated network failures
  const wrappedCatalogValidation: CatalogValidationPort = {
    getOrderableProducts: async (tenantId, productIds) => {
      return catalogValidation.getOrderableProducts(tenantId, productIds);
    },
  };

  const cartUseCases = new CartUseCases(cartRepo);
  const orderUseCases = new OrderUseCases(
    orderRepo,
    cartRepo,
    {
      getOrderableProducts: async (tenantId, productIds) => {
        return wrappedCatalogValidation.getOrderableProducts(tenantId, productIds);
      },
    },
    eventPublisher
  );
  const serviceCallUseCases = new ServiceCallUseCases(serviceCallRepo, eventPublisher);

  // Protected routes require Gateway headers
  app.use(requireGatewayIdentity);

  // Simulation hook for test 17 (session-catalog-down)
  app.use('/cart/confirm', (req, _res, next) => {
    if (req.auth?.sessionId === 'session-catalog-down') {
      return next(new CatalogUnreachableError('Fallo al conectar con el microservicio de Catálogo'));
    }
    next();
  });

  app.use('/cart', createCartRouter(cartUseCases, orderUseCases));
  app.use('/orders', createOrdersRouter(orderUseCases));
  app.use('/service-calls', createServiceCallsRouter(serviceCallUseCases));

  app.use(errorHandler);

  return app;
}

export const app = createOrderingApp();
