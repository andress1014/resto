import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-component="empty-state"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px',
        padding: '32px 24px',
        border: '1px dashed var(--bento-border)',
        borderRadius: 'var(--bento-card-radius)',
        color: 'var(--bento-text)',
      }}
    >
      <svg
        aria-hidden="true"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--bento-text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="6" y="10" width="28" height="22" rx="4" />
        <path d="M6 22h8l2 4h8l2-4h8" />
      </svg>
      <h3 style={{ margin: 0, fontSize: '16px', fontFamily: 'var(--bento-font-heading)' }}>{title}</h3>
      {description ? (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--bento-text-muted)' }}>{description}</p>
      ) : null}
      {action ? <div style={{ marginTop: '8px' }}>{action}</div> : null}
    </div>
  );
}
