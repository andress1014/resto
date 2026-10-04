import React from 'react';

export interface AddedByBadgeProps {
  addedBy?: string;
}

export function AddedByBadge({ addedBy }: AddedByBadgeProps) {
  if (!addedBy) return null;

  return (
    <span
      data-component="added-by-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--bento-spacing-xs) var(--bento-spacing-sm)',
        borderRadius: 'var(--bento-card-radius)',
        backgroundColor: 'var(--bento-accent-subtle, rgba(0, 0, 0, 0.05))',
        color: 'var(--bento-text-muted)',
        fontSize: '0.8rem',
        fontWeight: 500,
      }}
    >
      {addedBy}
    </span>
  );
}
