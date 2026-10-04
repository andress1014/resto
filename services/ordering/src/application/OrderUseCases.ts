import {
  CancelOrderUseCase,
  CatalogValidationPort,
  CartRepository,
  ConfirmOrderUseCase,
  EventPublisher,
  GetOrderUseCase,
  ListSessionOrdersUseCase,
  ListTenantOrdersUseCase,
  OrderDTO,
  OrderRepository,
  UpdateOrderStatusUseCase,
} from '@packages/shared-types';
import {
  CartEmptyError,
  ForbiddenError,
  OrderNotFoundError,
  InvalidStatusTransitionError,
} from '../domain/errors';
import { canTransition } from '../domain/orderStatusMachine';
import { validateAndPriceCart } from '../domain/pricing';
import { config } from '../config';

export class OrderUseCases {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly cartRepo: CartRepository,
    private readonly catalogValidation: CatalogValidationPort,
    private readonly eventPublisher?: EventPublisher
  ) {}

  updateOrderStatus: UpdateOrderStatusUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (!canTransition(order.status, input.status)) {
        throw new InvalidStatusTransitionError();
      }

      const updated = await this.orderRepo.updateStatus(
        input.tenantId,
        input.orderId,
        input.status,
        new Date()
      );

      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.status-changed',
          order: updated,
          previousStatus: order.status,
          occurredAt: new Date().toISOString(),
        });
      }

      return updated;
    },
  };

  confirmOrder: ConfirmOrderUseCase = {
    execute: async (input) => {
      const cart = await this.cartRepo.get(
        input.tenantId,
        input.sessionId,
        config.cartTtlSeconds
      );

      if (!cart.items || cart.items.length === 0) {
        throw new CartEmptyError();
      }

      const productIds = Array.from(new Set(cart.items.map((i) => i.productId)));
      const validatedProducts = await this.catalogValidation.getOrderableProducts(
        input.tenantId,
        productIds
      );

      const priced = validateAndPriceCart(cart.items, validatedProducts);

      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const order: OrderDTO = {
        id: orderId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        tableId: input.tableId,
        status: 'PLACED',
        total: priced.total,
        items: priced.items,
        createdAt: new Date().toISOString(),
      };

      // Guardar orden (atómico)
      const savedOrder = await this.orderRepo.save(input.tenantId, order);

      // Limpiar carrito solo si el guardado fue exitoso
      await this.cartRepo.clear(input.tenantId, input.sessionId);

      // Publicar evento solo tras commit exitoso
      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.created',
          order: savedOrder,
          occurredAt: new Date().toISOString(),
        });
      }

      return savedOrder;
    },
  };

  getOrder: GetOrderUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (input.requester.role === 'guest' && order.sessionId !== input.requester.sessionId) {
        throw new ForbiddenError('No puedes ver órdenes de otra mesa');
      }

      return order;
    },
  };

  listSessionOrders: ListSessionOrdersUseCase = {
    execute: async (input) => {
      return this.orderRepo.listBySession(input.tenantId, input.sessionId);
    },
  };

  listTenantOrders: ListTenantOrdersUseCase = {
    execute: async (input) => {
      return this.orderRepo.listByTenant(input.tenantId, input.filter);
    },
  };

  cancelOrder: CancelOrderUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (!canTransition(order.status, 'CANCELLED')) {
        throw new InvalidStatusTransitionError();
      }

      const cancelled = await this.orderRepo.cancel(input.tenantId, input.orderId, new Date());

      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.status-changed',
          order: cancelled,
          previousStatus: order.status,
          occurredAt: new Date().toISOString(),
        });
      }

      return cancelled;
    },
  };
}
