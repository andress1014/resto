import React, { useEffect, useRef } from 'react';
import { ProductDTO } from '@packages/shared-types';
import { ModifierGroupPicker } from './ModifierGroupPicker';

export interface ProductDetailSheetProps {
  product: ProductDTO | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductDetailSheet({
  product,
  isOpen,
  onClose,
}: ProductDetailSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen || !product) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
    >
      <div
        data-component="bento-card"
        style={{
          background: 'var(--bento-card-bg)',
          borderRadius: 'var(--bento-card-radius) var(--bento-card-radius) 0 0',
          padding: 'var(--bento-spacing-md)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--bento-spacing-sm)',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--bento-text)' }}>{product.name}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              minHeight: 'var(--bento-touch-target)',
              minWidth: 'var(--bento-touch-target)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p style={{ color: 'var(--bento-text-muted)', margin: '0 0 var(--bento-spacing-md) 0' }}>
          ${product.price.toFixed(2)}
        </p>

        {product.modifierGroups && product.modifierGroups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bento-spacing-sm)' }}>
            {product.modifierGroups.map((mg) => (
              <ModifierGroupPicker key={mg.id} group={mg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
