import { FeatureFlagKey, FeatureFlags } from '../featureFlags';

export interface FeatureFlagProvider {
  isEnabled(flag: FeatureFlagKey): boolean;
  getAll(): FeatureFlags;
}
