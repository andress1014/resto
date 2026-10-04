import { OrderStatus, ORDER_STATUS_TRANSITIONS } from '@packages/shared-types';

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
