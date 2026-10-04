import React from 'react';

export interface CartFabProps {
  itemCount?: number;
  onClick?: () => void;
}

export function CartFab({ itemCount = 0, onClick }: CartFabProps) {
  const inlineStyle: any = {
    position: 'fixed',
    right: 'var(--bento-spacing-md)',
    bottom: 'calc(var(--bento-spacing-md) + env(safe-area-inset-bottom))',
    minHeight: 'var(--bento-touch-target)',
    minWidth: 'var(--bento-touch-target)',
    padding: '0 var(--bento-spacing-md)',
    background: 'var(--bento-accent-strong)',
    backgroundColor: 'var(--bento-accent-strong)',
    '--bento-accent-strong': 'var(--bento-accent-strong)',
    color: 'var(--bento-card-bg)',
    border: 'none',
    borderRadius: 'var(--bento-card-radius)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--bento-touch-gap)',
    fontWeight: 600,
    boxShadow: 'var(--bento-card-shadow)',
    cursor: 'pointer',
    zIndex: 40,
  };

  return (
    <button
      data-component="cart-fab"
      data-testid="stub-cart-fab"
      onClick={onClick}
      aria-label={`Carrito con ${itemCount} productos`}
      style={inlineStyle}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 'var(--bento-spacing-md)',
        }}
      >
        {itemCount}
      </span>
    </button>
  );
}
