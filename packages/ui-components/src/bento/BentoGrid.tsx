import React from 'react';

export interface BentoGridProps {
  children: React.ReactNode;
  cols?: 4 | 3 | 2 | 1;
  className?: string;
  style?: React.CSSProperties;
}

export function BentoGrid({ children, cols = 4, className, style }: BentoGridProps) {
  return (
    <div
      data-component="bento-grid"
      className={className}
      style={{
        display: 'grid',
        gap: 'var(--bento-grid-gap)',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
