import {
  BillDTO,
  GetBillUseCase,
  OrderRepository,
  PaymentRepository,
} from '@packages/shared-types';
import { calculateBill } from '../domain/bill';
import { BillNotFoundError } from '../domain/errors';

export class GetBill implements GetBillUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository
  ) {}

  async execute(input: { tenantId: string; sessionId: string }): Promise<BillDTO> {
    const { tenantId, sessionId } = input;
    const orders = await this.orderRepo.listBySession(tenantId, sessionId);

    if (!orders || orders.length === 0) {
      throw new BillNotFoundError(`BILL_NOT_FOUND: No orders found for session ${sessionId}`);
    }

    const calculated = calculateBill(orders);
    const payment = await this.paymentRepo.findBySession(tenantId, sessionId);

    const tableId = orders[0]?.tableId || payment?.tableId || '';

    return {
      sessionId,
      tableId,
      orders: calculated.orders,
      ordersCount: calculated.ordersCount,
      total: calculated.total,
      payment,
    };
  }
}
