"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = {
        restaurantName,
        adminEmail,
        adminPassword,
        adminDisplayName: adminDisplayName.trim() || restaurantName,
      };
      if (slug.trim()) {
        payload.slug = slug.trim();
      }
      await ApiClient.register(payload);
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/menu');
      }
      router.push('/menu');
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CONFLICT' || err.message?.includes('registrado')) {
        setError('El restaurante o correo ya está registrado');
      } else {
        setError(err.message || 'Error al registrar el restaurante');
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
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <BentoCard>
          <div style={{ padding: '8px 0' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700 }}>
              Crear Restaurante
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '0.875rem' }}>
              Registra tu negocio para empezar a gestionar cartas y pedidos
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

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="restaurantName"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Nombre del Restaurante
                </label>
                <input
                  id="restaurantName"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Mi Restaurante Gourmet"
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
                  htmlFor="adminEmail"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Correo Electrónico (Admin)
                </label>
                <input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@resto.com"
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
                  htmlFor="adminPassword"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Contraseña (Admin)
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
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
                  htmlFor="slug"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
                >
                  Slug URL (opcional)
                </label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
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
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Creando cuenta...' : 'Crear Cuenta y Restaurante'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.875rem', color: '#6b7280' }}>
                ¿Ya tienes una cuenta?{' '}
                <a
                  href="/login"
                  style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                >
                  Inicia sesión aquí
                </a>
              </div>
            </form>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
