import React from 'react';
import { FeatureFlagKey } from './featureFlags';
import { useFeatureFlag } from './FeatureFlagContext';
import { StaticFeatureFlagProvider } from './adapters/StaticFeatureFlagProvider';
import { Proximamente } from './Proximamente';

export interface FeatureGuardProps {
  flag: FeatureFlagKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGuard({ flag, children, fallback }: FeatureGuardProps) {
  const contextProvider = useFeatureFlag();
  const provider = contextProvider ?? new StaticFeatureFlagProvider();

  let enabled = false;
  try {
    enabled = provider.isEnabled(flag);
  } catch {
    enabled = false;
  }

  if (enabled) {
    return <>{children}</>;
  }

  return <>{fallback ?? <Proximamente />}</>;
}
