import React from 'react';
import { BentoCard, KpiValue } from '@packages/ui-components';
import { OrderDTO, OrderStatus, ORDER_STATUS_TRANSITIONS } from '@packages/shared-types';

export interface KdsOrderCardProps {
  order: OrderDTO;
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  isUpdating?: boolean;
  alertMinutes?: number;
}

export function KdsOrderCard({
  order,
  onAdvanceStatus,
  isUpdating = false,
  alertMinutes = 15,
}: KdsOrderCardProps) {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status] || [];
  // Siguiente estado primario (normalmente el primer estado de avance, e.g. PLACED->IN_KITCHEN, IN_KITCHEN->READY, READY->DELIVERED)
  const nextStatus = allowedTransitions.find((s) => s !== 'CANCELLED');

  const createdAtTime = new Date(order.createdAt).getTime();
  const now = Date.now();
  const elapsedMinutes = Math.max(0, Math.floor((now - createdAtTime) / 60000));
  const isOverdue = elapsedMinutes > alertMinutes;

  return (
    <BentoCard className="p-4 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-base text-[var(--bento-text)]">{order.tableId}</h4>
            <span className="text-xs text-[var(--bento-text-muted)]">Orden #{order.id.slice(-6)}</span>
          </div>
          <KpiValue
            label="Tiempo"
            value={`${elapsedMinutes}m`}
            tone={isOverdue ? 'destructive' : 'neutral'}
          />
        </div>

        <div className="border-t border-[var(--bento-border)] pt-2 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="text-sm">
              <div className="flex justify-between font-medium">
                <span>
                  {item.quantity}x {item.productName}
                </span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-xs text-[var(--bento-text-muted)] pl-4">
                  {item.modifiers.map((m) => m.optionName).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="text-xs italic text-[var(--bento-text-muted)] pl-4">
                  {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {nextStatus && onAdvanceStatus && (
        <div className="mt-4 pt-3 border-t border-[var(--bento-border)]">
          <button
            type="button"
            aria-busy={isUpdating ? 'true' : 'false'}
            onClick={() => onAdvanceStatus(order.id, nextStatus)}
            className="w-full py-2 px-3 text-xs font-semibold rounded bg-[var(--bento-accent)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Avanzar a {nextStatus}
          </button>
        </div>
      )}
    </BentoCard>
  );
}
