import React, { useState } from 'react';
import { BentoCard, BentoGrid } from '@packages/ui-components';
import { ApiClient } from '../../lib/api';

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    window.history.pushState({}, '', '/onboarding');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await ApiClient.register({
        restaurantName: 'Mi Restaurante',
        adminEmail: 'admin@resto.com',
        adminPassword: 'password123',
        adminDisplayName: 'Admin',
      });
      window.history.pushState({}, '', '/menu');
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CONFLICT' || err.message?.includes('registrado')) {
        setError('El restaurante o correo ya está registrado');
      } else {
        setError(err.message || 'Error al registrar');
      }
    }
  };

  return (
    <BentoGrid cols={1}>
      <BentoCard>
        <h2>Crear Restaurante</h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <div role="alert" style={{ color: 'var(--bento-destructive)' }}>
              {error}
            </div>
          )}
          <button type="submit">Crear Restaurante</button>
        </form>
      </BentoCard>
    </BentoGrid>
  );
}
