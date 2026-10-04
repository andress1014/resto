export interface CartModifierInput {
  groupId: string;
  optionId: string;
}

export interface CartItemModifierDTO {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItemDTO {
  cartItemId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  modifiers: CartItemModifierDTO[];
  quantity: number;
  notes?: string;
  addedBy?: string;
  addedAt: string;
  lineTotal: number;
}

export interface CartDTO {
  tenantId: string;
  sessionId: string;
  items: CartItemDTO[];
  total: number;
}

export interface OrderModifierDTO {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  modifiers: OrderModifierDTO[];
}

export type OrderStatus = 'PLACED' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED';

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PLACED: ['IN_KITCHEN', 'CANCELLED'],
  IN_KITCHEN: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export interface OrderDTO {
  id: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  status: OrderStatus;
  total: number;
  items: OrderItemDTO[];
  createdAt: string;
  cancelledAt?: string;
}

export type OrderEventType = 'order.created' | 'order.status-changed';
export interface OrderEvent {
  type: OrderEventType;
  order: OrderDTO;
  previousStatus?: OrderStatus;
  occurredAt: string;
}

export type ServiceCallStatus = 'pending' | 'resolved';
export interface ServiceCallDTO {
  callId: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  note?: string;
  status: ServiceCallStatus;
  createdAt: string;
  resolvedAt?: string;
}

export type ServiceCallEventType = 'service-call.created' | 'service-call.resolved';
export interface ServiceCallEvent {
  type: ServiceCallEventType;
  call: ServiceCallDTO;
  occurredAt: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER';

export interface PaymentDTO {
  id: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  amount: number;
  method: PaymentMethod;
  ordersCount: number;
  recordedBy: string;
  createdAt: string;
}

export interface BillDTO {
  sessionId: string;
  tableId: string;
  orders: OrderDTO[];
  ordersCount: number;
  total: number;
  payment: PaymentDTO | null;
}

export interface CheckoutCompletedEvent {
  type: 'session.checkout-completed';
  sessionId: string;
  tableId: string;
  payment: PaymentDTO;
  occurredAt: string;
}

