import React from 'react';

export interface KpiValueProps {
  value: string;
  label: string;
  tone?: 'accent' | 'success' | 'destructive' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
}

export function KpiValue({ value, label, tone = 'neutral', className, style }: KpiValueProps) {
  const toneColor =
    tone === 'accent'
      ? 'var(--bento-accent)'
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
      <span style={{ color: 'var(--bento-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: toneColor }}>{value}</span>
    </div>
  );
}
