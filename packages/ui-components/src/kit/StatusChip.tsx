import React from 'react';

export type StatusChipTone = 'ok' | 'warning' | 'error' | 'neutral';

export interface StatusChipProps {
  label: string;
  tone?: StatusChipTone;
  className?: string;
}

// Texto siempre tinta/ámbar fuerte sobre fondo papel para cumplir contraste; el color semántico va en el dot.
const TONES: Record<StatusChipTone, { dot: string; bg: string; fg: string }> = {
  ok: { dot: 'var(--bento-success)', bg: 'var(--bento-lima)', fg: 'var(--bento-tinta)' },
  warning: { dot: 'var(--bento-amber)', bg: 'var(--bento-papel)', fg: 'var(--bento-amber-strong)' },
  error: { dot: 'var(--bento-destructive)', bg: 'var(--bento-papel)', fg: 'var(--bento-destructive)' },
  neutral: { dot: 'var(--bento-text-muted)', bg: 'var(--bento-hueso)', fg: 'var(--bento-text)' },
};

export function StatusChip({ label, tone = 'neutral', className }: StatusChipProps) {
  const t = TONES[tone];
  return (
    <span
      data-component="status-chip"
      data-tone={tone}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.125rem 0.625rem',
        borderRadius: 'var(--bento-pill-radius)',
        border: '1px solid var(--bento-border)',
        background: t.bg,
        color: t.fg,
        fontFamily: 'var(--bento-font-body)',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      <span
        data-part="dot"
        aria-hidden="true"
        style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: 'var(--bento-pill-radius)',
          background: t.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
