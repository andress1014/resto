import React from 'react';

export interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', radius = 'var(--bento-inner-radius)', className, style }: SkeletonProps) {
  return (
    <div
      data-component="skeleton"
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--bento-border)',
        ...style,
      }}
    />
  );
}
