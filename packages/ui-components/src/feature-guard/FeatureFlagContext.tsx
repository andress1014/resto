import React, { createContext, useContext } from 'react';
import { FeatureFlagProvider } from './ports/FeatureFlagProvider';

export const FeatureFlagContext = createContext<FeatureFlagProvider | null>(null);

export interface FeatureFlagProviderRootProps {
  provider: FeatureFlagProvider;
  children: React.ReactNode;
}

export function FeatureFlagProviderRoot({ provider, children }: FeatureFlagProviderRootProps) {
  return (
    <FeatureFlagContext.Provider value={provider}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(): FeatureFlagProvider | null {
  return useContext(FeatureFlagContext);
}
