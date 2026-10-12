import React from 'react';
import { OrderDTO, OrderStatus, TableDTO } from '@packages/shared-types';
import { KdsColumn } from './KdsColumn';

export interface KdsBoardProps {
  orders: OrderDTO[];
  tables?: TableDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  updatingOrderId?: string | null;
}

export function KdsBoard({ orders, tables, onAdvanceStatus, updatingOrderId }: KdsBoardProps) {
  // Solo mostramos órdenes en estados activos (DELIVERED y CANCELLED salen del board)
  const activeOrders = orders.filter((o) => ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status));

  return (
    <div
      data-testid="kds-board"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        width: '100%',
        alignItems: 'start',
      }}
    >
      <KdsColumn
        status="PLACED"
        title="Por Preparar"
        orders={activeOrders}
        tables={tables}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
      />
      <KdsColumn
        status="IN_KITCHEN"
        title="En Cocina"
        orders={activeOrders}
        tables={tables}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
      />
      <KdsColumn
        status="READY"
        title="Listas"
        orders={activeOrders}
        tables={tables}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
      />
    </div>
  );
}
