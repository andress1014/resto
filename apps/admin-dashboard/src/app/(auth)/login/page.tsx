"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = { email, password };
      if (tenantSlug.trim()) {
        payload.tenantSlug = tenantSlug.trim();
      }
      await ApiClient.login(payload);
      // Fallback for tests or non-Next environments
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/menu');
      }
      router.push('/menu');
    } catch (err: any) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.');
      } else {
        setError(err.message || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bento-page-bg, #F5F5F7)',
        padding: '16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <BentoCard>
          <div style={{ padding: '8px 0' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700 }}>
              Iniciar Sesión
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '0.875rem' }}>
              Accede al panel de administración de tu restaurante
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="email"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@resto.com"
                  required
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="password"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="tenantSlug"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Identificador de Restaurante (opcional)
                </label>
                <input
                  id="tenantSlug"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="mi-restaurante"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.875rem', color: '#6b7280' }}>
                ¿No tienes cuenta?{' '}
                <a
                  href="/register"
                  style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                >
                  Regístrate aquí
                </a>
              </div>
            </form>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
