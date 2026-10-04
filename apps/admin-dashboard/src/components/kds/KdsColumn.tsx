import React from 'react';
import { OrderDTO, OrderStatus } from '@packages/shared-types';
import { KdsOrderCard } from './KdsOrderCard';

export interface KdsColumnProps {
  status: OrderStatus;
  title: string;
  orders: OrderDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  updatingOrderId?: string | null;
}

export function KdsColumn({
  status,
  title,
  orders,
  onAdvanceStatus,
  updatingOrderId,
}: KdsColumnProps) {
  const columnOrders = orders.filter((o) => o.status === status);
  const countText = `${columnOrders.length} orden${columnOrders.length === 1 ? '' : 'es'}`;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--bento-border)] bg-[var(--bento-surface)] p-3">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--bento-border)] mb-3">
        <h3 className="font-bold text-sm tracking-wide text-[var(--bento-text)] uppercase">{title}</h3>
        <span className="text-xs font-medium text-[var(--bento-text-muted)] bg-[var(--bento-bg)] px-2.5 py-0.5 rounded-full border border-[var(--bento-border)]">
          {countText}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {columnOrders.map((order) => (
          <KdsOrderCard
            key={order.id}
            order={order}
            onAdvanceStatus={onAdvanceStatus}
            isUpdating={updatingOrderId === order.id}
          />
        ))}
      </div>
    </div>
  );
}
