import React from 'react';

export interface BentoCardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  span?: 1 | 2;
  variant?: 'default' | 'kpi' | 'action';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function BentoCard({
  children,
  span = 1,
  variant = 'default',
  interactive,
  onClick,
  className,
  style,
  ...rest
}: BentoCardProps) {
  const inlineStyle: any = {
    borderRadius: 'var(--bento-card-radius)',
    boxShadow: 'var(--bento-card-shadow)',
    background: 'var(--bento-card-bg)',
    backgroundColor: 'var(--bento-card-bg)',
    gridColumn: span === 2 ? 'span 2' : undefined,
    ...(interactive
      ? {
          cursor: 'pointer',
        }
      : {}),
    ...style,
  };

  return (
    <article
      data-component="bento-card"
      data-variant={variant}
      data-interactive={interactive ? 'true' : undefined}
      onClick={onClick}
      className={className}
      style={inlineStyle}
      {...rest}
    >
      {children}
    </article>
  );
}
