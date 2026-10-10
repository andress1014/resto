import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FeatureGuard } from '@packages/ui-components';
import { FeatureFlagsProvider } from '../src/components/FeatureFlagsProvider';

describe('HALLAZGO 1: FeatureFlagsProvider en client-pwa (TDD Rojo)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_FEATURE_FLAGS;

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS = originalEnv;
  });

  test('FeatureFlagsProvider monta EnvFeatureFlagProvider y habilita FeatureGuard cuando flag payments está en env', () => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS = 'kitchen-display:true,payments:true';

    render(
      <FeatureFlagsProvider>
        <FeatureGuard flag="payments">
          <div data-testid="payment-active">Pagar en Efectivo</div>
        </FeatureGuard>
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId('payment-active')).toBeInTheDocument();
    expect(screen.queryByTestId('proximamente')).not.toBeInTheDocument();
  });
});
