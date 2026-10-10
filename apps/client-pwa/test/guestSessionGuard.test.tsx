import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GuestSessionGuard } from '../src/components/GuestSessionGuard';
import { PwaApiClient } from '../src/lib/api';

describe('Bloque 4: GuestSessionGuard hidratación y gate de montaje', () => {
  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = null;
  });

  test('Render inicial (SSR / pre-mount) renderiza placeholder neutro, y tras mount decide sin token', async () => {
    // Simular que en pre-mount no hay mismatch
    const { container, rerender } = render(
      <GuestSessionGuard>
        <div data-testid="protected-content">Contenido Protegido</div>
      </GuestSessionGuard>
    );

    // En el DOM final (post-mount), sin token, muestra el mensaje de escaneo
    expect(await screen.findByText('Escanea el QR de tu mesa')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  test('Con token en storage, tras mount muestra los children', async () => {
    PwaApiClient.guestToken = 'valid-token';

    render(
      <GuestSessionGuard>
        <div data-testid="protected-content">Contenido Protegido</div>
      </GuestSessionGuard>
    );

    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();
  });
});
