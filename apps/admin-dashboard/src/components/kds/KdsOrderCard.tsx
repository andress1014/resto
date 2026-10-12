import React from 'react';
import {
  BentoCard,
  KpiValue,
  ORDER_STATUS_LABELS,
  formatOrderNumber,
  getTableDisplayName,
} from '@packages/ui-components';
import { OrderDTO, OrderStatus, ORDER_STATUS_TRANSITIONS, TableDTO } from '@packages/shared-types';

export interface KdsOrderCardProps {
  order: OrderDTO;
  tables?: TableDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  isUpdating?: boolean;
  alertMinutes?: number;
}

export function KdsOrderCard({
  order,
  tables,
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
    <BentoCard
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--bento-text)',
                fontFamily: 'var(--bento-font-heading)',
              }}
            >
              {getTableDisplayName(order.tableId, tables)}
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--bento-text-muted)' }}>
              {formatOrderNumber(order.id)}
            </span>
          </div>
          <KpiValue
            label="Tiempo"
            value={`${elapsedMinutes}m`}
            tone={isOverdue ? 'destructive' : 'neutral'}
          />
        </div>

        <div
          style={{
            borderTop: '1px solid var(--bento-border)',
            paddingTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {order.items.map((item) => (
            <div key={item.id} style={{ fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>
                  {item.quantity}x {item.productName}
                </span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--bento-text-muted)', paddingLeft: '16px' }}>
                  {item.modifiers.map((m) => m.optionName).join(', ')}
                </div>
              )}
              {item.notes && (
                <div
                  style={{
                    fontSize: '12px',
                    fontStyle: 'italic',
                    color: 'var(--bento-text-muted)',
                    paddingLeft: '16px',
                  }}
                >
                  {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {nextStatus && onAdvanceStatus && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--bento-border)' }}>
          <button
            type="button"
            aria-busy={isUpdating ? 'true' : 'false'}
            onClick={() => onAdvanceStatus(order.id, nextStatus)}
            style={{
              width: '100%',
              minHeight: '40px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 'var(--bento-pill-radius)',
              backgroundColor: 'var(--bento-tinta)',
              color: 'var(--bento-papel)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'var(--bento-font-body)',
              transition: 'opacity 0.2s ease',
              opacity: isUpdating ? 0.7 : 1,
            }}
          >
            <svg
              style={{ width: '14px', height: '14px' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Avanzar a {ORDER_STATUS_LABELS[nextStatus] || nextStatus}
          </button>
        </div>
      )}
    </BentoCard>
  );
}
