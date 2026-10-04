import React from 'react';
import { BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export default function LoginPage() {
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await ApiClient.login({
      email: 'admin@resto.com',
      password: 'password123',
    });
    window.history.pushState({}, '', '/menu');
  };

  return (
    <BentoCard>
      <h2>Iniciar Sesión</h2>
      <form onSubmit={handleLogin}>
        <button type="submit">Iniciar Sesión</button>
      </form>
    </BentoCard>
  );
}
