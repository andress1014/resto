import React, { useState } from 'react';
import { BillDTO, PaymentMethod, TableSessionDTO } from '@packages/shared-types';
import { BentoCard, KpiValue } from '@packages/ui-components';

export interface ActiveTablesGridProps {
  sessions: TableSessionDTO[];
  onSelectSession?: (session: TableSessionDTO) => void;
  selectedSessionId?: string;
}

export function ActiveTablesGrid({
  sessions,
  onSelectSession,
  selectedSessionId,
}: ActiveTablesGridProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div style={{ padding: 'var(--bento-space-4, 16px)', color: 'var(--bento-text-muted, #666)' }}>
        No hay mesas activas
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--bento-space-4, 16px)',
      }}
    >
      {sessions.map((session) => {
        const isSelected = selectedSessionId === session.sessionId;
        return (
          <BentoCard
            key={session.sessionId}
            interactive={Boolean(onSelectSession)}
            onClick={() => onSelectSession?.(session)}
            style={{
              padding: 'var(--bento-space-4, 16px)',
              minHeight: '44px',
              border: isSelected
                ? '2px solid var(--bento-accent, #2563eb)'
                : '1px solid var(--bento-border, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{session.tableId}</span>
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--bento-text-muted, #666)',
                marginTop: '4px',
              }}
            >
              Abierta: {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </BentoCard>
        );
      })}
    </div>
  );
}

export interface BillSummaryCardProps {
  bill: BillDTO;
  error?: string;
  onRetry?: () => void;
}

export function BillSummaryCard({ bill, error, onRetry }: BillSummaryCardProps) {
  const activeOrders = (bill.orders || []).filter((o) => o.status !== 'CANCELLED');

  return (
    <BentoCard
      style={{
        padding: 'var(--bento-space-5, 20px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--bento-space-4, 16px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Cuenta — {bill.tableId}
        </h3>
        <KpiValue label="Total a cobrar" value={`$${bill.total}`} tone="accent" />
      </div>

      {error && (
        <div
          role="alert"
          tabIndex={-1}
          style={{
            padding: 'var(--bento-space-3, 12px)',
            borderRadius: 'var(--bento-radius, 6px)',
            background: 'var(--bento-error-bg, #fee2e2)',
            color: 'var(--bento-destructive, #dc2626)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error === 'SESSION_CLOSE_FAILED' ? 'Error al cerrar la sesión en el servidor' : error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0 12px',
                borderRadius: 'var(--bento-radius, 6px)',
                background: 'var(--bento-destructive, #dc2626)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reintentar cierre
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeOrders.map((order) => (
          <div
            key={order.id}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--bento-border, #e5e7eb)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--bento-text-muted, #666)', marginBottom: '4px' }}>
              Orden #{order.id.slice(-6)} • Subtotal: ${order.total}
            </div>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                }}
              >
                <div>
                  <span style={{ marginRight: '6px' }}>{item.quantity}x</span>
                  <span>{item.productName}</span>
                </div>
                <span>${item.unitPrice * item.quantity}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </BentoCard>
  );
}

export interface PaymentMethodPickerProps {
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodPicker({
  selectedMethod,
  onSelect,
}: PaymentMethodPickerProps) {
  const options: { method: PaymentMethod; label: string }[] = [
    { method: 'CASH', label: 'Efectivo' },
    { method: 'CARD', label: 'Tarjeta' },
    { method: 'OTHER', label: 'Otro' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Método de pago"
      style={{
        display: 'flex',
        gap: 'var(--bento-space-3, 12px)',
        flexWrap: 'wrap',
      }}
    >
      {options.map((opt) => {
        const isSelected = selectedMethod === opt.method;
        return (
          <button
            key={opt.method}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(opt.method)}
            style={{
              minHeight: '44px',
              minWidth: '100px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: 'var(--bento-radius, 6px)',
              border: isSelected
                ? '2px solid var(--bento-accent, #2563eb)'
                : '1px solid var(--bento-border, #e5e7eb)',
              background: isSelected
                ? 'var(--bento-card-bg-selected, #eff6ff)'
                : 'var(--bento-card-bg, #ffffff)',
              color: 'var(--bento-text, #111827)',
              cursor: 'pointer',
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface ConfirmPaymentButtonProps {
  disabled?: boolean;
  total?: number;
  method?: PaymentMethod | null;
  onConfirm: () => void;
}

export function ConfirmPaymentButton({
  disabled,
  total,
  method,
  onConfirm,
}: ConfirmPaymentButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 'var(--bento-space-3, 12px)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 500 }}>
          ¿Registrar cobro de ${total} y liberar la mesa?
        </span>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
            onConfirm();
          }}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 16px',
            borderRadius: 'var(--bento-radius, 6px)',
            background: 'var(--bento-accent-strong, #1d4ed8)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Confirmar cobro y liberar mesa
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 16px',
            borderRadius: 'var(--bento-radius, 6px)',
            background: 'var(--bento-card-bg, #ffffff)',
            border: '1px solid var(--bento-border, #e5e7eb)',
            color: 'var(--bento-text, #111827)',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setIsConfirming(true)}
      style={{
        minHeight: '44px',
        minWidth: '44px',
        padding: '0 20px',
        borderRadius: 'var(--bento-radius, 6px)',
        background: disabled
          ? 'var(--bento-disabled-bg, #e5e7eb)'
          : 'var(--bento-accent-strong, #1d4ed8)',
        color: disabled ? 'var(--bento-disabled-text, #9ca3af)' : '#ffffff',
        border: 'none',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      Registrar cobro
    </button>
  );
}

export interface PaymentSuccessCardProps {
  tableId: string;
  amount: number;
  method: PaymentMethod;
}

export function PaymentSuccessCard({
  tableId,
  amount,
  method,
}: PaymentSuccessCardProps) {
  return (
    <BentoCard
      style={{
        padding: 'var(--bento-space-5, 20px)',
        border: '1px solid var(--bento-success, #16a34a)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--bento-success, #16a34a)' }}>
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
          Cobro registrado. Mesa liberada.
        </span>
      </div>
      <div style={{ color: 'var(--bento-text-muted, #666)' }}>
        {tableId} • Total: ${amount} • Medio: {method}
      </div>
    </BentoCard>
  );
}
