import {
  BillDTO,
  CartRepository,
  ConfirmCheckoutUseCase,
  EventPublisher,
  GetBillUseCase,
  OrderRepository,
  PaymentDTO,
  PaymentRepository,
  ServiceCallRepository,
  SessionServicePort,
} from '@packages/shared-types';

export class CheckoutUseCases {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly sessionService: SessionServicePort,
    private readonly cartRepo: CartRepository,
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  getBill: GetBillUseCase = {
    execute: async (_input) => {
      throw new Error('Not implemented: GetBill');
    },
  };

  confirmCheckout: ConfirmCheckoutUseCase = {
    execute: async (_input) => {
      throw new Error('Not implemented: ConfirmCheckout');
    },
  };
}
