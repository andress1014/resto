"use client";
import React, { useMemo } from 'react';
import { EnvFeatureFlagProvider, FeatureFlagProviderRoot } from '@packages/ui-components';

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const provider = useMemo(() => new EnvFeatureFlagProvider(), []);

  return (
    <FeatureFlagProviderRoot provider={provider}>
      {children}
    </FeatureFlagProviderRoot>
  );
}
