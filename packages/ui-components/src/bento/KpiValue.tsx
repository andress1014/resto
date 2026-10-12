import React from 'react';

export interface KpiValueProps {
  value: string;
  label: string;
  tone?: 'accent' | 'success' | 'destructive' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
}

export function KpiValue({ value, label, tone = 'neutral', className, style }: KpiValueProps) {
  const isAccent = tone === 'accent';
  const toneColor =
    tone === 'accent'
      ? 'var(--bento-text)'
      : tone === 'success'
      ? 'var(--bento-success)'
      : tone === 'destructive'
      ? 'var(--bento-destructive)'
      : 'var(--bento-text)';

  return (
    <div
      data-component="kpi-value"
      data-tone={tone}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <span style={{ color: 'var(--bento-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span
        style={{
          fontWeight: 700,
          color: toneColor,
          fontFamily: 'var(--bento-font-heading)',
          fontVariantNumeric: 'tabular-nums',
          ...(isAccent
            ? {
                backgroundColor: 'var(--bento-accent)',
                padding: '2px 8px',
                borderRadius: 'var(--bento-inner-radius)',
                display: 'inline-block',
                width: 'fit-content',
              }
            : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}
