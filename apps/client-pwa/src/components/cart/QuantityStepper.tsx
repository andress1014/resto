import React from 'react';

export interface QuantityStepperProps {
  quantity: number;
  productName: string;
  onIncrease?: () => void;
  onDecrease?: () => void;
}

export function QuantityStepper({
  quantity,
  productName,
  onIncrease,
  onDecrease,
}: QuantityStepperProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--bento-touch-gap)',
      }}
    >
      <button
        type="button"
        role="button"
        aria-label={`Reducir cantidad de ${productName}`}
        onClick={onDecrease}
        style={{
          minHeight: 'var(--bento-touch-target)',
          minWidth: 'var(--bento-touch-target)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          backgroundColor: 'var(--bento-card-bg)',
          color: 'var(--bento-text)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700,
        }}
      >
        −
      </button>

      <span
        style={{
          minWidth: 'var(--bento-spacing-md)',
          textAlign: 'center',
          fontWeight: 600,
          color: 'var(--bento-text)',
        }}
      >
        {quantity}
      </span>

      <button
        type="button"
        role="button"
        aria-label={`Aumentar cantidad de ${productName}`}
        onClick={onIncrease}
        style={{
          minHeight: 'var(--bento-touch-target)',
          minWidth: 'var(--bento-touch-target)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          backgroundColor: 'var(--bento-card-bg)',
          color: 'var(--bento-text)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700,
        }}
      >
        +
      </button>
    </div>
  );
}
