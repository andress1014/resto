import React from 'react';

export interface AvailabilityToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AvailabilityToggle({
  checked,
  onChange,
  label,
  className,
  style,
}: AvailabilityToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        borderRadius: 'var(--bento-inner-radius)',
        backgroundColor: checked ? 'var(--bento-success)' : 'var(--bento-text-muted)',
        color: 'var(--bento-card-bg)',
        border: 'none',
        ...style,
      }}
    >
      <span>{label}</span>
    </button>
  );
}
