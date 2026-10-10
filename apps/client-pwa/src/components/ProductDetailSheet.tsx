import React, { useEffect, useRef, useState } from 'react';
import { ProductDTO } from '@packages/shared-types';
import { ModifierGroupPicker } from './ModifierGroupPicker';

export interface ProductDetailSheetProps {
  product: ProductDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: ProductDTO, selectedModifiers: any[], quantity: number) => void;
}

export function ProductDetailSheet({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductDetailSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
      setSelectedModifiers({});
      setQuantity(1);
    } else {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen || !product) {
    return null;
  }

  const handleModifierChange = (groupId: string, selectedIds: string[]) => {
    setSelectedModifiers((prev) => ({
      ...prev,
      [groupId]: selectedIds,
    }));
  };

  const handleAdd = () => {
    const formattedMods: any[] = [];
    (product.modifierGroups || []).forEach((g) => {
      const selected = selectedModifiers[g.id] || [];
      selected.forEach((optId) => {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) {
          formattedMods.push({
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta || 0,
          });
        }
      });
    });

    onAddToCart?.(product, formattedMods, quantity);
    onClose();
  };

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
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--bento-card-shadow)',
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
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              minHeight: 'var(--bento-touch-target)',
              minWidth: 'var(--bento-touch-target)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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

        <p style={{ color: 'var(--bento-accent-strong)', fontWeight: 700, margin: '0 0 var(--bento-spacing-md) 0', fontSize: '1.25rem' }}>
          ${product.price.toFixed(2)}
        </p>

        {product.modifierGroups && product.modifierGroups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bento-spacing-sm)' }}>
            {product.modifierGroups.map((mg) => (
              <ModifierGroupPicker
                key={mg.id}
                group={mg}
                selectedOptions={selectedModifiers[mg.id] || []}
                onChange={(ids) => handleModifierChange(mg.id, ids)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--bento-spacing-md)', display: 'flex', gap: 'var(--bento-spacing-sm)' }}>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              minHeight: 'var(--bento-touch-target)',
              width: '100%',
              backgroundColor: 'var(--bento-accent-strong)',
              color: '#ffffff',
              borderRadius: 'var(--bento-card-radius)',
              border: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Añadir al carrito
          </button>
        </div>
      </div>
    </div>
  );
}
