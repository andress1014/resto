import { FeatureFlagProvider } from '../ports/FeatureFlagProvider';
import { FeatureFlagKey, FeatureFlags, DEFAULT_FEATURE_FLAGS } from '../featureFlags';

export class StaticFeatureFlagProvider implements FeatureFlagProvider {
  private readonly flags: FeatureFlags;

  constructor(initialFlags?: Partial<FeatureFlags>) {
    this.flags = {
      ...DEFAULT_FEATURE_FLAGS,
      ...(initialFlags || {}),
    };
  }

  isEnabled(flag: FeatureFlagKey): boolean {
    return Boolean(this.flags[flag]);
  }

  getAll(): FeatureFlags {
    return { ...this.flags };
  }
}
