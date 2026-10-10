import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import KdsPage from '../src/app/kds/page';
import { ApiClient } from '../src/lib/api';
import * as realtimeModule from '../src/lib/realtime';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('RONDA 5: FIX A - KDS conecta socket usando ApiClient.token (TDD Rojo)', () => {
  const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

  beforeEach(() => {
    localStorage.clear(); // NO existe la key 'token'
    ApiClient.token = null;
    jest.clearAllMocks();
  });

  test('KdsPage conecta socket con ApiClient.token cuando localStorage NO tiene key "token"', async () => {
    ApiClient.token = 'resto_jwt_valido';
    const mockSocket = {
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    const spy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith('resto_jwt_valido');
      });
    } finally {
      spy.mockRestore();
    }
  });
});
