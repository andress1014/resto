import React from 'react';
import { OrderDTO, OrderStatus } from '@packages/shared-types';
import { KdsColumn } from './KdsColumn';

export interface KdsBoardProps {
  orders: OrderDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  updatingOrderId?: string | null;
}

export function KdsBoard({ orders, onAdvanceStatus, updatingOrderId }: KdsBoardProps) {
  // Solo mostramos órdenes en estados activos (DELIVERED y CANCELLED salen del board)
  const activeOrders = orders.filter((o) => ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status));

  return (
    <div
      data-testid="kds-board"
      className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
    >
      <KdsColumn
        status="PLACED"
        title="Por Preparar"
        orders={activeOrders}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
      />
      <KdsColumn
        status="IN_KITCHEN"
        title="En Cocina"
        orders={activeOrders}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
      />
      <KdsColumn
        status="READY"
        title="Listas"
        orders={activeOrders}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
      />
    </div>
  );
}
