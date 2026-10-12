import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ProductDTO } from '@packages/shared-types';
import { ModifierGroupPicker } from './ModifierGroupPicker';
import { QuantityStepper } from './cart/QuantityStepper';

export interface ProductDetailSheetProps {
  product: ProductDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: ProductDTO, selectedModifiers: any[], quantity: number) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isModifierValid = useMemo(() => {
    if (!product || !product.modifierGroups || product.modifierGroups.length === 0) {
      return true;
    }
    return product.modifierGroups.every((g) => {
      const minRequired = Math.max(g.minSelections || 0, g.isRequired ? 1 : 0);
      const selectedCount = (selectedModifiers[g.id] || []).length;
      return selectedCount >= minRequired;
    });
  }, [product, selectedModifiers]);

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
    if (!isModifierValid) {
      return;
    }

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
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'Tab') {
          if (!dialogRef.current) return;
          const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
          if (nodes.length === 0) {
            e.preventDefault();
            return;
          }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === dialogRef.current)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--bento-spacing-md)',
            paddingTop: 'var(--bento-spacing-sm)',
            borderTop: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--bento-text)' }}>Cantidad</span>
          <QuantityStepper
            quantity={quantity}
            productName={product.name}
            onIncrease={() => setQuantity((q) => q + 1)}
            onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
          />
        </div>

        {!isModifierValid && (
          <p
            role="alert"
            style={{
              margin: 'var(--bento-spacing-sm) 0 0 0',
              color: 'var(--bento-destructive)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Selecciona las opciones obligatorias para continuar.
          </p>
        )}

        <div style={{ marginTop: 'var(--bento-spacing-md)', display: 'flex', gap: 'var(--bento-spacing-sm)' }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!isModifierValid}
            style={{
              minHeight: 'var(--bento-touch-target)',
              width: '100%',
              backgroundColor: isModifierValid ? 'var(--bento-accent-strong)' : 'var(--bento-papel)',
              color: isModifierValid ? 'var(--bento-card-bg)' : 'var(--bento-text-muted)',
              borderRadius: 'var(--bento-card-radius)',
              border: isModifierValid ? 'none' : '1px solid var(--bento-border)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: isModifierValid ? 'pointer' : 'not-allowed',
              opacity: isModifierValid ? 1 : 0.6,
            }}
          >
            Añadir al carrito
          </button>
        </div>
      </div>
    </div>
  );
}
