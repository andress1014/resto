import { FeatureFlagProvider } from '../ports/FeatureFlagProvider';
import { FeatureFlagKey, FeatureFlags, parseFeatureFlags } from '../featureFlags';
import { StaticFeatureFlagProvider } from './StaticFeatureFlagProvider';

export class EnvFeatureFlagProvider implements FeatureFlagProvider {
  private readonly provider: StaticFeatureFlagProvider;

  constructor(envVarName = 'NEXT_PUBLIC_FEATURE_FLAGS') {
    const raw =
      envVarName === 'NEXT_PUBLIC_FEATURE_FLAGS'
        ? process.env.NEXT_PUBLIC_FEATURE_FLAGS
        : typeof process !== 'undefined' && process.env
        ? process.env[envVarName]
        : undefined;
    const parsed = parseFeatureFlags(raw);
    this.provider = new StaticFeatureFlagProvider(parsed);
  }

  isEnabled(flag: FeatureFlagKey): boolean {
    return this.provider.isEnabled(flag);
  }

  getAll(): FeatureFlags {
    return this.provider.getAll();
  }
}
